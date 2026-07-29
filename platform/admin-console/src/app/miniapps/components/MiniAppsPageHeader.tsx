"use client";

import type { ChangeEvent } from "react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

type Props = {
  adminReady: boolean;
  importError: string;
  publishInfo: string;
  templateInstallInfo: string;
  importResultText: string;
  batchImportError: string;
  batchImportInfo: string;
  rollbackPlanCount: number;
  onBatchFilesSelected: (event: ChangeEvent<HTMLInputElement>) => void;
  onValidateBatch: () => void;
  onImportBatch: () => void;
  onRollbackBatch: () => void;
  onValidateDefinitions: () => void;
  onImportDefinitions: () => void;
  onCreateMiniApp: () => void;
  importBatchPending: boolean;
  batchFilesCount: number;
  rollbackBatchPending: boolean;
  canRollbackBatch: boolean;
  importDefinitionsPending: boolean;
};

export function MiniAppsPageHeader({
  adminReady,
  importError,
  publishInfo,
  templateInstallInfo,
  importResultText,
  batchImportError,
  batchImportInfo,
  rollbackPlanCount,
  onBatchFilesSelected,
  onValidateBatch,
  onImportBatch,
  onRollbackBatch,
  onValidateDefinitions,
  onImportDefinitions,
  onCreateMiniApp,
  importBatchPending,
  batchFilesCount,
  rollbackBatchPending,
  canRollbackBatch,
  importDefinitionsPending,
}: Props) {
  const commandDisabled = !adminReady;
  const statusTone = adminReady
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-amber-200 bg-amber-50 text-amber-700";
  const statusItems = [
    {
      label: "Admin access",
      value: adminReady ? "Unlocked" : "Needs key",
      detail: adminReady
        ? "Commands can call protected APIs"
        : "Save key to unlock writes",
    },
    {
      label: "Batch files",
      value: String(batchFilesCount),
      detail:
        batchFilesCount > 0
          ? "Ready for validation"
          : "JSON/YAML package expected",
    },
    {
      label: "Rollback plan",
      value: String(rollbackPlanCount),
      detail:
        rollbackPlanCount > 0
          ? "Targets available"
          : "No batch rollback pending",
    },
  ];
  const links = [
    {
      label: "Live Smoke Workflow",
      href: "https://github.com/r3e-network/neo-os-web/actions/workflows/live-smoke.yml",
    },
    {
      label: "Smoke Reports",
      href: "https://github.com/r3e-network/neo-os-web/tree/main/docs/reports/live-smoke",
    },
    {
      label: "Runbook",
      href: "https://github.com/r3e-network/neo-os-web/blob/main/README.md#run-the-full-live-smoke-suite-with-timestamped-reports",
    },
  ];

  return (
    <section className="miniapps-command-center grid gap-5 rounded-xl border border-gray-200 bg-white p-5 shadow-sm lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
      <div className="min-w-0 space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black text-gray-900 sm:text-2xl">
                Mini
                <span className="text-emerald-600">
                  Apps
                </span>
              </h1>
              <span
                className={cn(
                  "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold uppercase",
                  statusTone,
                )}
              >
                {adminReady ? "Ready" : "Locked"}
              </span>
            </div>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-gray-600">
              Manage registered MiniApps, batch imports, rollback plans, and
              definition sync from one operator surface.
            </p>
          </div>
          <div className="miniapps-ops-panel flex flex-wrap gap-2 text-xs text-gray-500 sm:justify-end">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:border-emerald-300 hover:text-emerald-700"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div
          aria-label="MiniApps command status"
          className="miniapps-status-grid grid gap-3 sm:grid-cols-3"
        >
          {statusItems.map((item) => (
            <div
              key={item.label}
              className="rounded-xl border border-gray-200 bg-gray-50 p-3"
            >
              <p className="text-xs font-semibold uppercase text-gray-500">
                {item.label}
              </p>
              <p className="mt-1 text-lg font-black text-gray-900">
                {item.value}
              </p>
              <p className="mt-1 text-xs leading-5 text-gray-500">
                {item.detail}
              </p>
            </div>
          ))}
        </div>

        <div aria-live="polite" className="space-y-2">
          {importError && (
            <p className="text-sm text-danger-600">
              {importError}
            </p>
          )}
          {publishInfo && (
            <p className="text-sm text-warning-600">
              {publishInfo}
            </p>
          )}
          {templateInstallInfo && (
            <p className="text-sm text-info-600">
              {templateInstallInfo}
            </p>
          )}
          {importResultText && (
            <p className="text-sm text-gray-600">
              {importResultText}
            </p>
          )}
          {batchImportError && (
            <p className="text-sm text-danger-600">
              {batchImportError}
            </p>
          )}
          {batchImportInfo && (
            <p className="text-sm text-gray-600">
              {batchImportInfo}
            </p>
          )}
        </div>
      </div>

      <div className="miniapps-action-groups space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase text-gray-500">
              Command Center
            </p>
            <p className="text-sm text-gray-600">
              {adminReady
                ? "Protected write actions are enabled."
                : "Save an admin key before changing fleet state."}
            </p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <p className="mb-2 text-xs font-bold uppercase text-gray-500">
            Batch package
          </p>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
            <Button
              variant="secondary"
              className="w-full px-3"
              disabled={commandDisabled}
              onClick={() =>
                document.getElementById("batch-file-input")?.click()
              }
            >
              Upload Batch
            </Button>
            <Button
              variant="secondary"
              className="w-full px-3"
              disabled={
                commandDisabled || importBatchPending || batchFilesCount === 0
              }
              onClick={onValidateBatch}
            >
              Validate Batch
            </Button>
            <Button
              variant="secondary"
              className="w-full px-3"
              disabled={
                commandDisabled || importBatchPending || batchFilesCount === 0
              }
              onClick={onImportBatch}
            >
              Import Batch
            </Button>
          </div>
        </div>
        <input
          id="batch-file-input"
          type="file"
          accept=".json,.yaml,.yml"
          multiple
          className="hidden"
          disabled={commandDisabled}
          onChange={onBatchFilesSelected}
        />

        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <p className="mb-2 text-xs font-bold uppercase text-gray-500">
            Definition sync
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Button
              variant="secondary"
              className="w-full px-3"
              disabled={commandDisabled || importDefinitionsPending}
              onClick={onValidateDefinitions}
            >
              Validate Definitions
            </Button>
            <Button
              variant="secondary"
              className="w-full px-3"
              disabled={commandDisabled || importDefinitionsPending}
              onClick={onImportDefinitions}
            >
              Import Definitions
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-3">
          <p className="mb-2 text-xs font-bold uppercase text-gray-500">
            Fleet changes
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <Button
              variant="secondary"
              className="w-full px-3"
              disabled={
                commandDisabled || rollbackBatchPending || !canRollbackBatch
              }
              onClick={onRollbackBatch}
            >
              Rollback Batch
            </Button>
            <Button
              className="w-full px-3"
              disabled={commandDisabled}
              onClick={onCreateMiniApp}
            >
              Create MiniApp
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
