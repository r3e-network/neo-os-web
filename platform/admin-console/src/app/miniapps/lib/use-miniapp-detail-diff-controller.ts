import { useCallback, useMemo } from "react";
import type { MiniAppPublishRequest, MiniAppVersionSummary } from "@/lib/hooks/useMiniApps";
import { diffEntriesToCsv, diffVersionPayload, filterDiffEntries, summarizeDiff, type VersionDiffEntry } from "@/lib/version-diff";
import { downloadTextFile, triggerDownloadHref } from "./download-utils";

type DiffScope = "all" | "manifest" | "operations" | "layout" | "admin";
type PublishRequestStatus = "all" | "pending" | "approved" | "rejected" | "applied" | "cancelled";

type VersionsQueryData = {
  versions?: MiniAppVersionSummary[];
  releases?: {
    published?: string | null;
  };
};

type PublishRequestsQueryData = {
  requests?: MiniAppPublishRequest[];
};

type Props = {
  versionsQueryData: VersionsQueryData | undefined;
  publishRequestsQueryData: PublishRequestsQueryData | undefined;
  publishDetailRequestId: string | null;
  selectedDiffVersionId: string | null;
  diffScope: DiffScope;
  selectedAppId?: string;
  publishRequestStatus: PublishRequestStatus;
};

function filterDiffEntriesByScope(entries: VersionDiffEntry[], diffScope: DiffScope): VersionDiffEntry[] {
  if (diffScope === "all") return entries;
  if (diffScope === "manifest") {
    return filterDiffEntries(entries, { includePaths: ["manifest"] });
  }
  if (diffScope === "operations") {
    return filterDiffEntries(entries, {
      includePaths: ["manifest.operations", "operations"],
    });
  }
  if (diffScope === "layout") {
    return filterDiffEntries(entries, {
      includePaths: ["manifest.detail_template", "manifest.page_template", "detail_template", "page_template"],
    });
  }
  return filterDiffEntries(entries, { includePaths: ["manifest.admin", "admin"] });
}

export function useMiniAppDetailDiffController({
  versionsQueryData,
  publishRequestsQueryData,
  publishDetailRequestId,
  selectedDiffVersionId,
  diffScope,
  selectedAppId,
  publishRequestStatus,
}: Props) {
  const versions = useMemo(() => versionsQueryData?.versions || [], [versionsQueryData]);

  const selectedPublishRequest = useMemo(
    () => publishRequestsQueryData?.requests?.find((request) => request.id === publishDetailRequestId) || null,
    [publishRequestsQueryData, publishDetailRequestId],
  );

  const selectedDiffVersion = useMemo(
    () => versions.find((item) => item.id === selectedDiffVersionId) || null,
    [versions, selectedDiffVersionId],
  );

  const previousDiffVersion = useMemo(() => {
    if (!selectedDiffVersion) return null;
    const selectedDiffIndex = versions.findIndex((item) => item.id === selectedDiffVersion.id);
    if (selectedDiffIndex < 0 || selectedDiffIndex + 1 >= versions.length) return null;
    return versions[selectedDiffIndex + 1];
  }, [versions, selectedDiffVersion]);

  const rawDiffEntries: VersionDiffEntry[] = useMemo(() => {
    if (!selectedDiffVersion || !previousDiffVersion) return [];
    return diffVersionPayload(
      previousDiffVersion.row_snapshot || previousDiffVersion.manifest,
      selectedDiffVersion.row_snapshot || selectedDiffVersion.manifest,
    );
  }, [previousDiffVersion, selectedDiffVersion]);

  const diffEntries = useMemo(
    () => filterDiffEntriesByScope(rawDiffEntries, diffScope),
    [rawDiffEntries, diffScope],
  );

  const diffSummary = useMemo(() => summarizeDiff(diffEntries), [diffEntries]);

  const exportCurrentDiffCsv = useCallback(() => {
    downloadTextFile(
      diffEntriesToCsv(diffEntries),
      `miniapp-diff-${selectedDiffVersion?.version_no || "latest"}.csv`,
      "text/csv;charset=utf-8",
    );
  }, [diffEntries, selectedDiffVersion]);

  const exportPublishRequestsCsv = useCallback(() => {
    const params = new URLSearchParams();
    if (selectedAppId) {
      params.set("app_id", selectedAppId);
    }
    if (publishRequestStatus !== "all") {
      params.set("status", publishRequestStatus);
    }

    triggerDownloadHref(`/api/miniapps/publish-requests/export?${params.toString()}`);
  }, [selectedAppId, publishRequestStatus]);

  return {
    versions,
    selectedPublishRequest,
    selectedDiffVersion,
    previousDiffVersion,
    diffEntries,
    diffSummary,
    exportCurrentDiffCsv,
    exportPublishRequestsCsv,
    publishedVersionId: versionsQueryData?.releases?.published || null,
  };
}
