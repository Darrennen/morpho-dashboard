"use client";

import { useEffect, useState } from "react";

interface Heartbeat {
  ts: number | null;
  checksRun?: number;
  alertsSent?: number;
  positions?: { market: string; hf: number | null; borrowApy: number }[];
}

function elapsed(ts: number) {
  const secs = Math.floor((Date.now() - ts) / 1000);
  if (secs < 60)  return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

export default function MonitorStatus() {
  const [data, setData] = useState<Heartbeat | null>(null);
  const [, tick] = useState(0);

  useEffect(() => {
    const poll = async () => {
      try {
        const r = await fetch("/api/heartbeat");
        setData(await r.json());
      } catch {}
    };
    poll();
    const id = setInterval(poll, 30_000);
    // Re-render every 30s to keep elapsed time fresh
    const tickId = setInterval(() => tick(n => n + 1), 30_000);
    return () => { clearInterval(id); clearInterval(tickId); };
  }, []);

  if (!data) return null;

  const isAlive  = data.ts && (Date.now() - data.ts) < 10 * 60 * 1000; // seen in last 10 min
  const isStale  = data.ts && !isAlive;
  const offline  = !data.ts;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium ${
      isAlive  ? "bg-emerald-900/30 border-emerald-700/50 text-emerald-300" :
      isStale  ? "bg-yellow-900/30 border-yellow-700/50 text-yellow-300" :
                 "bg-gray-800/50 border-gray-700 text-gray-500"
    }`}>
      <span className={`w-2 h-2 rounded-full ${
        isAlive ? "bg-emerald-400 animate-pulse" :
        isStale ? "bg-yellow-400" :
                  "bg-gray-600"
      }`} />
      {offline  && "Monitor offline"}
      {isAlive  && `Monitor active · ${elapsed(data.ts!)}`}
      {isStale  && `Monitor stale · ${elapsed(data.ts!)}`}
    </div>
  );
}
