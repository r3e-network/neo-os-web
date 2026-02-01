export function buildSubmissionPayload(input: {
  gitUrl: string;
  gitInfo: { host: string; owner: string; name: string };
  branch: string;
  subfolder?: string;
  commitInfo: { sha: string; message: string; author: string; date: string };
  appId: string;
  manifest: Record<string, unknown>;
  manifestHash: string;
  assets: Record<string, unknown>;
  buildConfig: Record<string, unknown>;
  autoApproved: boolean;
  submittedBy?: string | null;
}): Record<string, unknown> {
  const buildMode = input.autoApproved ? "platform" : "manual";
  return {
    git_url: input.gitUrl,
    git_host: input.gitInfo.host,
    repo_owner: input.gitInfo.owner,
    repo_name: input.gitInfo.name,
    subfolder: input.subfolder || null,
    branch: input.branch,
    git_commit_sha: input.commitInfo.sha,
    git_commit_message: input.commitInfo.message,
    git_committer: input.commitInfo.author,
    git_committed_at: input.commitInfo.date,
    app_id: input.appId,
    manifest: input.manifest,
    manifest_hash: input.manifestHash,
    assets_detected: input.assets,
    build_config: input.buildConfig,
    status: input.autoApproved ? "building" : "pending_review",
    build_mode: buildMode,
    submitted_by: input.submittedBy ?? null,
  };
}
