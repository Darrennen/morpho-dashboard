import { NextRequest, NextResponse } from "next/server";

interface HeartbeatData {
  ts: number;
  positions: { market: string; hf: number | null; borrowApy: number; collateralUsd: number; borrowUsd: number }[];
  checksRun: number;
  alertsSent: number;
}

// Module-level store — persists within a warm Vercel instance.
// Refreshed by the monitor every 5 min, so worst-case a cold start
// shows "unknown" for up to 5 minutes.
let store: HeartbeatData | null = null;

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-heartbeat-secret");
  if (!secret || secret !== process.env.HEARTBEAT_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  store = await req.json();
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json(store ?? { ts: null });
}
