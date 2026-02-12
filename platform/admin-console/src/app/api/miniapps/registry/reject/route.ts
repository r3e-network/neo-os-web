import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";
import { callWithRetry, isNetworkError, type EdgeFunctionRequest } from "@/lib/api-retry";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "https://supabase.localhost";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

type RejectPayload = {
  appId?: string;
  versionId?: string;
  reviewNotes?: string;
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

  let payload: RejectPayload;
  try {
    payload = (await req.json()) as RejectPayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const appId = String(payload.appId || "").trim();
  const reviewNotes = payload.reviewNotes ? String(payload.reviewNotes).trim() : undefined;

  if (!appId) {
    return NextResponse.json({ error: "appId is required" }, { status: 400 });
  }

  if (!reviewNotes) {
    return NextResponse.json({ error: "reviewNotes is required for rejection" }, { status: 400 });
  }

  const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/app-approve`;
  const requestBody: EdgeFunctionRequest = {
    app_id: appId,
    action: "reject",
    reason: reviewNotes,
  };

  try {
    const response = await callWithRetry(edgeFunctionUrl, requestBody, SERVICE_ROLE_KEY);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Edge function error: ${response.status} - ${errorText}`);

      // Pass through Edge Function error response
      try {
        const errorJson = JSON.parse(errorText);
        return NextResponse.json(errorJson, { status: response.status });
      } catch {
        return NextResponse.json({ error: `Edge function error: ${response.status}` }, { status: response.status });
      }
    }

    const result: EdgeFunctionResponse = await response.json();
    console.info(`MiniApp rejected: ${appId}`, {
      request_id: result.request_id,
      previous_status: result.previous_status,
      new_status: result.new_status,
      reason: result.reason,
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
