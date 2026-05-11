#!/usr/bin/env python3
"""
Morpho Blue position monitor.
Runs every CHECK_INTERVAL_SECS, sends Slack alerts when thresholds are breached.
Keep it running with: python3 monitor.py
Stop with: Ctrl+C
"""

import json
import os
import time
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path

# ─── Load .env (wallet + webhook live there, never in git) ───────────────────

_env_file = Path(__file__).parent / ".env"
if _env_file.exists():
    for _line in _env_file.read_text().splitlines():
        if "=" in _line and not _line.startswith("#"):
            _k, _v = _line.split("=", 1)
            os.environ.setdefault(_k.strip(), _v.strip())

# ─── CONFIG ──────────────────────────────────────────────────────────────────

WALLET             = os.environ["WALLET"]
SLACK_WEBHOOK      = os.environ["SLACK_WEBHOOK"]
HEARTBEAT_URL      = os.environ.get("HEARTBEAT_URL", "")   # e.g. https://morpho-dashboard-five.vercel.app/api/heartbeat
HEARTBEAT_SECRET   = os.environ.get("HEARTBEAT_SECRET", "")
CHAIN_ID           = 1          # Ethereum mainnet

HF_WARNING      = 1.6        # health factor warning threshold
HF_DANGER       = 1.2        # health factor danger threshold
BORROW_RATE_PCT = 10.0       # borrow APY alert threshold (%)

CHECK_INTERVAL_SECS  = 300   # how often to check (5 minutes)
ALERT_COOLDOWN_SECS  = 3600  # minimum time between same alert (1 hour)
HEARTBEAT_INTERVAL_SECS = 86400  # daily heartbeat (24 hours)

# ─── INTERNALS ───────────────────────────────────────────────────────────────

MORPHO_API   = "https://blue-api.morpho.org/graphql"
COOLDOWN_FILE = Path(__file__).parent / ".monitor_cooldowns.json"

QUERY = """
query UserPositions($address: String!, $chainId: Int!) {
  userByAddress(address: $address, chainId: $chainId) {
    marketPositions {
      market {
        uniqueKey
        lltv
        collateralAsset { symbol decimals priceUsd }
        loanAsset { symbol decimals priceUsd }
        state { borrowApy supplyApy }
      }
      borrowAssets
      borrowAssetsUsd
      collateral
      collateralUsd
      healthFactor
      supplyAssets
      supplyAssetsUsd
    }
  }
}
"""

def load_cooldowns():
    try:
        return json.loads(COOLDOWN_FILE.read_text())
    except Exception:
        return {}

def save_cooldowns(cd):
    COOLDOWN_FILE.write_text(json.dumps(cd))

def can_alert(key):
    cd = load_cooldowns()
    last = cd.get(key, 0)
    return (time.time() - last) > ALERT_COOLDOWN_SECS

def mark_alerted(key):
    cd = load_cooldowns()
    cd[key] = time.time()
    save_cooldowns(cd)

def post_json(url, payload):
    data = json.dumps(payload).encode()
    req  = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        return json.loads(resp.read())

def send_slack(text):
    try:
        data = json.dumps({"text": text}).encode()
        req  = urllib.request.Request(SLACK_WEBHOOK, data=data, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=10):
            pass
        return True
    except Exception as e:
        print(f"  Slack error: {e}")
        return False

def fetch_positions():
    data = post_json(MORPHO_API, {"query": QUERY, "variables": {"address": WALLET.lower(), "chainId": CHAIN_ID}})
    return data["data"]["userByAddress"]["marketPositions"]

def parse(pos):
    market     = pos["market"]
    lltv       = int(market["lltv"]) / 1e18
    col_asset  = market.get("collateralAsset") or {}
    loan_asset = market["loanAsset"]
    col_dec    = col_asset.get("decimals", 18)
    loan_dec   = loan_asset["decimals"]

    col_amount  = int(pos["collateral"]) / 10**col_dec
    borrow_amt  = int(pos["borrowAssets"]) / 10**loan_dec

    col_usd    = pos.get("collateralUsd") or 0
    borrow_usd = pos.get("borrowAssetsUsd") or 0
    supply_usd = pos.get("supplyAssetsUsd") or 0
    hf         = pos.get("healthFactor")

    state      = market.get("state") or {}
    borrow_apy = (state.get("borrowApy") or 0) * 100

    col_price      = (col_usd / col_amount) if col_amount > 0 else col_asset.get("priceUsd", 0)
    liq_price      = (borrow_usd / (col_amount * lltv)) if (col_amount > 0 and lltv > 0 and borrow_usd > 0) else None
    drop_to_liq    = ((col_price - liq_price) / col_price * 100) if liq_price and col_price > 0 else None

    return {
        "key":           market["uniqueKey"],
        "col_symbol":    col_asset.get("symbol", "—"),
        "loan_symbol":   loan_asset["symbol"],
        "col_usd":       col_usd,
        "borrow_usd":    borrow_usd,
        "supply_usd":    supply_usd,
        "hf":            hf,
        "borrow_apy":    borrow_apy,
        "col_price":     col_price,
        "liq_price":     liq_price,
        "drop_to_liq":   drop_to_liq,
        "daily_cost":    borrow_usd * (borrow_apy / 100) / 365,
        "monthly_cost":  borrow_usd * (borrow_apy / 100) / 12,
        "lltv":          lltv,
    }

def check_and_alert(positions):
    alerts_sent = 0
    for raw in positions:
        p = parse(raw)
        if p["col_usd"] == 0 and p["borrow_usd"] == 0 and p["supply_usd"] == 0:
            continue

        market_label = f"{p['col_symbol']}/{p['loan_symbol']}"

        # ── Health factor alerts ──────────────────────────────────────────────
        hf = p["hf"]
        if hf is not None and p["borrow_usd"] > 0:
            is_danger = hf < HF_DANGER
            is_warn   = not is_danger and hf < HF_WARNING
            level     = "DANGER" if is_danger else ("WARNING" if is_warn else None)

            if level:
                key = f"{WALLET}_{p['key']}_hf_{level}"
                if can_alert(key):
                    emoji = ":red_circle:" if is_danger else ":warning:"
                    threshold = HF_DANGER if is_danger else HF_WARNING
                    liq_line = f"\nLiquidation price: ${p['liq_price']:.4f} (drop buffer: {p['drop_to_liq']:.1f}%)" if p["liq_price"] else ""
                    msg = (
                        f"{emoji} *Morpho Blue HF {level}*\n"
                        f"Market: {market_label}\n"
                        f"Health Factor: *{hf:.3f}* (threshold: {threshold})\n"
                        f"Collateral: ${p['col_usd']:,.2f} | Borrowed: ${p['borrow_usd']:,.2f}"
                        f"{liq_line}\n"
                        f"Wallet: `{WALLET[:8]}…{WALLET[-6:]}`"
                    )
                    if send_slack(msg):
                        mark_alerted(key)
                        alerts_sent += 1
                        print(f"  [ALERT] HF {level} sent — {market_label} HF={hf:.3f}")

        # ── Borrow rate alert ─────────────────────────────────────────────────
        if p["borrow_usd"] > 0 and p["borrow_apy"] > BORROW_RATE_PCT:
            key = f"{WALLET}_{p['key']}_borrow_rate"
            if can_alert(key):
                msg = (
                    f":chart_with_upwards_trend: *Morpho Blue HIGH BORROW RATE*\n"
                    f"Market: {market_label}\n"
                    f"Borrow APY: *{p['borrow_apy']:.2f}%* (threshold: {BORROW_RATE_PCT}%)\n"
                    f"Cost → Daily: ${p['daily_cost']:.2f} | Monthly: ${p['monthly_cost']:.2f}\n"
                    f"Wallet: `{WALLET[:8]}…{WALLET[-6:]}`"
                )
                if send_slack(msg):
                    mark_alerted(key)
                    alerts_sent += 1
                    print(f"  [ALERT] High borrow rate sent — {market_label} APY={p['borrow_apy']:.2f}%")

    return alerts_sent

def log_status(positions):
    active = [parse(p) for p in positions]
    active = [p for p in active if p["col_usd"] > 0 or p["borrow_usd"] > 0 or p["supply_usd"] > 0]

    if not active:
        print("  No active positions found.")
        return

    for p in active:
        hf_str  = f"HF={p['hf']:.3f}" if p["hf"] is not None else "HF=n/a"
        liq_str = f"  liq@${p['liq_price']:.4f} ({p['drop_to_liq']:.1f}% buffer)" if p["liq_price"] else ""
        print(f"  {p['col_symbol']}/{p['loan_symbol']}  col=${p['col_usd']:,.0f}  borrow=${p['borrow_usd']:,.0f}  {hf_str}  APY={p['borrow_apy']:.2f}%{liq_str}")

def send_heartbeat(positions_parsed, alerts_sent, checks_run):
    if not HEARTBEAT_URL or not HEARTBEAT_SECRET:
        return
    payload = {
        "ts": int(time.time() * 1000),
        "checksRun": checks_run,
        "alertsSent": alerts_sent,
        "positions": [
            {
                "market": f"{p['col_symbol']}/{p['loan_symbol']}",
                "hf": p["hf"],
                "borrowApy": round(p["borrow_apy"], 2),
                "collateralUsd": round(p["col_usd"], 2),
                "borrowUsd": round(p["borrow_usd"], 2),
            }
            for p in positions_parsed
            if p["col_usd"] > 0 or p["borrow_usd"] > 0
        ],
    }
    try:
        data = json.dumps(payload).encode()
        req  = urllib.request.Request(
            HEARTBEAT_URL, data=data,
            headers={"Content-Type": "application/json", "x-heartbeat-secret": HEARTBEAT_SECRET},
        )
        with urllib.request.urlopen(req, timeout=10):
            pass
        print("  Heartbeat sent to dashboard.")
    except Exception as e:
        print(f"  Heartbeat error: {e}")

def run():
    print("=" * 60)
    print("  Morpho Blue Monitor")
    print(f"  Wallet   : {WALLET[:8]}…{WALLET[-6:]}")
    print(f"  Alerts   : HF<{HF_WARNING} (warn) / HF<{HF_DANGER} (danger) / APY>{BORROW_RATE_PCT}%")
    print(f"  Interval : every {CHECK_INTERVAL_SECS}s | cooldown: {ALERT_COOLDOWN_SECS}s")
    print(f"  Dashboard: {HEARTBEAT_URL or 'not configured'}")
    print("=" * 60)

    # Startup Slack ping
    send_slack(
        f":white_check_mark: *Morpho Monitor started*\n"
        f"Wallet: `{WALLET[:8]}…{WALLET[-6:]}`\n"
        f"Checking every {CHECK_INTERVAL_SECS // 60} min · HF<{HF_WARNING} warn · HF<{HF_DANGER} danger · APY>{BORROW_RATE_PCT}%"
    )

    checks_run  = 0
    total_alerts = 0

    while True:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        print(f"\n[{now}] Checking…")
        try:
            positions = fetch_positions()
            parsed    = [parse(p) for p in positions]
            log_status(positions)
            sent      = check_and_alert(positions)
            checks_run  += 1
            total_alerts += sent
            if sent == 0:
                print("  No alerts triggered.")
            send_heartbeat(parsed, total_alerts, checks_run)
        except Exception as e:
            print(f"  Error: {e}")

        print(f"  Next check in {CHECK_INTERVAL_SECS}s…")
        time.sleep(CHECK_INTERVAL_SECS)

if __name__ == "__main__":
    run()
