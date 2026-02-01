// =============================================================================
// Types for Distributed MiniApp Admin UI
// =============================================================================

/**
 * External submission status workflow
 */
export type SubmissionStatus =
  | "pending_review"
  | "approved"
  | "rejected"
  | "update_requested"
  | "building"
  | "published"
  | "build_failed";

/**
 * Approval action types
 */
export type ApprovalAction = "approve" | "reject" | "request_changes";

/**
 * External developer submission
 */
export interface MiniAppSubmission {
  id: string;
  app_id: string;
  git_url: string;
  git_host: string;
  repo_owner: string;
  repo_name: string;
  subfolder: string | null;
  branch: string;
  git_commit_sha: string | null;
  git_commit_message: string | null;
  git_committer: string | null;
  git_committed_at: string | null;
  manifest: Record<string, unknown>;
  manifest_hash: string;
  assets_detected: {
    manifest?: boolean;
    icon?: string[];
    banner?: string[];
    screenshot?: string[];
  };
  build_config: {
    type: "vite" | "webpack" | "uniapp" | "nextjs" | "vanilla" | "unknown";
    buildCommand: string;
    outputDir: string;
    packageManager: "npm" | "pnpm" | "yarn";
  };
  status: SubmissionStatus;
  submitted_by: string;
  submitted_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  build_started_at: string | null;
  built_at: string | null;
  built_by: string | null;
  cdn_base_url: string | null;
  cdn_version_path: string | null;
  assets_selected: {
    icon?: string;
    banner?: string;
  } | null;
  build_log: string | null;
  last_error: string | null;
  error_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Internal (pre-built) miniapp
 */
export interface InternalMiniApp {
  id: string;
  app_id: string;
  git_url: string;
  subfolder: string;
  branch: string;
  manifest: Record<string, unknown>;
  entry_url: string;
  icon_url: string | null;
  banner_url: string | null;
  category: string;
  status: string;
  manifest_hash: string;
  current_version: string;
  created_at: string;
  updated_at: string;
}

/**
 * Unified registry entry (for host app)
 */
export interface RegistryEntry {
  app_id: string;
  name: string;
  name_zh?: string;
  description: string;
  description_zh?: string;
  icon: string;
  banner: string;
  entry_url: string;
  category: string;
  version: string;
  source_type: "external" | "internal";
  status: string;
  updated_at: string;
}

/**
 * Sync result for internal miniapps
 */
export interface SyncResult {
  synced: number;
  updated: number;
  failed: number;
  miniapps: Array<{
    app_id: string;
    status: string;
    action: "created" | "updated" | "skipped";
  }>;
}

/**
 * API response for submissions list
 */
export interface SubmissionsListResponse {
  apps: MiniAppSubmission[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Approval request
 */
export interface ApprovalRequest {
  submission_id: string;
  action: ApprovalAction;
  trigger_build?: boolean;
  review_notes?: string;
}

/**
 * Build request
 */
export interface BuildRequest {
  submission_id: string;
}

/**
 * Build response
 */
export interface BuildResponse {
  success: boolean;
  build_id: string;
  status: string;
  cdn_url?: string;
  error?: string;
}

/**
 * Approval response
 */
export interface ApprovalResponse {
  success: boolean;
  submission_id: string;
  status: string;
  message: string;
}
