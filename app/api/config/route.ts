import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    webhookConfigured: !!process.env.SLACK_WEBHOOK,
  });
}
