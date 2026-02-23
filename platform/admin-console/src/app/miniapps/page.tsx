// =============================================================================
// MiniApps Page - CRUD + JSON Import/Export
// =============================================================================

"use client";

import { useState, useCallback, useEffect } from "react";
import {
  useMiniApps,
  useCreateMiniApp,
  useUpdateMiniAppStatus,
  useUpdateMiniApp,
  useDeleteMiniApp,
  useImportMiniAppDefinitions,
  useImportMiniAppBatch,
  useRollbackMiniAppBatchImport,
  useCreateMiniAppMediaUploadUrl,
  useMiniAppVersions,
  useRollbackMiniAppVersion,
  useMiniAppPublishRequests,
  useReviewMiniAppPublishRequest,
  useTriggerPublishReminders,
  useVerifyPublishAuditChain,
  type MiniAppDefinitionImportResult,
  type MiniAppVersionSummary,
} from "@/lib/hooks/useMiniApps";
import type { MiniApp } from "@/types";
import { BatchResultPanels } from "./components/BatchResultPanels";
import { CreateFormPanel } from "./components/CreateFormPanel";
import { MiniAppDetailPanel } from "./components/MiniAppDetailPanel";
import { MiniAppsPageHeader } from "./components/MiniAppsPageHeader";
import { MiniAppsTableCard } from "./components/MiniAppsTableCard";
import { PublishRequestDiffPanel } from "./components/miniapp-detail/PublishRequestDiffPanel";
import { appToForm, formToConfig } from "./lib/form-converters";
import {
  MINIAPP_TEMPLATE_INSTALL_STORAGE_KEY,
  buildInstallDraftFormPatch,
  normalizeInstallDraft,
} from "./lib/template-install";
import {
  BLUEPRINTS,
  BLUEPRINT_TEMPLATES,
  CATEGORIES,
  CREATE_TABS,
  EMPTY_FORM,
  PERMISSION_KEYS,
  SOFT_DELETE_WARNING,
} from "./lib/page-config";
import {
  parseJSONObjectText,
} from "./lib/media-utils";
import { downloadJsonFile } from "./lib/download-utils";
import { useMiniAppBatchImportController } from "./lib/use-miniapp-batch-import-controller";
import { useMiniAppPublishReviewController } from "./lib/use-miniapp-publish-review-controller";
import { useMiniAppDetailDiffController } from "./lib/use-miniapp-detail-diff-controller";
import { useMiniAppEditorController } from "./lib/use-miniapp-editor-controller";

type Panel = "none" | "create" | "edit" | "detail";

export default function MiniAppsPage() {
  const { data: miniapps, isLoading, error } = useMiniApps();
  const createMutation = useCreateMiniApp();
  const updateMutation = useUpdateMiniApp();
  const statusMutation = useUpdateMiniAppStatus();
  const deleteMutation = useDeleteMiniApp();
  const importDefinitionsMutation = useImportMiniAppDefinitions();
  const importBatchMutation = useImportMiniAppBatch();
  const rollbackImportBatchMutation = useRollbackMiniAppBatchImport();
  const mediaUploadMutation = useCreateMiniAppMediaUploadUrl();
  const rollbackMutation = useRollbackMiniAppVersion();
  const reviewPublishRequestMutation = useReviewMiniAppPublishRequest();
  const triggerPublishRemindersMutation = useTriggerPublishReminders();
  const verifyPublishAuditMutation = useVerifyPublishAuditChain();
  const {
    batchFiles,
    batchImportResult,
    batchRollbackResult,
    batchImportError,
    batchImportInfo,
    handleBatchFilesSelected,
    handleBatchImport,
    handleRollbackBatchImport,
  } = useMiniAppBatchImportController({
    importBatchMutation,
    rollbackImportBatchMutation,
  });

  const [panel, setPanel] = useState<Panel>("none");
  const [selectedApp, setSelectedApp] = useState<MiniApp | null>(null);
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] = useState<MiniAppDefinitionImportResult | null>(null);
  const [templateInstallInfo, setTemplateInstallInfo] = useState("");
  const [publishInfo, setPublishInfo] = useState("");
  const {
    form,
    setForm,
    jsonText,
    setJsonText,
    formError,
    mediaUploadError,
    mediaUploadInfo,
    handleCreate: handleCreateInternal,
    handleImportJson: handleImportJsonInternal,
    handleUpdate: handleUpdateInternal,
    handleFileUpload,
    handleUploadMediaAsset,
    resetEditorState,
    clearEditorMessages,
  } = useMiniAppEditorController({
    emptyForm: EMPTY_FORM,
    formToConfig,
    selectedAppId: selectedApp?.app_id,
    createMutation,
    updateMutation,
    mediaUploadMutation,
    onPublishRequested: () => setPublishInfo("Publish request submitted for approval."),
  });
  const [versionChannel, setVersionChannel] = useState<"all" | "draft" | "published">("all");
  const [versionError, setVersionError] = useState("");
  const [publishRequestStatus, setPublishRequestStatus] = useState<"all" | "pending" | "approved" | "rejected" | "applied" | "cancelled">("pending");
  const [publishDetailRequestId, setPublishDetailRequestId] = useState<string | null>(null);
  const [selectedDiffVersionId, setSelectedDiffVersionId] = useState<string | null>(null);
  const [diffScope, setDiffScope] = useState<"all" | "manifest" | "operations" | "layout" | "admin">("all");
  const {
    publishReviewError,
    publishReminderResult,
    publishAuditVerifyResult,
    handleReviewPublishRequest,
    handleTriggerPublishReminders,
    handleVerifyPublishAudit,
  } = useMiniAppPublishReviewController({
    reviewPublishRequestMutation,
    triggerPublishRemindersMutation,
    verifyPublishAuditMutation,
    selectedAppId: selectedApp?.app_id,
  });

  const versionsQuery = useMiniAppVersions(selectedApp?.app_id || "", {
    releaseChannel: versionChannel,
    enabled: panel === "detail" && Boolean(selectedApp?.app_id),
  });

  const publishRequestsQuery = useMiniAppPublishRequests({
    appId: selectedApp?.app_id || undefined,
    status: publishRequestStatus,
    enabled: panel === "detail" && Boolean(selectedApp?.app_id),
  });

  const resetPanel = useCallback(() => {
    setPanel("none");
    setSelectedApp(null);
    resetEditorState();
    setPublishInfo("");
    setTemplateInstallInfo("");
  }, [resetEditorState]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const url = new URL(window.location.href);
    if (!url.searchParams.has("installed_template")) return;

    const raw = window.localStorage.getItem(MINIAPP_TEMPLATE_INSTALL_STORAGE_KEY);
    window.localStorage.removeItem(MINIAPP_TEMPLATE_INSTALL_STORAGE_KEY);
    url.searchParams.delete("installed_template");
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);

    if (!raw) {
      setTemplateInstallInfo("Template install draft not found. Please install from Template Studio again.");
      return;
    }

    try {
      const parsed = JSON.parse(raw) as unknown;
      const draft = normalizeInstallDraft(parsed);
      if (!draft) {
        throw new Error("Invalid template install draft payload");
      }

      setForm((prev) => ({
        ...prev,
        ...buildInstallDraftFormPatch(draft, {
          name: prev.name,
          content_description: prev.content_description,
          content_category: prev.content_category,
          content_tags: prev.content_tags,
        }),
      }));
      setSelectedApp(null);
      setPanel("create");
      setJsonText("");
      clearEditorMessages();
      setTemplateInstallInfo(
        `Installed ${draft.template_kind} template ${draft.template_id}@${draft.version || "1.0.0"} into builder draft.`,
      );
    } catch (error) {
      setTemplateInstallInfo(error instanceof Error ? error.message : "Failed to apply installed template draft");
    }
  }, []);

  const handleCreate = async () => {
    const ok = await handleCreateInternal();
    if (ok) resetPanel();
  };

  const handleImportJson = async () => {
    const ok = await handleImportJsonInternal();
    if (ok) resetPanel();
  };

  const handleExport = (app: MiniApp) => {
    const manifest = app.manifest && Object.keys(app.manifest).length > 0
      ? app.manifest
      : { app_id: app.app_id, entry_url: app.entry_url, permissions: app.permissions, limits: app.limits, assets_allowed: app.assets_allowed };
    downloadJsonFile(manifest, `${app.app_id}.json`);
  };

  const handleDelete = (app: MiniApp) => {
    if (!window.confirm(`Disable "${app.app_id}"?\n\n${SOFT_DELETE_WARNING}`)) return;
    deleteMutation.mutate(app.app_id);
  };

  const handleToggleStatus = (app: MiniApp) => {
    const next = app.status === "active" ? "disabled" : "active";
    statusMutation.mutate({ appId: app.app_id, status: next });
  };

  const handleEdit = (app: MiniApp) => {
    setForm(appToForm(app) as typeof EMPTY_FORM);
    setSelectedApp(app);
    setPanel("edit");
  };

  const handleClone = (app: MiniApp) => {
    setForm({ ...(appToForm(app) as typeof EMPTY_FORM), app_id: "" });
    setSelectedApp(null);
    setPanel("create");
  };

  const handleUpdate = async (action: "save_draft" | "publish" = "save_draft") => {
    const ok = await handleUpdateInternal(action);
    if (ok) resetPanel();
  };

  const handleImportDefinitions = async (dryRun: boolean) => {
    setImportError("");
    try {
      const result = await importDefinitionsMutation.mutateAsync({ dryRun });
      setImportResult(result);
    } catch (err) {
      setImportResult(null);
      setImportError(err instanceof Error ? err.message : "Failed to import definition files");
    }
  };

  const handleRollback = async (version: MiniAppVersionSummary) => {
    if (!selectedApp) return;
    const confirmed = window.confirm(`Rollback ${selectedApp.app_id} to version #${version.version_no}?`);
    if (!confirmed) return;

    setVersionError("");
    try {
      await rollbackMutation.mutateAsync({
        appId: selectedApp.app_id,
        versionId: version.id,
        releaseChannel: version.release_channel,
      });
    } catch (err) {
      setVersionError(err instanceof Error ? err.message : "Rollback failed");
    }
  };

  const {
    versions,
    selectedPublishRequest,
    selectedDiffVersion,
    previousDiffVersion,
    diffEntries,
    diffSummary,
    exportCurrentDiffCsv,
    exportPublishRequestsCsv,
    publishedVersionId,
  } = useMiniAppDetailDiffController({
    versionsQueryData: versionsQuery.data,
    publishRequestsQueryData: publishRequestsQuery.data,
    publishDetailRequestId,
    selectedDiffVersionId,
    diffScope,
    selectedAppId: selectedApp?.app_id,
    publishRequestStatus,
  });
  const publishRequestDiffContent = (
    <PublishRequestDiffPanel
      selectedPublishRequest={selectedPublishRequest}
      versions={versions}
      publishedVersionId={publishedVersionId}
    />
  );

  const importResultText = importResult
    ? `${importResult.dry_run ? "Validation" : "Import"} finished: total ${importResult.summary.total}, imported ${importResult.summary.imported}, validated ${importResult.summary.validated}, failed ${importResult.summary.failed}`
    : "";

  return (
    <div className="space-y-6">
      <MiniAppsPageHeader
        importError={importError}
        publishInfo={publishInfo}
        templateInstallInfo={templateInstallInfo}
        importResultText={importResultText}
        batchImportError={batchImportError}
        batchImportInfo={batchImportInfo}
        rollbackPlanCount={batchImportResult?.rollback_plan?.targets?.length ?? 0}
        onBatchFilesSelected={handleBatchFilesSelected}
        onValidateBatch={() => handleBatchImport(true)}
        onImportBatch={() => handleBatchImport(false)}
        onRollbackBatch={handleRollbackBatchImport}
        onValidateDefinitions={() => handleImportDefinitions(true)}
        onImportDefinitions={() => handleImportDefinitions(false)}
        onCreateMiniApp={() => {
          resetPanel();
          setPanel("create");
        }}
        importBatchPending={importBatchMutation.isPending}
        batchFilesCount={batchFiles.length}
        rollbackBatchPending={rollbackImportBatchMutation.isPending}
        canRollbackBatch={Boolean(batchImportResult?.rollback_plan?.targets?.length)}
        importDefinitionsPending={importDefinitionsMutation.isPending}
      />

      <BatchResultPanels
        batchImportResult={batchImportResult}
        batchRollbackResult={batchRollbackResult}
      />

      {/* Create / Edit Form Panel */}
      {(panel === "create" || panel === "edit") && (
        <CreateFormPanel
          form={form}
          setForm={setForm}
          formError={formError}
          loading={panel === "edit" ? updateMutation.isPending : createMutation.isPending}
          onSubmit={panel === "edit" ? () => handleUpdate("save_draft") : handleCreate}
          onPublish={panel === "edit" ? () => handleUpdate("publish") : undefined}
          onCancel={resetPanel}
          jsonText={jsonText}
          setJsonText={setJsonText}
          onImportJson={handleImportJson}
          onFileUpload={handleFileUpload}
          onUploadMediaAsset={handleUploadMediaAsset}
          mediaUploadPending={mediaUploadMutation.isPending}
          mediaUploadError={mediaUploadError}
          mediaUploadInfo={mediaUploadInfo}
          mode={panel === "edit" ? "edit" : "create"}
          createTabs={CREATE_TABS}
          permissionKeys={PERMISSION_KEYS}
          categories={CATEGORIES}
          blueprints={BLUEPRINTS}
          blueprintTemplates={BLUEPRINT_TEMPLATES}
          emptyForm={EMPTY_FORM}
          toConfig={formToConfig}
          parseJSONObjectText={parseJSONObjectText}
        />
      )}

      {/* MiniApps Table */}
      <MiniAppsTableCard
        miniapps={miniapps}
        isLoading={isLoading}
        error={error}
        onEdit={handleEdit}
        onClone={handleClone}
        onView={(app) => {
          setSelectedApp(app);
          setPanel("detail");
        }}
        onExport={handleExport}
        onToggleStatus={handleToggleStatus}
        onDisable={handleDelete}
        statusPending={statusMutation.isPending}
        deletePending={deleteMutation.isPending}
      />

      {/* Detail Panel */}
      {panel === "detail" && selectedApp && (
        <MiniAppDetailPanel
          selectedApp={selectedApp}
          onExportJson={() => handleExport(selectedApp)}
          onClose={resetPanel}
          versionChannel={versionChannel}
          onVersionChannelChange={setVersionChannel}
          versionError={versionError}
          versionsQuery={versionsQuery}
          selectedDiffVersion={selectedDiffVersion}
          previousDiffVersion={previousDiffVersion}
          diffScope={diffScope}
          onDiffScopeChange={setDiffScope}
          diffSummary={diffSummary}
          diffEntries={diffEntries}
          onExportCurrentDiffCsv={exportCurrentDiffCsv}
          onCloseDiff={() => setSelectedDiffVersionId(null)}
          onSelectDiffVersion={setSelectedDiffVersionId}
          onRollbackVersion={handleRollback}
          rollbackPending={rollbackMutation.isPending}
          publishRequestStatus={publishRequestStatus}
          onPublishRequestStatusChange={setPublishRequestStatus}
          publishReviewError={publishReviewError}
          publishReminderResult={publishReminderResult}
          publishAuditVerifyResult={publishAuditVerifyResult}
          publishRequestsQuery={publishRequestsQuery}
          onExportPublishRequestsCsv={exportPublishRequestsCsv}
          onVerifyPublishAudit={handleVerifyPublishAudit}
          verifyPublishAuditPending={verifyPublishAuditMutation.isPending}
          onTriggerPublishReminders={handleTriggerPublishReminders}
          triggerPublishRemindersPending={triggerPublishRemindersMutation.isPending}
          onViewPublishRequest={setPublishDetailRequestId}
          onApprovePublishRequest={(request) => handleReviewPublishRequest(request, "approve")}
          onRejectPublishRequest={(request) => handleReviewPublishRequest(request, "reject")}
          reviewPublishRequestPending={reviewPublishRequestMutation.isPending}
          publishDetailRequestId={publishDetailRequestId}
          selectedPublishRequest={selectedPublishRequest}
          onClosePublishRequestDiff={() => setPublishDetailRequestId(null)}
          publishRequestDiffContent={publishRequestDiffContent}
        />
      )}
    </div>
  );
}
