import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://supabase.localhost";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

type UpdateStatusPayload = {
  appId?: string;
  status?: string;
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
