"use client";

interface Props {
  value: number | null;
  warnThreshold: number;
  dangerThreshold: number;
}

export default function HealthBar({ value, warnThreshold, dangerThreshold }: Props) {
  if (value === null) return <span className="text-gray-500 text-sm">No borrow</span>;

  const capped = Math.min(value, 3);
  const pct = (capped / 3) * 100;

  const color =
    value < dangerThreshold
      ? "bg-red-500"
      : value < warnThreshold
      ? "bg-yellow-400"
      : "bg-emerald-400";

  const textColor =
    value < dangerThreshold
      ? "text-red-400"
      : value < warnThreshold
      ? "text-yellow-300"
      : "text-emerald-400";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className={`font-bold text-lg ${textColor}`}>{value.toFixed(2)}</span>
        {value < dangerThreshold && (
          <span className="text-xs bg-red-900/50 text-red-400 px-2 py-0.5 rounded-full border border-red-700">
            DANGER
          </span>
        )}
        {value >= dangerThreshold && value < warnThreshold && (
          <span className="text-xs bg-yellow-900/50 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-700">
            WARNING
          </span>
        )}
      </div>
      <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
