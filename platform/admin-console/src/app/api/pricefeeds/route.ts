// MOCK: In-memory stub — replace with Supabase persistence before production
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
let pricefeeds = [
  { id: "BTC-USD", symbol: "BTC", pair: "BTC/USD", enabled: true, source: "chainlink" },
  { id: "ETH-USD", symbol: "ETH", pair: "ETH/USD", enabled: true, source: "chainlink" },
  { id: "NEO-USD", symbol: "NEO", pair: "NEO/USD", enabled: true, source: "binance" },
  { id: "GAS-USD", symbol: "GAS", pair: "GAS/USD", enabled: true, source: "binance" },
  { id: "SOL-USD", symbol: "SOL", pair: "SOL/USD", enabled: false, source: "okx" }
];

export async function GET(request: Request) {
  const authResponse = await requireAdminAuth(request);
  if (authResponse) return authResponse;
  
  return NextResponse.json(pricefeeds, { headers: { "X-Mock-Data": "true" } });
}

export async function POST(request: Request) {
  const authResponse = await requireAdminAuth(request);
  if (authResponse) return authResponse;

  try {
    const data = await request.json();
    const existingIndex = pricefeeds.findIndex(p => p.id === data.id);

    if (existingIndex >= 0) {
      pricefeeds[existingIndex] = { ...pricefeeds[existingIndex], ...data };
    } else {
      pricefeeds.push(data);
    }

    return NextResponse.json(pricefeeds, { headers: { "X-Mock-Data": "true" } });
  } catch (error) {
    return NextResponse.json({ error: "Invalid pricefeed data" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const authResponse = await requireAdminAuth(request);
  if (authResponse) return authResponse;

  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Missing ID" }, { status: 400 });
    }

    pricefeeds = pricefeeds.filter(p => p.id !== id);
    return NextResponse.json(pricefeeds, { headers: { "X-Mock-Data": "true" } });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete pricefeed" }, { status: 500 });
  }
}
