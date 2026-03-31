// MOCK: In-memory stub — replace with Supabase persistence before production
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
let oracleSecrets = [
  { id: "1", name: "binance_api_key", description: "Binance API Key for Market Data", lastUpdated: "2026-03-01T10:00:00Z" },
  { id: "2", name: "okx_api_key", description: "OKX API Key", lastUpdated: "2026-03-02T12:30:00Z" },
  { id: "3", name: "twelvedata_api_key", description: "Twelve Data API Key", lastUpdated: "2026-03-05T12:00:00Z" }
];

export async function GET(request: Request) {
  const authResponse = await requireAdminAuth(request);
  if (authResponse) return authResponse;
  
  // Never return the actual secret values, only metadata
  return NextResponse.json({ _mock: true, secrets: oracleSecrets }, { headers: { "X-Mock-Data": "true" } });
}

export async function POST(request: Request) {
  const authResponse = await requireAdminAuth(request);
  if (authResponse) return authResponse;

  try {
    const data = await request.json();

    // In a real implementation, 'data.value' would be encrypted and saved securely.
    // Here we just save the metadata.
    const newSecret = {
      id: Date.now().toString(),
      name: data.name,
      description: data.description,
      lastUpdated: new Date().toISOString()
    };

    const existingIndex = oracleSecrets.findIndex(s => s.name === data.name);
    if (existingIndex >= 0) {
      oracleSecrets[existingIndex] = { ...oracleSecrets[existingIndex], ...newSecret, id: oracleSecrets[existingIndex].id };
    } else {
      oracleSecrets.push(newSecret);
    }

    return NextResponse.json({ _mock: true, success: true, secrets: oracleSecrets }, { headers: { "X-Mock-Data": "true" } });
  } catch (error) {
    return NextResponse.json({ error: "Invalid secret data" }, { status: 400 });
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

    oracleSecrets = oracleSecrets.filter(s => s.id !== id);
    return NextResponse.json({ _mock: true, success: true, secrets: oracleSecrets }, { headers: { "X-Mock-Data": "true" } });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete secret" }, { status: 500 });
  }
}
