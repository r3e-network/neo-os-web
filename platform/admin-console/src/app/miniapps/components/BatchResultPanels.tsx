"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import type { MiniAppBatchImportResult, MiniAppBatchRollbackResult } from "@/lib/hooks/useMiniApps";

type Props = {
  batchImportResult: MiniAppBatchImportResult | null;
  batchRollbackResult: MiniAppBatchRollbackResult | null;
};

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

export function BatchResultPanels({ batchImportResult, batchRollbackResult }: Props) {
  const batchImportRows = (batchImportResult?.results || []).map((item, index) => {
    const row = asObject(item);
    const version = asObject(row.version);
    const versionNo = asString(version.version_no);
    const releaseChannel = asString(version.release_channel);
    const detailSegments = [
      asString(row.error),
      asString(row.detail),
      versionNo ? `version #${versionNo}${releaseChannel ? ` (${releaseChannel})` : ""}` : "",
    ].filter(Boolean);

    return {
      key: `${asString(row.file_name) || "item"}-${index}`,
      index: asString(row.index) || String(index),
      fileName: asString(row.file_name) || "-",
      appId: asString(row.app_id) || "-",
      status: asString(row.status) || "-",
      mode: asString(row.mode) || "-",
      action: asString(row.action) || "-",
      detail: detailSegments[0] || "-",
    };
  });

  const batchRollbackRows = (batchRollbackResult?.results || []).map((item, index) => {
    const row = asObject(item);
    return {
      key: `${asString(row.app_id) || "rollback"}-${index}`,
      appId: asString(row.app_id) || "-",
      status: asString(row.status) || "-",
      detail: asString(row.detail) || "-",
    };
  });

  return (
    <>
      {batchImportResult && (
        <Card variant="glass">
          <CardHeader>
            <CardTitle>
              Batch Import Details ({batchImportResult.summary.total} item{batchImportResult.summary.total === 1 ? "" : "s"})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs text-gray-600 dark:text-gray-300">
              Success: {batchImportResult.success ? "yes" : "no"} | Dry run: {batchImportResult.dry_run ? "yes" : "no"} | Imported {batchImportResult.summary.imported} | Validated {batchImportResult.summary.validated} | Failed {batchImportResult.summary.failed}
            </div>
            {!batchImportRows.length ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">No per-file records returned.</p>
            ) : (
              <div className="max-h-64 overflow-auto rounded-md border border-gray-200 dark:border-gray-700">
                <Table aria-label="Batch import result rows">
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead>File</TableHead>
                      <TableHead>App ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Mode/Action</TableHead>
                      <TableHead>Detail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batchImportRows.map((row) => (
                      <TableRow key={row.key}>
                        <TableCell className="font-mono text-xs">{row.index}</TableCell>
                        <TableCell className="text-xs">{row.fileName}</TableCell>
                        <TableCell className="font-mono text-xs">{row.appId}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              row.status === "failed"
                                ? "danger"
                                : row.status === "imported" || row.status === "validated"
                                  ? "success"
                                  : "default"
                            }
                          >
                            {row.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{row.mode}/{row.action}</TableCell>
                        <TableCell className="text-xs">{row.detail}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {batchRollbackResult && (
        <Card variant="glass">
          <CardHeader>
            <CardTitle>
              Batch Rollback Details ({batchRollbackResult.summary.total} target{batchRollbackResult.summary.total === 1 ? "" : "s"})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs text-gray-600 dark:text-gray-300">
              Success: {batchRollbackResult.success ? "yes" : "no"} | Rolled back {batchRollbackResult.summary.rolled_back} | Disabled created apps {batchRollbackResult.summary.disabled_created_app} | Failed {batchRollbackResult.summary.failed}
            </div>
            {!batchRollbackRows.length ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">No rollback item records returned.</p>
            ) : (
              <div className="max-h-56 overflow-auto rounded-md border border-gray-200 dark:border-gray-700">
                <Table aria-label="Batch rollback result rows">
                  <TableHeader>
                    <TableRow>
                      <TableHead>App ID</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Detail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {batchRollbackRows.map((row) => (
                      <TableRow key={row.key}>
                        <TableCell className="font-mono text-xs">{row.appId}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              row.status === "failed"
                                ? "danger"
                                : row.status === "rolled_back" || row.status === "disabled_created_app"
                                  ? "success"
                                  : "default"
                            }
                          >
                            {row.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">{row.detail}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}
