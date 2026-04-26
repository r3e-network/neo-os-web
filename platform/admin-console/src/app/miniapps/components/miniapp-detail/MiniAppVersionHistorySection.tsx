"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { formatDate, truncate } from "@/lib/utils";
import type { MiniAppVersionSummary } from "@/lib/hooks/useMiniApps";
import type { VersionDiffEntry } from "@/lib/version-diff";
import type {
  DiffScope,
  DiffSummary,
  VersionChannel,
  VersionsQueryLike,
} from "./types";

type Props = {
  versionChannel: VersionChannel;
  onVersionChannelChange: (value: VersionChannel) => void;
  versionError: string;
  versionsQuery: VersionsQueryLike;
  selectedDiffVersion: MiniAppVersionSummary | null;
  previousDiffVersion: MiniAppVersionSummary | null;
  diffScope: DiffScope;
  onDiffScopeChange: (value: DiffScope) => void;
  diffSummary: DiffSummary;
  diffEntries: VersionDiffEntry[];
  onExportCurrentDiffCsv: () => void;
  onCloseDiff: () => void;
  onSelectDiffVersion: (versionId: string) => void;
  onRollbackVersion: (version: MiniAppVersionSummary) => void;
  rollbackPending: boolean;
};

export function MiniAppVersionHistorySection({
  versionChannel,
  onVersionChannelChange,
  versionError,
  versionsQuery,
  selectedDiffVersion,
  previousDiffVersion,
  diffScope,
  onDiffScopeChange,
  diffSummary,
  diffEntries,
  onExportCurrentDiffCsv,
  onCloseDiff,
  onSelectDiffVersion,
  onRollbackVersion,
  rollbackPending,
}: Props) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">
          Version History
        </h4>
        <div className="flex items-center gap-2">
          <select
            id="version-channel-filter"
            className="cursor-pointer rounded-md border border-gray-300 p-1.5 text-xs transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
            value={versionChannel}
            onChange={(event) =>
              onVersionChannelChange(event.target.value as VersionChannel)
            }
            aria-label="Version channel filter"
          >
            <option value="all">All</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </div>

      {versionError && (
        <p className="mb-2 text-xs text-danger-600 dark:text-danger-400">
          {versionError}
        </p>
      )}

      {versionsQuery.isLoading ? (
        <Spinner />
      ) : versionsQuery.isError ? (
        <p className="text-xs text-danger-600 dark:text-danger-400">
          {versionsQuery.error instanceof Error
            ? versionsQuery.error.message
            : "Failed to load version history"}
        </p>
      ) : !versionsQuery.data?.versions.length ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          No versions yet.
        </p>
      ) : (
        <div className="divide-y rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
          {versionsQuery.data.versions.map((version) => (
            <div
              key={version.id}
              className="flex items-center gap-3 px-3 py-2 text-xs"
            >
              <span className="font-medium">v{version.version_no}</span>
              <Badge
                variant={
                  version.release_channel === "published"
                    ? "success"
                    : "warning"
                }
              >
                {version.release_channel}
              </Badge>
              <span className="text-gray-500 dark:text-gray-400">
                {version.source_action}
              </span>
              <span className="text-gray-500 dark:text-gray-400">
                {formatDate(version.created_at)}
              </span>
              <span className="ml-auto flex items-center gap-2">
                <span className="font-mono text-[10px] text-gray-500 dark:text-gray-400">
                  {truncate(version.id, 14)}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onSelectDiffVersion(version.id)}
                >
                  Diff
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onRollbackVersion(version)}
                  disabled={rollbackPending}
                >
                  Rollback
                </Button>
              </span>
            </div>
          ))}
        </div>
      )}

      {selectedDiffVersion && previousDiffVersion && (
        <div className="mt-3 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <div className="mb-2 flex items-center justify-between">
            <h5 className="text-xs font-medium text-gray-600 dark:text-gray-300">
              Diff: v{previousDiffVersion.version_no} {"->"} v
              {selectedDiffVersion.version_no}
            </h5>
            <div className="flex items-center gap-2">
              <select
                id="diff-scope-filter"
                className="cursor-pointer rounded-md border border-gray-300 p-1 text-[11px] transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                value={diffScope}
                onChange={(event) =>
                  onDiffScopeChange(event.target.value as DiffScope)
                }
                aria-label="Diff scope"
              >
                <option value="all">All</option>
                <option value="manifest">Manifest</option>
                <option value="operations">Operations</option>
                <option value="layout">Layout</option>
                <option value="admin">Admin</option>
              </select>
              <Button
                size="sm"
                variant="ghost"
                onClick={onExportCurrentDiffCsv}
              >
                Export CSV
              </Button>
              <Button size="sm" variant="ghost" onClick={onCloseDiff}>
                Close Diff
              </Button>
            </div>
          </div>

          <p className="mb-2 text-[11px] text-gray-600 dark:text-gray-300">
            Total {diffSummary.total} | Added {diffSummary.added} | Removed{" "}
            {diffSummary.removed} | Changed {diffSummary.changed}
          </p>

          {!diffEntries.length ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              No differences found.
            </p>
          ) : (
            <div className="max-h-56 overflow-auto rounded border border-gray-100 divide-y dark:border-gray-800 dark:divide-gray-800">
              {diffEntries.slice(0, 200).map((entry, idx) => (
                <div
                  key={`${entry.path}-${idx}`}
                  className="px-2 py-1 text-[11px]"
                >
                  <span className="font-mono text-gray-700 dark:text-gray-300">
                    {entry.path || "(root)"}
                  </span>
                  <span className="ml-2 text-gray-500 dark:text-gray-400">
                    {entry.kind}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
