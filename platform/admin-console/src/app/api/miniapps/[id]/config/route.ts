import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";

// Mock configuration storage for individual miniapps
const miniappConfigs: Record<string, any> = {};

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const authResponse = await requireAdminAuth(request);
  if (authResponse) return authResponse;

  const params = await props.params;
  const appId = params.id;
  
  // Return default config if none exists
  return NextResponse.json(miniappConfigs[appId] || {
    permissions: {
      can_access_oracle: false,
      can_access_compute: false,
      can_access_vrf: false,
      max_gas_per_tx: 10,
    },
    services: {
      fee_override: null,
      priority_routing: false,
    },
    tokens: {
      allowed_assets: ["GAS", "NEO"],
      withdrawal_limit_24h: 100,
    },
    actions: {
      suspend_app: false,
      maintenance_mode: false,
    }
  });
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const authResponse = await requireAdminAuth(request);
  if (authResponse) return authResponse;

  const params = await props.params;
  const appId = params.id;
  
  try {
    const data = await request.json();
    miniappConfigs[appId] = data;
    return NextResponse.json({ success: true, config: miniappConfigs[appId] });
  } catch (error) {
    return NextResponse.json({ error: "Invalid configuration data" }, { status: 400 });
  }
}
