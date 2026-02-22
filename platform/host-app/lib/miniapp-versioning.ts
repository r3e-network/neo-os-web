import type { SupabaseClient } from "@supabase/supabase-js";
import type { MiniAppUpsertRow, MiniAppAdminAction } from "@/lib/miniapp-admin";

type Json = Record<string, unknown>;

export type MiniAppVersionRecord = {
  id: string;
  app_id: string;
  version_no: number;
  source_action: MiniAppAdminAction | "rollback";
  release_channel: "draft" | "published";
  status: "active" | "pending" | "disabled";
  manifest_hash: string;
  actor: string;
  note: string | null;
  created_at: string;
  manifest?: Json;
  row_snapshot?: Json;
};

export type MiniAppVersionListResult = {
  app_id: string;
  release_channel: "all" | "draft" | "published";
  releases: {
    draft: string | null;
    published: string | null;
  };
  versions: MiniAppVersionRecord[];
};

type MiniAppAdminActionOrRollback = MiniAppAdminAction | "rollback";

type VersionRow = {
  id: string;
  app_id: string;
  version_no: number;
  source_action: MiniAppAdminActionOrRollback;
  release_channel: "draft" | "published";
  status: "active" | "pending" | "disabled";
  manifest_hash: string;
  manifest: Json;
  row_snapshot: Json;
  actor: string;
  note: string | null;
  created_at: string;
};

type ReleaseRow = {
  app_id: string;
  draft_version_id: string | null;
  published_version_id: string | null;
  updated_at: string;
};

function toAction(value: string): MiniAppAdminActionOrRollback {
  if (value === "publish" || value === "disable" || value === "save_draft" || value === "rollback") {
    return value;
  }
  return "save_draft";
}

function toReleaseChannel(action: MiniAppAdminActionOrRollback): "draft" | "published" {
  return action === "publish" || action === "rollback" ? "published" : "draft";
}

function asVersionRecord(row: VersionRow, includePayload = false): MiniAppVersionRecord {
  const record: MiniAppVersionRecord = {
    id: row.id,
    app_id: row.app_id,
    version_no: Number(row.version_no || 0),
    source_action: toAction(String(row.source_action || "save_draft")),
    release_channel: row.release_channel === "published" ? "published" : "draft",
    status: row.status === "active" ? "active" : row.status === "disabled" ? "disabled" : "pending",
    manifest_hash: String(row.manifest_hash || ""),
    actor: String(row.actor || "api_key"),
    note: row.note ?? null,
    created_at: String(row.created_at || ""),
  };

  if (includePayload) {
    record.manifest = row.manifest;
    record.row_snapshot = row.row_snapshot;
  }

  return record;
}

function toHistoryAction(action: MiniAppAdminActionOrRollback): "save_draft" | "publish" | "disable" | "rollback" {
  if (action === "publish" || action === "disable" || action === "rollback") return action;
  return "save_draft";
}

async function ensureReleaseRow(supabase: SupabaseClient, appId: string): Promise<ReleaseRow> {
  const { data: existing, error: fetchError } = await supabase
    .from("miniapp_releases")
    .select("app_id,draft_version_id,published_version_id,updated_at")
    .eq("app_id", appId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (existing) return existing as ReleaseRow;

  const { data: created, error: createError } = await supabase
    .from("miniapp_releases")
    .insert({ app_id: appId })
    .select("app_id,draft_version_id,published_version_id,updated_at")
    .single();

  if (createError || !created) throw createError || new Error("Failed to create miniapp release row");
  return created as ReleaseRow;
}

async function getNextVersionNo(supabase: SupabaseClient, appId: string): Promise<number> {
  const { data: latest, error } = await supabase
    .from("miniapp_versions")
    .select("version_no")
    .eq("app_id", appId)
    .order("version_no", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  const current = Number((latest as { version_no?: number } | null)?.version_no || 0);
  return current + 1;
}

function asMiniAppUpsertRow(value: unknown): MiniAppUpsertRow | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;

  const appId = String(row.app_id || "").trim();
  const entryUrl = String(row.entry_url || "").trim();
  const manifestHash = String(row.manifest_hash || "").trim();
  const manifest = row.manifest;

  if (!appId || !entryUrl || !manifestHash || !manifest || typeof manifest !== "object" || Array.isArray(manifest)) {
    return null;
  }

  return row as unknown as MiniAppUpsertRow;
}

export async function recordMiniAppVersion(
  supabase: SupabaseClient,
  params: {
    row: MiniAppUpsertRow;
    action: MiniAppAdminAction;
    actor: string;
    note?: string | null;
  },
): Promise<{ version: MiniAppVersionRecord; releases: ReleaseRow }> {
  const appId = params.row.app_id;
  const action = params.action;
  const actor = params.actor || "api_key";
  const note = params.note ?? null;

  const releases = await ensureReleaseRow(supabase, appId);
  const nextVersionNo = await getNextVersionNo(supabase, appId);
  const releaseChannel = toReleaseChannel(action);

  const insertPayload = {
    app_id: appId,
    version_no: nextVersionNo,
    source_action: action,
    release_channel: releaseChannel,
    status: params.row.status,
    manifest_hash: params.row.manifest_hash,
    manifest: params.row.manifest,
    row_snapshot: params.row as unknown as Json,
    actor,
    note,
  };

  const { data: inserted, error: insertError } = await supabase
    .from("miniapp_versions")
    .insert(insertPayload)
    .select("id,app_id,version_no,source_action,release_channel,status,manifest_hash,manifest,row_snapshot,actor,note,created_at")
    .single();

  if (insertError || !inserted) throw insertError || new Error("Failed to insert miniapp version");
  const version = inserted as VersionRow;

  const releasePatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (releaseChannel === "draft") {
    releasePatch.draft_version_id = version.id;
  }
  if (releaseChannel === "published") {
    releasePatch.published_version_id = version.id;
  }

  const { data: releaseUpdated, error: releaseError } = await supabase
    .from("miniapp_releases")
    .update(releasePatch)
    .eq("app_id", appId)
    .select("app_id,draft_version_id,published_version_id,updated_at")
    .single();

  if (releaseError || !releaseUpdated) throw releaseError || new Error("Failed to update miniapp release pointers");
  const nextReleases = releaseUpdated as ReleaseRow;

  const fromVersionId = releaseChannel === "draft"
    ? (releases.draft_version_id || null)
    : (releases.published_version_id || null);

  const { error: historyError } = await supabase
    .from("miniapp_release_history")
    .insert({
      app_id: appId,
      release_channel: releaseChannel,
      from_version_id: fromVersionId,
      to_version_id: version.id,
      action: toHistoryAction(action),
      actor,
      note,
    });

  if (historyError) throw historyError;

  return {
    version: asVersionRecord(version),
    releases: nextReleases,
  };
}

export async function listMiniAppVersions(
  supabase: SupabaseClient,
  params: {
    appId: string;
    releaseChannel?: "all" | "draft" | "published";
    limit?: number;
    includePayload?: boolean;
  },
): Promise<MiniAppVersionListResult> {
  const appId = params.appId;
  const releaseChannel = params.releaseChannel || "all";
  const limit = Math.max(1, Math.min(Number(params.limit || 50), 200));
  const includePayload = Boolean(params.includePayload);

  let query = supabase
    .from("miniapp_versions")
    .select("id,app_id,version_no,source_action,release_channel,status,manifest_hash,manifest,row_snapshot,actor,note,created_at")
    .eq("app_id", appId)
    .order("version_no", { ascending: false })
    .limit(limit);

  if (releaseChannel === "draft" || releaseChannel === "published") {
    query = query.eq("release_channel", releaseChannel);
  }

  const { data: versionsData, error: versionsError } = await query;
  if (versionsError) throw versionsError;

  const { data: releasesData, error: releasesError } = await supabase
    .from("miniapp_releases")
    .select("app_id,draft_version_id,published_version_id,updated_at")
    .eq("app_id", appId)
    .maybeSingle();

  if (releasesError) throw releasesError;

  const versions = Array.isArray(versionsData)
    ? versionsData.map((row) => asVersionRecord(row as VersionRow, includePayload))
    : [];

  const releases = releasesData as ReleaseRow | null;
  return {
    app_id: appId,
    release_channel: releaseChannel,
    releases: {
      draft: releases?.draft_version_id ?? null,
      published: releases?.published_version_id ?? null,
    },
    versions,
  };
}

export async function rollbackMiniAppVersion(
  supabase: SupabaseClient,
  params: {
    appId: string;
    versionId?: string;
    versionNo?: number;
    releaseChannel: "draft" | "published";
    actor: string;
    note?: string | null;
  },
): Promise<{
  row: MiniAppUpsertRow;
  targetVersion: MiniAppVersionRecord;
  newVersion: MiniAppVersionRecord;
  releases: ReleaseRow;
}> {
  const appId = params.appId;
  let query = supabase
    .from("miniapp_versions")
    .select("id,app_id,version_no,source_action,release_channel,status,manifest_hash,manifest,row_snapshot,actor,note,created_at")
    .eq("app_id", appId)
    .limit(1);

  if (params.versionId) {
    query = query.eq("id", params.versionId);
  } else if (typeof params.versionNo === "number") {
    query = query.eq("version_no", params.versionNo);
  }

  const { data: versionRows, error: versionError } = await query;
  if (versionError) throw versionError;

  const target = Array.isArray(versionRows) ? (versionRows[0] as VersionRow | undefined) : undefined;
  if (!target) {
    throw new Error("Target version not found");
  }

  const snapshot = (target.row_snapshot || {}) as Json;
  const row = asMiniAppUpsertRow(snapshot);
  if (!row) {
    throw new Error("Target version snapshot is invalid");
  }

  const normalizedStatus = params.releaseChannel === "published"
    ? (row.status === "disabled" ? "disabled" : "active")
    : "pending";

  const rowForRollback: MiniAppUpsertRow = {
    ...row,
    app_id: appId,
    status: normalizedStatus,
    manifest_hash: String(target.manifest_hash || row.manifest_hash),
    manifest: (target.manifest || row.manifest) as Record<string, unknown>,
  };

  const { data: releaseBefore, error: releaseBeforeError } = await supabase
    .from("miniapp_releases")
    .select("app_id,draft_version_id,published_version_id,updated_at")
    .eq("app_id", appId)
    .maybeSingle();

  if (releaseBeforeError) {
    throw releaseBeforeError;
  }

  const record = await recordMiniAppVersion(supabase, {
    row: rowForRollback,
    action: params.releaseChannel === "published" ? "publish" : "save_draft",
    actor: params.actor,
    note: params.note || `rollback from version ${target.version_no}`,
  });

  const releaseBeforeRow = releaseBefore as ReleaseRow | null;
  const previousVersionId = params.releaseChannel === "published"
    ? (releaseBeforeRow?.published_version_id || null)
    : (releaseBeforeRow?.draft_version_id || null);

  const { error: historyError } = await supabase
    .from("miniapp_release_history")
    .insert({
      app_id: appId,
      release_channel: params.releaseChannel,
      from_version_id: previousVersionId,
      to_version_id: record.version.id,
      action: "rollback",
      actor: params.actor,
      note: params.note || `rollback to version ${target.version_no}`,
    });

  if (historyError) throw historyError;

  return {
    row: rowForRollback,
    targetVersion: asVersionRecord(target),
    newVersion: record.version,
    releases: record.releases,
  };
}
