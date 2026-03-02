import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { jsonError } from "@/lib/api-utils";

const SIMULATION_URL = process.env.NEOSIMULATION_URL || "http://neosimulation:8093";

export async function GET(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  try {
    const response = await fetch(`${SIMULATION_URL}/status`, {
      signal: AbortSignal.timeout(5000),
      headers: { "Content-Type": "application/json" },
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
    const body = await req.json();
    const { action, config } = body;

    if (action !== "start" && action !== "stop") {
      return jsonError("Invalid action", 400);
    }

    const response = await fetch(`${SIMULATION_URL}/${action}`, {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      headers: { "Content-Type": "application/json" },
      body: config ? JSON.stringify(config) : undefined,
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
