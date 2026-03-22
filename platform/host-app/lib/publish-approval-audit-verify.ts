import { createHash } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

type Dict = Record<string, unknown>;

export type PublishApprovalAuditVerifyIssue = {
  request_id: string;
  id: string;
  type: "prev_hash_mismatch" | "chain_hash_mismatch";
  expected_prev_hash?: string | null;
  actual_prev_hash?: string | null;
  expected_chain_hash?: string;
  actual_chain_hash?: string;
};

export type PublishApprovalAuditVerifyResult = {
  ok: boolean;
  scanned: number;
  requests: number;
  total_events: number;
  invalid_hash_events: number;
  chain_break_events: number;
  table_missing: boolean;
  generated_at: string;
  issues: PublishApprovalAuditVerifyIssue[];
};

type AuditRow = {
  id: string;
  request_id: string;
  app_id: string;
  actor: string;
  action: string;
  status: string;
  payload: unknown;
  prev_hash: string | null;
  chain_hash: string;
  created_at: string;
};

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value !== "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  const obj = value as Dict;
  const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(obj[key])}`).join(",")}}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isTableMissing(errorMessage: string): boolean {
  const message = String(errorMessage || "").toLowerCase();
  return message.includes("does not exist") || message.includes("relation") && message.includes("miniapp_publish_request_audit");
}

function computeExpectedChainHash(row: AuditRow, prevHash: string | null): string {
  const payload = row.payload && typeof row.payload === "object" && !Array.isArray(row.payload)
    ? row.payload as Dict
    : {};

  const base = stableStringify({
    request_id: row.request_id,
    app_id: row.app_id,
    actor: row.actor,
    action: row.action,
    status: row.status,
    payload,
    prev_hash: prevHash,
  });
  return sha256(base);
}

export async function verifyPublishApprovalAuditChain(
  supabase: SupabaseClient,
  options: {
    appId?: string;
    requestId?: string;
    limit?: number;
  } = {},
): Promise<PublishApprovalAuditVerifyResult> {
  const limit = Math.max(1, Math.min(Number(options.limit || 1000), 5000));

  let query = supabase
    .from("miniapp_publish_request_audit")
    .select("id,request_id,app_id,actor,action,status,payload,prev_hash,chain_hash,created_at")
    .order("request_id", { ascending: true })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(limit);

  if (options.appId) {
    query = query.eq("app_id", options.appId);
  }
  if (options.requestId) {
    query = query.eq("request_id", options.requestId);
  }

  const { data, error } = await query;
  if (error) {
    const tableMissing = isTableMissing(error.message);
    return {
      ok: false,
      scanned: 0,
      requests: 0,
      total_events: 0,
      invalid_hash_events: 0,
      chain_break_events: 0,
      table_missing: tableMissing,
      generated_at: new Date().toISOString(),
      issues: tableMissing
        ? []
        : [
            {
              request_id: "",
              id: "",
              type: "chain_hash_mismatch",
              expected_chain_hash: "query_failed",
              actual_chain_hash: error.message,
            },
          ],
    };
  }

  const rows = Array.isArray(data) ? data as AuditRow[] : [];
  const byRequest = new Map<string, AuditRow[]>();
  for (const row of rows) {
    const key = String(row.request_id || "");
    if (!byRequest.has(key)) byRequest.set(key, []);
    byRequest.get(key)?.push(row);
  }

  const issues: PublishApprovalAuditVerifyIssue[] = [];
  let totalEvents = 0;
  let invalidHashEvents = 0;
  let chainBreakEvents = 0;

  for (const [requestId, events] of byRequest.entries()) {
    let previousHash: string | null = null;
    for (const event of events) {
      totalEvents += 1;

      const prevHash = event.prev_hash || null;
      if (prevHash !== previousHash) {
        chainBreakEvents += 1;
        issues.push({
          request_id: requestId,
          id: event.id,
          type: "prev_hash_mismatch",
          expected_prev_hash: previousHash,
          actual_prev_hash: prevHash,
        });
      }

      const expectedHash = computeExpectedChainHash(event, prevHash);
      if (expectedHash !== event.chain_hash) {
        invalidHashEvents += 1;
        issues.push({
          request_id: requestId,
          id: event.id,
          type: "chain_hash_mismatch",
          expected_chain_hash: expectedHash,
          actual_chain_hash: event.chain_hash,
        });
      }

      previousHash = event.chain_hash;
    }
  }

  return {
    ok: invalidHashEvents === 0 && chainBreakEvents === 0,
    scanned: rows.length,
    requests: byRequest.size,
    total_events: totalEvents,
    invalid_hash_events: invalidHashEvents,
    chain_break_events: chainBreakEvents,
    table_missing: false,
    generated_at: new Date().toISOString(),
    issues: issues.slice(0, 100),
  };
}
