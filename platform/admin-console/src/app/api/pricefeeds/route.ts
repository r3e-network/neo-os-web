import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";

// Mock data. In a real environment, this connects to the PriceFeed smart contract or backend DB.
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
  
  return NextResponse.json(pricefeeds);
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
    
    return NextResponse.json({ success: true, pricefeeds });
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
    return NextResponse.json({ success: true, pricefeeds });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete pricefeed" }, { status: 500 });
  }
}
