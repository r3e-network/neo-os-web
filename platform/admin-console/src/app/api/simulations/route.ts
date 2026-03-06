import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";
import { getEnv } from "@/lib/env";

function simulationEnv() {
  return getEnv({ strict: true, required: ["SUPABASE_SERVICE_ROLE_KEY"] });
}

export async function GET(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  try {
    const env = simulationEnv();
    const edgeURL = env.NEXT_PUBLIC_EDGE_URL || "http://edge-gateway.platform.svc.cluster.local:8787";

    const response = await fetch(`${edgeURL}/admin-simulations?action=status`, {
      signal: AbortSignal.timeout(10000),
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return jsonError("Failed to fetch simulation status: " + (error instanceof Error ? error.message : String(error)));
  }
}

export async function POST(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  try {
    const env = simulationEnv();
    const edgeURL = env.NEXT_PUBLIC_EDGE_URL || "http://edge-gateway.platform.svc.cluster.local:8787";
    const body = await req.json();
    const { action, config } = body;

    if (action !== "start" && action !== "stop") {
      return jsonError("Invalid action", 400);
    }

    const response = await fetch(`${edgeURL}/admin-simulations`, {
      method: "POST",
      signal: AbortSignal.timeout(15000),
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
      body: JSON.stringify({ action, config }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return jsonError(`Failed to ${action} simulation: ${errText}`, response.status);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return jsonError("Failed to update simulation: " + (error instanceof Error ? error.message : String(error)));
  }
}
