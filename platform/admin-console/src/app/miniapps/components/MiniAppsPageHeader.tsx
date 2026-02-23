"use client";

import type { ChangeEvent } from "react";
import { Button } from "@/components/ui/Button";

type Props = {
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
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">MiniApps</h1>
        <p className="text-gray-600 dark:text-gray-400">Manage registered MiniApps</p>
        {importError && <p className="mt-2 text-sm text-danger-600 dark:text-danger-400">{importError}</p>}
        {publishInfo && <p className="mt-2 text-sm text-warning-600 dark:text-warning-400">{publishInfo}</p>}
        {templateInstallInfo && <p className="mt-2 text-sm text-info-600 dark:text-info-400">{templateInstallInfo}</p>}
        {importResultText && <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{importResultText}</p>}
        {batchImportError && <p className="mt-2 text-sm text-danger-600 dark:text-danger-400">{batchImportError}</p>}
        {batchImportInfo && <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{batchImportInfo}</p>}
        {rollbackPlanCount > 0 ? (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Rollback plan ready: {rollbackPlanCount} target(s)</p>
        ) : null}
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        <label className="inline-flex cursor-pointer items-center rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800">
          Upload JSON/YAML Batch
          <input type="file" accept=".json,.yaml,.yml" multiple className="hidden" onChange={onBatchFilesSelected} />
        </label>
        <Button variant="secondary" disabled={importBatchPending || batchFilesCount === 0} onClick={onValidateBatch}>
          Validate Uploaded Batch
        </Button>
        <Button variant="secondary" disabled={importBatchPending || batchFilesCount === 0} onClick={onImportBatch}>
          Import Uploaded Batch
        </Button>
        <Button variant="secondary" disabled={rollbackBatchPending || !canRollbackBatch} onClick={onRollbackBatch}>
          Rollback Last Batch
        </Button>
        <Button variant="secondary" disabled={importDefinitionsPending} onClick={onValidateDefinitions}>
          Validate Definitions
        </Button>
        <Button variant="secondary" disabled={importDefinitionsPending} onClick={onImportDefinitions}>
          Import Definitions
        </Button>
        <Button onClick={onCreateMiniApp}>Create MiniApp</Button>
      </div>
    </div>
  );
}
