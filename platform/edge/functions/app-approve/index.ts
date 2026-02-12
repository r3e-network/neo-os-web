// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";

// Deno global type definitions
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response>): void;
};

import { handleCorsPreflight } from "../_shared/cors.ts";
import { getChainConfig } from "../_shared/chains.ts";
import { normalizeUInt160 } from "../_shared/hex.ts";
import { mustGetEnv } from "../_shared/env.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError, notFoundError } from "../_shared/error-codes.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { requireScope } from "../_shared/scopes.ts";
import { requireAuth, supabaseServiceClient } from "../_shared/supabase.ts";
import { invokeTxProxy } from "../_shared/txproxy.ts";

type AppApprovalRequest = {
  app_id: string;
  action: "approve" | "reject" | "disable";
  reason?: string;
};

type AppApprovalResponse = {
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

// Helper: Check if user is an admin
async function requireAdmin(userId: string, req: Request): Promise<Response | null> {
  const adminEmails = Deno.env.get("ADMIN_EMAILS");
  if (!adminEmails) {
    return errorResponse("SERVER_001", { message: "admin configuration missing" }, req);
  }

  const supabase = supabaseServiceClient();
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("email, role")
    .eq("id", userId)
    .maybeSingle();

  if (userError || !user) {
    return errorResponse("AUTH_001", { message: "user not found" }, req);
  }

  const allowedEmails = adminEmails.split(",").map((e) => e.trim().toLowerCase());
  const userEmail = String(user.email ?? "").toLowerCase();
  const userRole = String(user.role ?? "").toLowerCase();

  if (userRole !== "admin" && !allowedEmails.includes(userEmail)) {
    return errorResponse("AUTH_004", { message: "admin access required" }, req);
  }

  return null;
}

// Helper: Map action to status (matching miniapp_registry status enum)
function actionToStatus(action: string): string {
  switch (action) {
    case "approve":
      return "approved";
    case "reject":
      return "suspended"; // Use suspended for rejected apps
    case "disable":
      return "suspended";
    default:
      return "pending_review";
  }
}

// Helper: Validate transition is allowed
function validateTransition(fromStatus: string, toStatus: string): boolean {
  const from = fromStatus.toLowerCase();
  const to = toStatus.toLowerCase();

  // Can approve: draft/pending_review/suspended -> approved
  if (to === "approved") {
    return from === "draft" || from === "pending_review" || from === "suspended";
  }

  // Can suspend/reject: any status -> suspended
  if (to === "suspended") {
    return true;
  }

  return false;
}

// Helper: Convert status to contract enum (AppStatus in contract)
function statusToContractEnum(status: string): number {
  switch (status.toLowerCase()) {
    case "pending_review":
    case "draft":
      return 0; // Pending
    case "approved":
    case "published":
      return 1; // Approved
    case "suspended":
    case "archived":
      return 2; // Disabled
    default:
      return 0;
  }
}

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return errorResponse("METHOD_NOT_ALLOWED", undefined, req);

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;
  const rl = await requireRateLimit(req, "app-approve", auth);
  if (rl) return rl;

  // Admin scope check - can be configured
  const scopeCheck = requireScope(req, auth, "admin");
  if (scopeCheck) {
    // If admin scope doesn't exist, check admin emails
    const adminCheck = await requireAdmin(auth.userId, req);
    if (adminCheck) return adminCheck;
  }

  let body: AppApprovalRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse("BAD_JSON", undefined, req);
  }

  // Validate request
  const appId = String(body?.app_id ?? "").trim();
  if (!appId) {
    return validationError("app_id", "app_id is required", req);
  }

  const action = String(body?.action ?? "")
    .trim()
    .toLowerCase();
  if (!["approve", "reject", "disable"].includes(action)) {
    return validationError("action", "action must be: approve, reject, or disable", req);
  }

  const reason = body?.reason ? String(body.reason).trim() : undefined;
  if (action === "reject" && !reason) {
    return validationError("reason", "reason is required for rejection", req);
  }

  const newStatus = actionToStatus(action);
  const requestId = crypto.randomUUID();

  const supabase = supabaseServiceClient();

  // Load current app state
  const { data: app, error: loadError } = await supabase
    .from("miniapp_registry")
    .select("*")
    .eq("app_id", appId)
    .maybeSingle();

  if (loadError) {
    return errorResponse("SERVER_002", { message: `database error: ${loadError.message}` }, req);
  }

  if (!app) {
    return notFoundError("app", req);
  }

  const previousStatus = String(app.status ?? "draft").toLowerCase();

  // Validate status transition
  if (!validateTransition(previousStatus, newStatus)) {
    return errorResponse(
      "VAL_007",
      {
        message: `cannot transition from ${previousStatus} to ${newStatus}`,
        from_status: previousStatus,
        to_status: newStatus,
      },
      req
    );
  }

  // Get chain configuration for on-chain update
  const supportedChains = Array.isArray(app.supported_chains) ? app.supported_chains : [];
  const primaryChain = supportedChains.length > 0 ? supportedChains[0] : "neo-n3-testnet";
  const chain = getChainConfig(primaryChain);

  let chainTxId: string | undefined;

  // Update on-chain registry if chain is configured
  if (chain && chain.type === "neo-n3") {
    try {
      const appRegistryAddress = chain.contracts?.app_registry || mustGetEnv("CONTRACT_APP_REGISTRY_ADDRESS");
      const appRegistryHash = normalizeUInt160(appRegistryAddress);

      const contractEnum = statusToContractEnum(newStatus);

      const txResult = await invokeTxProxy(
        {
          baseUrl: mustGetEnv("TXPROXY_URL"),
          serviceId: mustGetEnv("SERVICE_ID"),
          contractAddress: appRegistryHash,
          method: "setStatus",
          params: [
            { type: "String", value: appId },
            { type: "Integer", value: contractEnum },
          ],
          signers: [],
          extraWitnesses: [],
        },
        { requestId, req },
        false
      );

      if (txResult instanceof Response) return txResult;

      if (typeof txResult === "object" && "success" in txResult && txResult.success && txResult.tx_id) {
        chainTxId = txResult.tx_id;
      }
    } catch (e: unknown) {
      // Log error but don't fail - allow database update to proceed
      console.warn(`[app-approve] On-chain update failed for ${appId}:`, e);
    }
  }

  // Update database
  const { error: updateError } = await supabase
    .from("miniapp_registry")
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("app_id", appId);

  if (updateError) {
    return errorResponse("SERVER_002", { message: `failed to update app: ${updateError.message}` }, req);
  }

  // Record approval audit
  const { error: auditError } = await supabase.from("miniapp_approvals").insert({
    app_id: appId,
    action: action,
    previous_status: previousStatus,
    new_status: newStatus,
    reviewed_by: auth.userId,
    reviewed_at: new Date().toISOString(),
    rejection_reason: action === "reject" ? reason : null,
    chain_tx_id: chainTxId,
    request_id: requestId,
  });

  if (auditError) {
    console.warn(`[app-approve] Failed to record audit for ${appId}:`, auditError);
  }

  // Send notification to developer (if we can find their user_id)
  try {
    // Try to find the developer's user_id through linked_neo_accounts
    const { data: linkedAccounts } = await supabase
      .from("linked_neo_accounts")
      .select(
        `
        neohub_account_id
      `
      )
      .eq("address", app.developer_address)
      .limit(1);

    if (linkedAccounts && linkedAccounts.length > 0) {
      const neohubAccountId = linkedAccounts[0].neohub_account_id;

      // Find user_id from neohub_accounts
      const { data: neohubAccounts } = await supabase
        .from("neohub_accounts")
        .select("id")
        .eq("id", neohubAccountId)
        .limit(1);

      if (neohubAccounts && neohubAccounts.length > 0) {
        const developerUserId = neohubAccounts[0].id;

        const title =
          action === "approve"
            ? `MiniApp "${appId}" Approved`
            : action === "reject"
              ? `MiniApp "${appId}" Rejected`
              : `MiniApp "${appId}" Disabled`;

        const content =
          action === "approve"
            ? `Your MiniApp "${appId}" has been approved and is now live on the platform.`
            : action === "reject"
              ? `Your MiniApp "${appId}" has been rejected. Reason: ${reason}`
              : `Your MiniApp "${appId}" has been disabled by platform admin.`;

        await supabase.from("notifications").insert({
          user_id: developerUserId,
          title,
          content,
          notification_type: "miniapp_approval",
          priority: action === "reject" ? "high" : "normal",
          metadata: {
            app_id: appId,
            action,
            previous_status: previousStatus,
            new_status: newStatus,
          },
        });
      }
    }
  } catch (e: unknown) {
    console.warn(`[app-approve] Failed to send notification for ${appId}:`, e);
  }

  const response: AppApprovalResponse = {
    request_id: requestId,
    app_id: appId,
    action: action,
    previous_status: previousStatus,
    new_status: newStatus,
    reviewed_by: auth.userId,
    reviewed_at: new Date().toISOString(),
    reason,
    chainTxId,
  };

  return json(response, {}, req);
}

if (import.meta.main) {
  Deno.serve(handler);
}
