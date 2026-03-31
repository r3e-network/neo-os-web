import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";

// Mock configuration storage for individual services
const serviceConfigs: Record<string, Record<string, unknown>> = {};

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  const authResponse = await requireAdminAuth(request);
  if (authResponse) return authResponse;

  const params = await props.params;
  const serviceId = params.id;
  
  // Return default config if none exists
  return NextResponse.json(serviceConfigs[serviceId] || {
    routing: {
      enabled: true,
      max_concurrent_requests: 100,
      timeout_ms: 30000,
    },
    security: {
      require_signature: true,
      allowlist_only: true,
    },
    resources: {
      memory_limit_mb: 1024,
      cpu_shares: 2,
    },
    logging: {
      level: "info",
      audit_events: true,
    }
  });
}

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  const authResponse = await requireAdminAuth(request);
  if (authResponse) return authResponse;

  const params = await props.params;
  const serviceId = params.id;
  
  try {
    const data = await request.json();
    serviceConfigs[serviceId] = data;
    return NextResponse.json({ success: true, config: serviceConfigs[serviceId] });
  } catch (error) {
    return NextResponse.json({ error: "Invalid configuration data" }, { status: 400 });
  }
}
