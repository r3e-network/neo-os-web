import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { logger } from "@/lib/logger";
import { stableStringify } from "../../shared/manifest";

type Dict = Record<string, unknown>;

export type PublishApprovalAuditEvent = {
  request_id: string;
  app_id: string;
  actor: string;
  action:
    | "request_created"
    | "request_approved"
    | "request_rejected"
    | "request_cancelled"
    | "request_applied"
    | "reminder_sent";
  status: string;
  payload?: Dict;
};

type AuditRow = {
  id: string;
  request_id: string;
  chain_hash: string;
  prev_hash: string | null;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

async function fetchLatestAudit(supabase: SupabaseClient, requestId: string): Promise<AuditRow | null> {
  const { data, error } = await supabase
    .from("miniapp_publish_request_audit")
    .select("id,request_id,chain_hash,prev_hash")
    .eq("request_id", requestId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.warn("publish approval audit latest fetch failed:", error.message);
    return null;
  }

  return (data as AuditRow | null) || null;
}

export async function appendPublishApprovalAuditEvent(
  supabase: SupabaseClient,
  event: PublishApprovalAuditEvent,
): Promise<void> {
  const prev = await fetchLatestAudit(supabase, event.request_id);
  const prevHash = prev?.chain_hash || null;

  const payload: Dict = event.payload || {};
  const base = stableStringify({
    request_id: event.request_id,
    app_id: event.app_id,
    actor: event.actor,
    action: event.action,
    status: event.status,
    payload,
    prev_hash: prevHash,
  });
  const chainHash = sha256(base);

  const { error } = await supabase.from("miniapp_publish_request_audit").insert({
    request_id: event.request_id,
    app_id: event.app_id,
    actor: event.actor,
    action: event.action,
    status: event.status,
    payload,
    prev_hash: prevHash,
    chain_hash: chainHash,
  });

  if (error) {
    logger.warn("publish approval audit append failed:", error.message);
  }
}
