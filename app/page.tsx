"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PositionCard from "@/components/PositionCard";
import Settings, { AppSettings, DEFAULT_SETTINGS } from "@/components/Settings";
import MonitorStatus from "@/components/MonitorStatus";
import { parsePosition, type MorphoPosition, type ParsedPosition } from "@/lib/morpho";

const LS_ADDRESS = "morpho_address";
const LS_SETTINGS = "morpho_settings";
const LS_ALERT_TIMES = "morpho_alert_times";

function loadSettings(): AppSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(LS_SETTINGS);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function getAlertTimes(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(LS_ALERT_TIMES) ?? "{}");
  } catch {
    return {};
  }
}

function setAlertTime(key: string) {
  const times = getAlertTimes();
  times[key] = Date.now();
  localStorage.setItem(LS_ALERT_TIMES, JSON.stringify(times));
}

function canAlert(key: string, cooldownMins: number): boolean {
  const times = getAlertTimes();
  const last = times[key] ?? 0;
  return Date.now() - last > cooldownMins * 60 * 1000;
}

export default function Home() {
  const [address, setAddress] = useState("");
  const [inputVal, setInputVal] = useState("");
  const [positions, setPositions] = useState<ParsedPosition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [alertLog, setAlertLog] = useState<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load persisted state
  useEffect(() => {
    const saved = localStorage.getItem(LS_ADDRESS) ?? "";
    const s = loadSettings();
    setSettings(s);
    if (saved) {
      setInputVal(saved);
      setAddress(saved);
    }
  }, []);

  const fetchPositions = useCallback(
    async (addr: string) => {
      if (!addr) return;
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/positions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: addr }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "API error");

        const parsed = (data.positions as MorphoPosition[])
          .map(parsePosition)
          .filter((p) => p.collateralUsd > 0 || p.borrowedUsd > 0 || p.suppliedUsd > 0);

        setPositions(parsed);
        setLastUpdated(new Date());

        // Check alerts
        const s = loadSettings();
        if (s.slackWebhook) {
          for (const pos of parsed) {
            // Health factor alerts
            if (pos.healthFactor !== null && pos.borrowedUsd > 0) {
              const isDanger = pos.healthFactor < s.hfDanger;
              const isWarn = !isDanger && pos.healthFactor < s.hfWarning;
              const level = isDanger ? "danger" : isWarn ? "warning" : null;

              if (level) {
                const alertKey = `${addr}_${pos.marketKey}_hf_${level}`;
                if (canAlert(alertKey, s.alertCooldownMins)) {
                  const emoji = isDanger ? ":red_circle:" : ":warning:";
                  const msg = `${emoji} *Morpho Blue HF ${level.toUpperCase()}*\nMarket: ${pos.collateralSymbol}/${pos.loanSymbol}\nHealth Factor: *${pos.healthFactor.toFixed(3)}* (threshold: ${isDanger ? s.hfDanger : s.hfWarning})\nCollateral: $${pos.collateralUsd.toLocaleString()}\nBorrowed: $${pos.borrowedUsd.toLocaleString()}\nWallet: \`${addr.slice(0, 8)}…${addr.slice(-6)}\``;
                  fetch("/api/slack", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ webhook: s.slackWebhook, text: msg }),
                  }).then((r) => {
                    if (r.ok) {
                      setAlertTime(alertKey);
                      setAlertLog((prev) => [
                        `[${new Date().toLocaleTimeString()}] HF ${level.toUpperCase()} — ${pos.collateralSymbol}/${pos.loanSymbol} HF: ${pos.healthFactor?.toFixed(2)}`,
                        ...prev.slice(0, 9),
                      ]);
                    }
                  });
                }
              }
            }

            // Borrow rate alert
            if (pos.borrowedUsd > 0 && s.borrowRateAlert > 0 && pos.borrowApy > s.borrowRateAlert) {
              const alertKey = `${addr}_${pos.marketKey}_borrow_rate`;
              if (canAlert(alertKey, s.alertCooldownMins)) {
                const msg = `:chart_with_upwards_trend: *Morpho Blue HIGH BORROW RATE*\nMarket: ${pos.collateralSymbol}/${pos.loanSymbol}\nBorrow APY: *${pos.borrowApy.toFixed(2)}%* (threshold: ${s.borrowRateAlert}%)\nDaily cost: $${pos.dailyBorrowCostUsd.toFixed(2)} | Monthly: $${pos.monthlyBorrowCostUsd.toFixed(2)}\nWallet: \`${addr.slice(0, 8)}…${addr.slice(-6)}\``;
                fetch("/api/slack", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ webhook: s.slackWebhook, text: msg }),
                }).then((r) => {
                  if (r.ok) {
                    setAlertTime(alertKey);
                    setAlertLog((prev) => [
                      `[${new Date().toLocaleTimeString()}] HIGH BORROW RATE — ${pos.collateralSymbol}/${pos.loanSymbol} APY: ${pos.borrowApy.toFixed(2)}%`,
                      ...prev.slice(0, 9),
                    ]);
                  }
                });
              }
            }
          }
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Auto-refresh
  useEffect(() => {
    if (!address) return;
    fetchPositions(address);
    timerRef.current = setInterval(() => fetchPositions(address), settings.refreshSecs * 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [address, settings.refreshSecs, fetchPositions]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = inputVal.trim();
    if (!trimmed) return;
    localStorage.setItem(LS_ADDRESS, trimmed);
    setAddress(trimmed);
  }

  function handleSaveSettings(s: AppSettings) {
    setSettings(s);
    localStorage.setItem(LS_SETTINGS, JSON.stringify(s));
    setShowSettings(false);
  }

  const totalCollateralUsd = positions.reduce((s, p) => s + p.collateralUsd, 0);
  const totalBorrowedUsd = positions.reduce((s, p) => s + p.borrowedUsd, 0);
  const totalSuppliedUsd = positions.reduce((s, p) => s + p.suppliedUsd, 0);
  const minHF = positions
    .filter((p) => p.healthFactor !== null && p.borrowedUsd > 0)
    .reduce((min, p) => Math.min(min, p.healthFactor!), Infinity);
  const lowestHF = isFinite(minHF) ? minHF : null;

  return (
    <div className="min-h-screen bg-morpho-dark text-white">
      {/* Header */}
      <header className="border-b border-morpho-border bg-gray-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-xs font-bold">M</div>
            <span className="font-semibold text-white">Morpho Blue Dashboard</span>
            <span className="text-xs text-gray-500 hidden sm:block">Ethereum Mainnet</span>
          </div>
          <div className="flex items-center gap-3">
            <MonitorStatus />
            {lastUpdated && (
              <span className="text-xs text-gray-500 hidden sm:block">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            )}
            {address && (
              <button
                onClick={() => fetchPositions(address)}
                disabled={loading}
                className="text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 rounded-lg text-gray-300 disabled:opacity-40 transition-colors"
              >
                {loading ? "Refreshing…" : "Refresh"}
              </button>
            )}
            <button
              onClick={() => setShowSettings(true)}
              className="w-8 h-8 flex items-center justify-center bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg text-gray-400 hover:text-white transition-colors"
              title="Settings"
            >
              ⚙
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        {/* Wallet input */}
        <section>
          <form onSubmit={handleSubmit} className="flex gap-3 max-w-2xl">
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder="Enter wallet address (0x…)"
              className="flex-1 bg-morpho-card border border-morpho-border rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono text-sm"
            />
            <button
              type="submit"
              disabled={!inputVal.trim() || loading}
              className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-3 rounded-xl disabled:opacity-40 transition-colors whitespace-nowrap"
            >
              Check Position
            </button>
          </form>
          {address && address !== inputVal && (
            <p className="text-xs text-gray-500 mt-2">
              Showing: <span className="font-mono text-gray-400">{address}</span>
            </p>
          )}
        </section>

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl px-4 py-3 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Loading skeleton */}
        {loading && positions.length === 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="bg-morpho-card border border-morpho-border rounded-2xl p-5 animate-pulse">
                <div className="h-5 bg-gray-800 rounded w-1/3 mb-4" />
                <div className="grid grid-cols-2 gap-3">
                  <div className="h-20 bg-gray-800 rounded-xl" />
                  <div className="h-20 bg-gray-800 rounded-xl" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary bar */}
        {positions.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Collateral", value: `$${totalCollateralUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, color: "text-white" },
              { label: "Total Borrowed", value: `$${totalBorrowedUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, color: "text-red-400" },
              { label: "Total Supplied", value: `$${totalSuppliedUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, color: "text-emerald-400" },
              {
                label: "Lowest Health",
                value: lowestHF !== null ? lowestHF.toFixed(2) : "—",
                color:
                  lowestHF === null ? "text-gray-400"
                  : lowestHF < settings.hfDanger ? "text-red-400"
                  : lowestHF < settings.hfWarning ? "text-yellow-300"
                  : "text-emerald-400",
              },
            ].map((s) => (
              <div key={s.label} className="bg-morpho-card border border-morpho-border rounded-xl p-4">
                <div className="text-xs text-gray-500 mb-1">{s.label}</div>
                <div className={`font-bold text-xl ${s.color}`}>{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Position cards */}
        {positions.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {positions.map((pos) => (
              <PositionCard
                key={pos.marketKey}
                pos={pos}
                warnThreshold={settings.hfWarning}
                dangerThreshold={settings.hfDanger}
              />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && address && positions.length === 0 && !error && (
          <div className="text-center py-16 text-gray-500">
            <div className="text-4xl mb-3">🔍</div>
            <div className="text-lg font-semibold text-gray-400">No active positions found</div>
            <div className="text-sm mt-1">This address has no open Morpho Blue positions on Ethereum mainnet.</div>
          </div>
        )}

        {/* No address yet */}
        {!address && (
          <div className="text-center py-16 text-gray-500">
            <div className="text-5xl mb-4">📊</div>
            <div className="text-xl font-semibold text-gray-400 mb-2">Enter a wallet address above</div>
            <div className="text-sm">Monitor collateral, borrow positions, health factors and receive Slack alerts.</div>
          </div>
        )}

        {/* Alert log */}
        {alertLog.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Alert Log</h3>
            <div className="bg-morpho-card border border-morpho-border rounded-xl p-4 space-y-1 font-mono text-xs text-gray-400">
              {alertLog.map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </section>
        )}
      </main>

      {showSettings && (
        <Settings
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
