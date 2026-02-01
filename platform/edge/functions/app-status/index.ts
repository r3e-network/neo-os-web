// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";

// Deno global type definitions
declare const Deno: {
  serve(handler: (req: Request) => Promise<Response>): void;
};

import { handleCorsPreflight } from "../_shared/cors.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError } from "../_shared/error-codes.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { requireAuth, supabaseServiceClient } from "../_shared/supabase.ts";

type AppStatusResponse = {
  app_id: string;
  status: "draft" | "pending_review" | "approved" | "published" | "suspended" | "archived";
  submitted_at: string;
  updated_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
  rejection_reason?: string;
  name: string;
  category: string;
  supported_chains: string[];
  permissions: Record<string, unknown>;
};

type ApprovalHistoryItem = {
  action: string;
  previous_status: string;
  new_status: string;
  reviewed_at: string;
  reviewed_by: string;
  rejection_reason?: string;
};

type AppStatusFullResponse = AppStatusResponse & {
  approval_history?: ApprovalHistoryItem[];
};

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET") {
    const { errorResponse: err } = await import("../_shared/error-codes.ts");
    return err("METHOD_NOT_ALLOWED", undefined, req);
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "app-status", auth);
  if (rl) return rl;

  const url = new URL(req.url);
  const appId = url.searchParams.get("app_id")?.trim();
  const includeHistory = url.searchParams.get("include_history") === "true";

  if (!appId) {
    return validationError("app_id", "app_id query parameter is required", req);
  }

  const supabase = supabaseServiceClient();

  // Load app with developer verification
  const { data: app, error: loadError } = await supabase
    .from("miniapp_registry")
    .select(
      `
      app_id,
      status,
      created_at,
      updated_at,
      name,
      category,
      supported_chains,
      permissions,
      developer_address
    `
    )
    .eq("app_id", appId)
    .maybeSingle();

  if (loadError) {
    return errorResponse("DB_002", { message: `database error: ${loadError.message}` }, req);
  }

  if (!app) {
    const { notFoundError: notFound } = await import("../_shared/error-codes.ts");
    return notFound("app", req);
  }

  // Allow access to own apps or admins
  const isAdminReq = url.searchParams.get("admin") === "true";
  let isDeveloper = false;

  if (!isAdminReq) {
    // Check if current user is the developer by looking up linked_neo_accounts
    const { data: linkedAccounts } = await supabase
      .from("linked_neo_accounts")
      .select("neohub_account_id")
      .eq("address", app.developer_address)
      .limit(1)
      .maybeSingle();

    if (linkedAccounts) {
      const { data: neohubAccount } = await supabase
        .from("neohub_accounts")
        .select("id")
        .eq("id", linkedAccounts.neohub_account_id)
        .limit(1)
        .maybeSingle();

      if (neohubAccount && neohubAccount.id === auth.userId) {
        isDeveloper = true;
      }
    }
  }

  if (!isDeveloper && !isAdminReq) {
    const { errorResponse: err } = await import("../_shared/error-codes.ts");
    return err("AUTH_004", { message: "you can only view your own apps" }, req);
  }

  // Load approval history if requested
  let approvalHistory: ApprovalHistoryItem[] | undefined;
  if (includeHistory) {
    const { data: history } = await supabase
      .from("miniapp_approvals")
      .select("action, previous_status, new_status, reviewed_at, reviewed_by, rejection_reason")
      .eq("app_id", appId)
      .order("reviewed_at", { ascending: false })
      .limit(10);

    approvalHistory = (history || []).map((h: Record<string, unknown>) => ({
      action: String(h.action),
      previous_status: String(h.previous_status),
      new_status: String(h.new_status),
      reviewed_at: String(h.reviewed_at),
      reviewed_by: String(h.reviewed_by),
      rejection_reason: h.rejection_reason ? String(h.rejection_reason) : undefined,
    }));
  }

  // Get latest approval info (if any)
  const { data: latestApproval } = await supabase
    .from("miniapp_approvals")
    .select("reviewed_at, reviewed_by, rejection_reason")
    .eq("app_id", appId)
    .order("reviewed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const response: AppStatusFullResponse = {
    app_id: String(app.app_id),
    status: (String(app.status ?? "draft") || "draft") as AppStatusResponse["status"],
    submitted_at: String(app.created_at),
    updated_at: String(app.updated_at),
    reviewed_at: latestApproval?.reviewed_at ? String(latestApproval.reviewed_at) : undefined,
    reviewed_by: latestApproval?.reviewed_by ? String(latestApproval.reviewed_by) : undefined,
    rejection_reason: latestApproval?.rejection_reason ? String(latestApproval.rejection_reason) : undefined,
    name: String(app.name ?? ""),
    category: String(app.category ?? ""),
    supported_chains: Array.isArray(app.supported_chains) ? app.supported_chains : [],
    permissions: (app.permissions as Record<string, unknown>) || {},
    approval_history: approvalHistory,
  };

  return json(response, {}, req);
}

if (import.meta.main) {
  Deno.serve(handler);
}
