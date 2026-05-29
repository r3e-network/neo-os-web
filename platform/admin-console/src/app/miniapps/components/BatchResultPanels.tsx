"use client";

import { Boxes, RotateCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/Table";
import type {
  MiniAppBatchImportResult,
  MiniAppBatchRollbackResult,
} from "@/lib/hooks/useMiniApps";

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

export function BatchResultPanels({
  batchImportResult,
  batchRollbackResult,
}: Props) {
  const batchImportRows = (batchImportResult?.results || []).map(
    (item, index) => {
      const row = asObject(item);
      const version = asObject(row.version);
      const versionNo = asString(version.version_no);
      const releaseChannel = asString(version.release_channel);
      const detailSegments = [
        asString(row.error),
        asString(row.detail),
        versionNo
          ? `version #${versionNo}${releaseChannel ? ` (${releaseChannel})` : ""}`
          : "",
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
    },
  );

  const batchRollbackRows = (batchRollbackResult?.results || []).map(
    (item, index) => {
      const row = asObject(item);
      return {
        key: `${asString(row.app_id) || "rollback"}-${index}`,
        appId: asString(row.app_id) || "-",
        status: asString(row.status) || "-",
        detail: asString(row.detail) || "-",
      };
    },
  );

  return (
    <>
      {batchImportResult && (
        <Card
          className="batch-import-result-card batch-import-result-shell overflow-hidden"
          variant="default"
        >
          <CardHeader className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary-100 bg-primary-50 text-primary-700">
                  <Boxes className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <CardTitle>
                    Batch Import Details ({batchImportResult.summary.total} item
                    {batchImportResult.summary.total === 1 ? "" : "s"})
                  </CardTitle>
                  <p className="mt-1 text-sm text-gray-500">
                    Inspect every imported definition before publishing wider
                    fleet changes.
                  </p>
                </div>
              </div>
              <Badge variant={batchImportResult.success ? "success" : "danger"}>
                {batchImportResult.success ? "success" : "needs review"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 bg-gray-50">
            <div
              aria-label="Batch import summary"
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600"
            >
              Success: {batchImportResult.success ? "yes" : "no"} | Dry run:{" "}
              {batchImportResult.dry_run ? "yes" : "no"} | Imported{" "}
              {batchImportResult.summary.imported} | Validated{" "}
              {batchImportResult.summary.validated} | Failed{" "}
              {batchImportResult.summary.failed}
            </div>
            {!batchImportRows.length ? (
              <p className="text-xs text-gray-500">No per-file records returned.</p>
            ) : (
              <div className="max-h-64 overflow-auto rounded-xl border border-gray-200 bg-white">
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
                        <TableCell className="font-mono text-xs">
                          {row.index}
                        </TableCell>
                        <TableCell className="text-xs">
                          {row.fileName}
                        </TableCell>
                        <TableCell className="font-mono text-xs">
                          {row.appId}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              row.status === "failed"
                                ? "danger"
                                : row.status === "imported" ||
                                    row.status === "validated"
                                  ? "success"
                                  : "default"
                            }
                          >
                            {row.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs">
                          {row.mode}/{row.action}
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

      {batchRollbackResult && (
        <Card
          className="batch-rollback-result-card batch-rollback-result-shell overflow-hidden"
          variant="default"
        >
          <CardHeader className="space-y-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-700">
                  <RotateCcw className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <CardTitle>
                    Batch Rollback Details ({batchRollbackResult.summary.total}{" "}
                    target
                    {batchRollbackResult.summary.total === 1 ? "" : "s"})
                  </CardTitle>
                  <p className="mt-1 text-sm text-gray-500">
                    Confirm rollback results and failed targets without losing
                    item-level context.
                  </p>
                </div>
              </div>
              <Badge
                variant={batchRollbackResult.success ? "success" : "danger"}
              >
                {batchRollbackResult.success ? "success" : "needs review"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 bg-gray-50">
            <div
              aria-label="Batch rollback summary"
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs text-gray-600"
            >
              Success: {batchRollbackResult.success ? "yes" : "no"} | Rolled
              back {batchRollbackResult.summary.rolled_back} | Disabled created
              apps {batchRollbackResult.summary.disabled_created_app} | Failed{" "}
              {batchRollbackResult.summary.failed}
            </div>
            {!batchRollbackRows.length ? (
              <p className="text-xs text-gray-500">No rollback item records returned.</p>
            ) : (
              <div className="max-h-56 overflow-auto rounded-xl border border-gray-200 bg-white">
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
                        <TableCell className="font-mono text-xs">
                          {row.appId}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              row.status === "failed"
                                ? "danger"
                                : row.status === "rolled_back" ||
                                    row.status === "disabled_created_app"
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
