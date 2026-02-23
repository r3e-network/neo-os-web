import { useState, type ChangeEvent } from "react";
import type {
  MiniAppBatchImportDefinitionInput,
  MiniAppBatchImportResult,
  MiniAppBatchRollbackResult,
} from "@/lib/hooks/useMiniApps";
import { readFileAsText } from "./media-utils";

type ImportBatchMutationLike = {
  mutateAsync: (payload: {
    dry_run: boolean;
    stop_on_error: boolean;
    definitions: MiniAppBatchImportDefinitionInput[];
  }) => Promise<MiniAppBatchImportResult>;
};

type RollbackTargets = NonNullable<MiniAppBatchImportResult["rollback_plan"]>["targets"];

type RollbackBatchMutationLike = {
  mutateAsync: (payload: { targets: RollbackTargets }) => Promise<MiniAppBatchRollbackResult>;
};

type Props = {
  importBatchMutation: ImportBatchMutationLike;
  rollbackImportBatchMutation: RollbackBatchMutationLike;
};

async function buildBatchDefinitions(files: File[]): Promise<MiniAppBatchImportDefinitionInput[]> {
  return Promise.all(
    files.map(async (file) => ({
      file_name: file.name,
      content: await readFileAsText(file),
    })),
  );
}

export function useMiniAppBatchImportController({
  importBatchMutation,
  rollbackImportBatchMutation,
}: Props) {
  const [batchFiles, setBatchFiles] = useState<File[]>([]);
  const [batchImportResult, setBatchImportResult] = useState<MiniAppBatchImportResult | null>(null);
  const [batchRollbackResult, setBatchRollbackResult] = useState<MiniAppBatchRollbackResult | null>(null);
  const [batchImportError, setBatchImportError] = useState("");
  const [batchImportInfo, setBatchImportInfo] = useState("");

  const handleBatchFilesSelected = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    setBatchFiles(files);
    setBatchImportResult(null);
    setBatchRollbackResult(null);
    setBatchImportError("");
    setBatchImportInfo(files.length ? `Selected ${files.length} file(s) for batch import.` : "");
    event.target.value = "";
  };

  const handleBatchImport = async (dryRun: boolean) => {
    setBatchImportError("");
    setBatchImportInfo("");

    if (!batchFiles.length) {
      setBatchImportError("Please select at least one JSON or YAML file for batch import.");
      return;
    }

    try {
      const definitions = await buildBatchDefinitions(batchFiles);
      const result = await importBatchMutation.mutateAsync({
        dry_run: dryRun,
        stop_on_error: false,
        definitions,
      });
      setBatchImportResult(result);
      setBatchRollbackResult(null);
      setBatchImportInfo(
        `${dryRun ? "Validation" : "Batch import"} finished: total ${result.summary.total}, imported ${result.summary.imported}, validated ${result.summary.validated}, failed ${result.summary.failed}`,
      );
    } catch (error) {
      setBatchImportResult(null);
      setBatchRollbackResult(null);
      setBatchImportError(error instanceof Error ? error.message : "Failed to run batch import");
    }
  };

  const handleRollbackBatchImport = async () => {
    setBatchImportError("");
    setBatchImportInfo("");

    const targets = batchImportResult?.rollback_plan?.targets || [];
    if (!targets.length) {
      setBatchImportError("No rollback plan available for the latest batch import.");
      return;
    }

    try {
      const result = await rollbackImportBatchMutation.mutateAsync({ targets });
      setBatchRollbackResult(result);
      setBatchImportInfo(
        `Batch rollback finished: total ${result.summary.total}, rolled_back ${result.summary.rolled_back}, disabled_created_app ${result.summary.disabled_created_app}, failed ${result.summary.failed}`,
      );
    } catch (error) {
      setBatchRollbackResult(null);
      setBatchImportError(error instanceof Error ? error.message : "Failed to rollback batch import");
    }
  };

  return {
    batchFiles,
    batchImportResult,
    batchRollbackResult,
    batchImportError,
    batchImportInfo,
    handleBatchFilesSelected,
    handleBatchImport,
    handleRollbackBatchImport,
  };
}
