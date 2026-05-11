import { NextRequest, NextResponse } from "next/server";
import { MORPHO_API, POSITIONS_QUERY } from "@/lib/morpho";

export async function POST(req: NextRequest) {
  const { address, chainId = 1 } = await req.json();

  if (!address) {
    return NextResponse.json({ error: "address required" }, { status: 400 });
  }

  const res = await fetch(MORPHO_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: POSITIONS_QUERY,
      variables: { address: address.toLowerCase(), chainId },
    }),
    next: { revalidate: 0 },
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Morpho API error" }, { status: 502 });
  }

  const data = await res.json();
  const positions = data?.data?.userByAddress?.marketPositions ?? [];
  return NextResponse.json({ positions });
}
