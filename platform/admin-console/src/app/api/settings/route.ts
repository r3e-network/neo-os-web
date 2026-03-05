import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";

// Basic mock data for now. In a real system, this would read/write to Supabase or an internal config database.
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
  
  return NextResponse.json(platformConfig);
}

export async function POST(request: Request) {
  const authResponse = await requireAdminAuth(request);
  if (authResponse) return authResponse;

  try {
    const data = await request.json();
    platformConfig = { ...platformConfig, ...data };
    return NextResponse.json({ success: true, config: platformConfig });
  } catch (error) {
    return NextResponse.json({ error: "Invalid configuration data" }, { status: 400 });
  }
}
