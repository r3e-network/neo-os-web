"use client";

import { diffVersionPayload, summarizeDiff } from "@/lib/version-diff";
import type {
  MiniAppPublishRequest,
  MiniAppVersionSummary,
} from "@/lib/hooks/useMiniApps";

type Props = {
  selectedPublishRequest: MiniAppPublishRequest | null;
  versions: MiniAppVersionSummary[];
  publishedVersionId: string | null;
};

export function PublishRequestDiffPanel({
  selectedPublishRequest,
  versions,
  publishedVersionId,
}: Props) {
  if (!selectedPublishRequest) return null;

  const requestedVersion =
    versions.find(
      (version) => version.id === selectedPublishRequest.requested_version_id,
    ) || null;
  const publishedVersion =
    versions.find((version) => version.id === publishedVersionId) || null;

  if (!requestedVersion || !publishedVersion) {
    return (
      <p className="text-xs text-gray-500">
        Unable to render request diff (requested/published version snapshot
        unavailable).
      </p>
    );
  }

  const entries = diffVersionPayload(
    publishedVersion.row_snapshot || publishedVersion.manifest,
    requestedVersion.row_snapshot || requestedVersion.manifest,
  );
  const summary = summarizeDiff(entries);

  return (
    <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-3">
      <p className="mb-2 text-xs font-semibold text-gray-700">
        Request Diff: Published v{publishedVersion.version_no} {"->"} Requested
        v{requestedVersion.version_no}
      </p>
      <p className="mb-2 text-[11px] text-gray-500">
        Total {summary.total} | Added {summary.added} | Removed{" "}
        {summary.removed} | Changed {summary.changed}
      </p>
      {!entries.length ? (
        <p className="text-xs text-gray-500">No differences found.</p>
      ) : (
        <div className="max-h-48 overflow-auto rounded-xl border border-gray-200 bg-white divide-y divide-gray-200">
          {entries.slice(0, 200).map((entry, idx) => (
            <div key={`${entry.path}-${idx}`} className="px-2 py-1 text-[11px]">
              <span className="font-mono text-gray-700">
                {entry.path || "(root)"}
              </span>
              <span className="ml-2 text-gray-500">{entry.kind}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
