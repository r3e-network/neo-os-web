"use client";

import { diffVersionPayload, summarizeDiff } from "@/lib/version-diff";
import type { MiniAppPublishRequest, MiniAppVersionSummary } from "@/lib/hooks/useMiniApps";

type Props = {
  selectedPublishRequest: MiniAppPublishRequest | null;
  versions: MiniAppVersionSummary[];
  publishedVersionId: string | null;
};

export function PublishRequestDiffPanel({ selectedPublishRequest, versions, publishedVersionId }: Props) {
  if (!selectedPublishRequest) return null;

  const requestedVersion = versions.find((version) => version.id === selectedPublishRequest.requested_version_id) || null;
  const publishedVersion = versions.find((version) => version.id === publishedVersionId) || null;

  if (!requestedVersion || !publishedVersion) {
    return (
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Unable to render request diff (requested/published version snapshot unavailable).
      </p>
    );
  }

  const entries = diffVersionPayload(
    publishedVersion.row_snapshot || publishedVersion.manifest,
    requestedVersion.row_snapshot || requestedVersion.manifest,
  );
  const summary = summarizeDiff(entries);

  return (
    <div className="mt-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
      <p className="mb-2 text-xs text-gray-600 dark:text-gray-300">
        Request Diff: Published v{publishedVersion.version_no} {"->"} Requested v{requestedVersion.version_no}
      </p>
      <p className="mb-2 text-[11px] text-gray-500 dark:text-gray-400">
        Total {summary.total} | Added {summary.added} | Removed {summary.removed} | Changed {summary.changed}
      </p>
      {!entries.length ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">No differences found.</p>
      ) : (
        <div className="max-h-48 overflow-auto rounded border border-gray-100 divide-y dark:border-gray-800 dark:divide-gray-800">
          {entries.slice(0, 200).map((entry, idx) => (
            <div key={`${entry.path}-${idx}`} className="px-2 py-1 text-[11px]">
              <span className="font-mono text-gray-700 dark:text-gray-300">{entry.path || "(root)"}</span>
              <span className="ml-2 text-gray-500 dark:text-gray-400">{entry.kind}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
