// MOCK: In-memory stub — replace with Supabase persistence before production
import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
let platformConfig = {
  maintenanceMode: false,
  approvalGateRequired: true,
  logLevel: "info",
  pricefeedIntervalMs: 60000,
  maxMiniappSizeMb: 50,
};

export async function GET(request: Request) {
  const authResponse = await requireAdminAuth(request);
  if (authResponse) return authResponse;
  
  return NextResponse.json(platformConfig, { headers: { "X-Mock-Data": "true" } });
}

export async function POST(request: Request) {
  const authResponse = await requireAdminAuth(request);
  if (authResponse) return authResponse;

  try {
    const data = await request.json();
    platformConfig = { ...platformConfig, ...data };
    return NextResponse.json(platformConfig, { headers: { "X-Mock-Data": "true" } });
  } catch (error) {
    return NextResponse.json({ error: "Invalid configuration data" }, { status: 400 });
  }
}
