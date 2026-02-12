import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { callWithRetry, isNetworkError, type EdgeFunctionRequest } from "@/lib/api-retry";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://supabase.localhost";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

type UpdateStatusPayload = {
  appId?: string;
  status?: string;
};

type EdgeFunctionResponse = {
  request_id: string;
  app_id: string;
  action: string;
  previous_status: string;
  new_status: string;
  reviewed_by: string;
  reviewed_at: string;
  reason?: string;
  chainTxId?: string;
};

export async function POST(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  if (!SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
  }

  let payload: UpdateStatusPayload;
  try {
    payload = (await req.json()) as UpdateStatusPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const appId = String(payload.appId || "").trim();
  const status = String(payload.status || "").trim();

  if (!appId) {
    return NextResponse.json({ error: "appId is required" }, { status: 400 });
  }
  if (status !== "active" && status !== "disabled") {
    return NextResponse.json({ error: "status must be active or disabled" }, { status: 400 });
  }

  // Use Edge Function for disable action to ensure on-chain update and audit trail
  if (status === "disabled") {
    const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/app-approve`;
    const requestBody: EdgeFunctionRequest = {
      app_id: appId,
      action: "disable",
    };

    try {
      const response = await callWithRetry(edgeFunctionUrl, requestBody, SERVICE_ROLE_KEY);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Edge function error: ${response.status} - ${errorText}`);

        try {
          const errorJson = JSON.parse(errorText);
          return NextResponse.json(errorJson, { status: response.status });
        } catch {
          return NextResponse.json({ error: `Edge function error: ${response.status}` }, { status: response.status });
        }
      }

      const result: EdgeFunctionResponse = await response.json();
      console.info(`MiniApp disabled: ${appId}`, {
        request_id: result.request_id,
        previous_status: result.previous_status,
        new_status: result.new_status,
      });

      return NextResponse.json({ success: true });
    } catch (error) {
      console.error("Failed to call Edge function:", error);
      return NextResponse.json(
        { error: isNetworkError(error) ? "Edge function unavailable" : "Internal server error" },
        { status: isNetworkError(error) ? 503 : 500 }
      );
    }
  }

  // For "active" status, update directly via REST API (re-enable functionality)
  const url = `${SUPABASE_URL}/rest/v1/miniapps?app_id=eq.${encodeURIComponent(appId)}`;
  const response = await fetch(url, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ status }),
  });

  if (!response.ok) {
    const detail = await response.text();
    return NextResponse.json({ error: "Failed to update MiniApp status", detail }, { status: response.status });
  }

  return NextResponse.json({ success: true });
}
