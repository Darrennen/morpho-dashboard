import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { webhook, text, blocks } = await req.json();

  // Server env var takes priority; fall back to client-supplied webhook
  const target = process.env.SLACK_WEBHOOK || webhook;

  if (!target) {
    return NextResponse.json({ error: "webhook required" }, { status: 400 });
  }

  const res = await fetch(target, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(blocks ? { blocks, text } : { text }),
  });

  if (!res.ok) {
    const body = await res.text();
    return NextResponse.json({ error: body }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
