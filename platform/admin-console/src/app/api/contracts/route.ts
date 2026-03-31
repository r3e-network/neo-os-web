// MOCK: In-memory stub — replace with Supabase persistence before production
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";

let contracts = [
  { id: "AppRegistry", name: "AppRegistry", hash: process.env.CONTRACT_APPREGISTRY_HASH || "0x1111111111111111111111111111111111111111", deployed: false, _mock: true },
  { id: "Governance", name: "Governance", hash: process.env.CONTRACT_GOVERNANCE_HASH || "0x3333333333333333333333333333333333333333", deployed: false, _mock: true },
  { id: "PriceFeed", name: "PriceFeed", hash: process.env.CONTRACT_PRICEFEED_HASH || "0x4444444444444444444444444444444444444444", deployed: false, _mock: true },
  { id: "RandomnessLog", name: "RandomnessLog", hash: process.env.CONTRACT_RANDOMNESSLOG_HASH || "0x5555555555555555555555555555555555555555", deployed: false, _mock: true },
  { id: "AutomationAnchor", name: "AutomationAnchor", hash: process.env.CONTRACT_AUTOMATIONANCHOR_HASH || "0x6666666666666666666666666666666666666666", deployed: false, _mock: true },
];

export async function GET(request: Request) {
  const authResponse = await requireAdminAuth(request);
  if (authResponse) return authResponse;
  
  return NextResponse.json({ _mock: true, contracts }, { headers: { "X-Mock-Data": "true" } });
}

export async function POST(request: Request) {
  const authResponse = await requireAdminAuth(request);
  if (authResponse) return authResponse;

  try {
    const data = await request.json();
    const existingIndex = contracts.findIndex(c => c.id === data.id);

    if (existingIndex >= 0) {
      contracts[existingIndex] = { ...contracts[existingIndex], ...data };
    } else {
      contracts.push({ ...data, id: data.name, deployed: false, _mock: true });
    }

    return NextResponse.json({ _mock: true, success: true, contracts }, { headers: { "X-Mock-Data": "true" } });
  } catch (error) {
    console.error("contracts POST failed:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Invalid contract data" }, { status: 400 });
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

    contracts = contracts.filter(c => c.id !== id);
    return NextResponse.json({ _mock: true, success: true, contracts }, { headers: { "X-Mock-Data": "true" } });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete contract" }, { status: 500 });
  }
}
