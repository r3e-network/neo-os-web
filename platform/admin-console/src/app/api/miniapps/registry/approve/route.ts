import { NextResponse } from "next/server";
import { requireAdminAuth } from "@/lib/admin-auth";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  "https://supabase.localhost";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

type ApprovePayload = {
  appId?: string;
  versionId?: string;
  reviewNotes?: string;
};

type VersionRow = {
  id: string;
  app_id: string;
  entry_url?: string | null;
  supported_chains?: string[] | null;
  contracts?: Record<string, unknown> | null;
};

function getReviewer(req: Request): string {
  return req.headers.get("x-admin-user") || "admin";
}

export async function POST(req: Request) {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  if (!SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: "Service role key not configured" }, { status: 500 });
  }

  let payload: ApprovePayload;
  try {
    payload = (await req.json()) as ApprovePayload;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const appId = String(payload.appId || "").trim();
  const versionId = String(payload.versionId || "").trim();
  const reviewNotes = payload.reviewNotes ? String(payload.reviewNotes).trim() : null;

  if (!appId) {
    return NextResponse.json({ error: "appId is required" }, { status: 400 });
  }

  const versionUrl = versionId
    ? `${SUPABASE_URL}/rest/v1/miniapp_versions?id=eq.${encodeURIComponent(versionId)}`
    : `${SUPABASE_URL}/rest/v1/miniapp_versions?app_id=eq.${encodeURIComponent(appId)}&status=eq.pending_review&order=version_code.desc&limit=1`;

  const versionRes = await fetch(versionUrl, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });

  if (!versionRes.ok) {
    const detail = await versionRes.text();
    return NextResponse.json({ error: "Failed to load version", detail }, { status: versionRes.status });
  }

  const versionPayload = (await versionRes.json()) as VersionRow[] | VersionRow;
  const version = Array.isArray(versionPayload) ? versionPayload[0] : versionPayload;

  if (!version?.id) {
    return NextResponse.json({ error: "Version not found" }, { status: 404 });
  }

  await fetch(`${SUPABASE_URL}/rest/v1/miniapp_versions?app_id=eq.${encodeURIComponent(appId)}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ is_current: false }),
  });

  const reviewPayload: Record<string, unknown> = {
    status: "published",
    is_current: true,
    published_at: new Date().toISOString(),
    reviewed_by: getReviewer(req),
    reviewed_at: new Date().toISOString(),
  };
  if (reviewNotes) reviewPayload.review_notes = reviewNotes;

  const updateVersionRes = await fetch(
    `${SUPABASE_URL}/rest/v1/miniapp_versions?id=eq.${encodeURIComponent(version.id)}`,
    {
      method: "PATCH",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(reviewPayload),
    },
  );

  if (!updateVersionRes.ok) {
    const detail = await updateVersionRes.text();
    return NextResponse.json({ error: "Failed to update version", detail }, { status: updateVersionRes.status });
  }

  const registryPayload: Record<string, unknown> = {
    status: "published",
    visibility: "public",
    published_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (version.supported_chains) registryPayload.supported_chains = version.supported_chains;
  if (version.contracts) registryPayload.contracts = version.contracts;

  const registryRes = await fetch(
    `${SUPABASE_URL}/rest/v1/miniapp_registry?app_id=eq.${encodeURIComponent(appId)}`,
    {
      method: "PATCH",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify(registryPayload),
    },
  );

  if (!registryRes.ok) {
    const detail = await registryRes.text();
    return NextResponse.json({ error: "Failed to update registry", detail }, { status: registryRes.status });
  }

  return NextResponse.json({ success: true });
}
