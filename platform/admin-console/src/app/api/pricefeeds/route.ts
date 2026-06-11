// DEMO DATA: this route serves read-only sample price-feed definitions so the
// console page renders in dev stacks without the feed-registry backend. Every
// response carries the `X-Mock-Data: true` header, which drives the demo-data
// banner in the UI. Mutations are intentionally NOT implemented: there is no
// persistence behind this route, and silently echoing the mutated list back
// would make an operator believe a feed was reconfigured when it was not.
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";

const MOCK_HEADERS = { "X-Mock-Data": "true" } as const;

const DEMO_PRICEFEEDS = [
  { id: "BTC-USD", symbol: "BTC", pair: "BTC/USD", enabled: true, source: "chainlink" },
  { id: "ETH-USD", symbol: "ETH", pair: "ETH/USD", enabled: true, source: "chainlink" },
  { id: "NEO-USD", symbol: "NEO", pair: "NEO/USD", enabled: true, source: "binance" },
  { id: "GAS-USD", symbol: "GAS", pair: "GAS/USD", enabled: true, source: "binance" },
  { id: "SOL-USD", symbol: "SOL", pair: "SOL/USD", enabled: false, source: "okx" },
] as const;

export async function GET(request: Request) {
  const authResponse = await requireAdminAuth(request);
  if (authResponse) return authResponse;

  return NextResponse.json(DEMO_PRICEFEEDS, { headers: MOCK_HEADERS });
}

export async function POST(request: Request) {
  const authResponse = await requireAdminAuth(request);
  if (authResponse) return authResponse;

  await request.json().catch(() => null);

  return NextResponse.json(
    {
      error:
        "Price-feed configuration is not implemented. The submitted changes were discarded — this console only displays demo feed definitions.",
      code: "NOT_IMPLEMENTED",
    },
    { status: 501, headers: MOCK_HEADERS },
  );
}

export async function DELETE(request: Request) {
  const authResponse = await requireAdminAuth(request);
  if (authResponse) return authResponse;

  return NextResponse.json(
    {
      error:
        "Price-feed deletion is not implemented. This console only displays demo feed definitions.",
      code: "NOT_IMPLEMENTED",
    },
    { status: 501, headers: MOCK_HEADERS },
  );
}
