"use client";

import HealthBar from "./HealthBar";
import type { ParsedPosition } from "@/lib/morpho";

interface Props {
  pos: ParsedPosition;
  warnThreshold: number;
  dangerThreshold: number;
}

function fmt(n: number, decimals = 4) {
  if (n === 0) return "0";
  if (n < 0.001) return n.toExponential(2);
  return n.toLocaleString("en-US", { maximumFractionDigits: decimals });
}

function usd(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 });
}

export default function PositionCard({ pos, warnThreshold, dangerThreshold }: Props) {
  const hasActivity = pos.collateralUsd > 0 || pos.borrowedUsd > 0 || pos.suppliedUsd > 0;
  if (!hasActivity) return null;

  const ltvColor =
    pos.ltv > 80 ? "text-red-400" : pos.ltv > 65 ? "text-yellow-300" : "text-emerald-400";

  return (
    <div className="bg-morpho-card border border-morpho-border rounded-2xl p-5 space-y-4 hover:border-blue-800 transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-lg">
              {pos.collateralSymbol}
            </span>
            <span className="text-gray-500">/</span>
            <span className="font-bold text-white text-lg">{pos.loanSymbol}</span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5 font-mono">
            {pos.marketKey.slice(0, 10)}…{pos.marketKey.slice(-6)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">LLTV</div>
          <div className="text-white font-semibold">{(pos.lltv * 100).toFixed(0)}%</div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {pos.collateralUsd > 0 && (
          <div className="bg-gray-900/60 rounded-xl p-3">
            <div className="text-xs text-gray-500 mb-1">Collateral</div>
            <div className="text-white font-semibold">{fmt(pos.collateralAmount)} {pos.collateralSymbol}</div>
            <div className="text-gray-400 text-sm">{usd(pos.collateralUsd)}</div>
          </div>
        )}

        {pos.borrowedUsd > 0 && (
          <div className="bg-gray-900/60 rounded-xl p-3">
            <div className="text-xs text-gray-500 mb-1">Borrowed</div>
            <div className="text-white font-semibold">{fmt(pos.borrowedAmount)} {pos.loanSymbol}</div>
            <div className="text-gray-400 text-sm">{usd(pos.borrowedUsd)}</div>
          </div>
        )}

        {pos.suppliedUsd > 0 && (
          <div className="bg-gray-900/60 rounded-xl p-3">
            <div className="text-xs text-gray-500 mb-1">Supplied</div>
            <div className="text-white font-semibold">{fmt(pos.suppliedAmount)} {pos.loanSymbol}</div>
            <div className="text-gray-400 text-sm">{usd(pos.suppliedUsd)}</div>
          </div>
        )}

        {pos.borrowedUsd > 0 && (
          <div className="bg-gray-900/60 rounded-xl p-3">
            <div className="text-xs text-gray-500 mb-1">LTV</div>
            <div className={`font-bold text-lg ${ltvColor}`}>{pos.ltv.toFixed(1)}%</div>
            <div className="text-gray-500 text-xs">max {(pos.lltv * 100).toFixed(0)}%</div>
          </div>
        )}
      </div>

      {/* Borrow cost */}
      {pos.borrowedUsd > 0 && (
        <div className="bg-red-950/30 border border-red-900/40 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-red-400 uppercase tracking-wider">Borrow Cost</span>
            <span className="text-red-400 font-bold">{pos.borrowApy.toFixed(2)}% APY</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs text-gray-500">Daily</div>
              <div className="text-white font-semibold text-sm">{usd(pos.dailyBorrowCostUsd)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Monthly</div>
              <div className="text-white font-semibold text-sm">{usd(pos.monthlyBorrowCostUsd)}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Annual</div>
              <div className="text-white font-semibold text-sm">{usd(pos.annualBorrowCostUsd)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Supply APY */}
      {pos.suppliedUsd > 0 && (
        <div className="flex gap-1 text-sm">
          <span className="text-gray-500">Supply APY</span>
          <span className="text-emerald-400 font-semibold">{pos.supplyApy.toFixed(2)}%</span>
        </div>
      )}

      {/* Liquidation risk */}
      {pos.liquidationPriceUsd !== null && (
        <div className="bg-yellow-950/30 border border-yellow-900/40 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-yellow-400 uppercase tracking-wider">Liquidation Risk</span>
            {pos.dropToLiquidationPct !== null && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                pos.dropToLiquidationPct < 10
                  ? "bg-red-900/50 text-red-400 border border-red-700"
                  : pos.dropToLiquidationPct < 20
                  ? "bg-yellow-900/50 text-yellow-400 border border-yellow-700"
                  : "bg-emerald-900/50 text-emerald-400 border border-emerald-700"
              }`}>
                {pos.dropToLiquidationPct.toFixed(1)}% buffer
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-gray-500 mb-0.5">Current price</div>
              <div className="text-white font-semibold">{usd(pos.collateralPriceUsd)}</div>
              <div className="text-xs text-gray-500">{pos.collateralSymbol}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-0.5">Liquidation price</div>
              <div className="text-yellow-300 font-semibold">{usd(pos.liquidationPriceUsd)}</div>
              <div className="text-xs text-gray-500">triggers at this price</div>
            </div>
          </div>
          {/* Drop buffer bar */}
          {pos.dropToLiquidationPct !== null && (
            <div>
              <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    pos.dropToLiquidationPct < 10 ? "bg-red-500" :
                    pos.dropToLiquidationPct < 20 ? "bg-yellow-400" : "bg-emerald-400"
                  }`}
                  style={{ width: `${Math.min(pos.dropToLiquidationPct, 100)}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Price can drop {pos.dropToLiquidationPct.toFixed(1)}% before liquidation
              </div>
            </div>
          )}
        </div>
      )}

      {/* Health factor */}
      {pos.borrowedUsd > 0 && (
        <div>
          <div className="text-xs text-gray-500 mb-1">Health Factor</div>
          <HealthBar
            value={pos.healthFactor}
            warnThreshold={warnThreshold}
            dangerThreshold={dangerThreshold}
          />
        </div>
      )}
    </div>
  );
}
