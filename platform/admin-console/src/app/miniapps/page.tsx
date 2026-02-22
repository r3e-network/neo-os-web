// =============================================================================
// MiniApps Page - CRUD + JSON Import/Export
// =============================================================================

"use client";

import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { Tabs } from "@/components/ui/Tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import {
  useMiniApps,
  useCreateMiniApp,
  useUpdateMiniAppStatus,
  useUpdateMiniApp,
  useDeleteMiniApp,
  useImportMiniAppDefinitions,
  useMiniAppVersions,
  useRollbackMiniAppVersion,
  useMiniAppPublishRequests,
  useReviewMiniAppPublishRequest,
  useTriggerPublishReminders,
  useVerifyPublishAuditChain,
  type MiniAppDefinitionImportResult,
  type MiniAppVersionSummary,
  type MiniAppPublishRequest,
  type MiniAppPublishReminderResult,
  type MiniAppPublishAuditVerifyResult,
} from "@/lib/hooks/useMiniApps";
import { miniAppConfigSchema } from "@/lib/schemas";
import { formatDate, truncate } from "@/lib/utils";
import { diffEntriesToCsv, diffVersionPayload, filterDiffEntries, summarizeDiff, type VersionDiffEntry } from "@/lib/version-diff";
import type { MiniApp } from "@/types";

type Panel = "none" | "create" | "edit" | "detail";

const PERMISSION_KEYS = ["rng", "oracle", "compute", "datafeed", "automation", "gasbank", "wallet", "payments", "governance", "storage", "secrets"];
const CATEGORIES = ["gaming", "defi", "social", "utility", "nft", "governance", "data", "other"];

const BLUEPRINTS: Record<string, { label: string; desc: string; overrides: Partial<typeof EMPTY_FORM> }> = {
  default: {
    label: "Default", desc: "General miniapp with overview/reviews/forum/news",
    overrides: { blueprint: "default", permissions: { payments: true }, daily_gas_cap_per_user: "100", max_gas_per_tx: "10", assets_allowed: "GAS" },
  },
  prediction: {
    label: "Prediction", desc: "Polymarket-style with market info + trade panel",
    overrides: { blueprint: "prediction", permissions: { payments: true, datafeed: true }, daily_gas_cap_per_user: "100", max_gas_per_tx: "10", assets_allowed: "GAS" },
  },
  gaming: {
    label: "Gaming", desc: "RNG, compute, gasbank pre-configured",
    overrides: { blueprint: "gaming", permissions: { rng: true, compute: true, gasbank: true }, content_category: "gaming", daily_gas_cap_per_user: "50", max_gas_per_tx: "10", assets_allowed: "GAS" },
  },
  defi: {
    label: "DeFi", desc: "Oracle, datafeed, wallet, gasbank",
    overrides: { blueprint: "defi", permissions: { oracle: true, datafeed: true, wallet: true, gasbank: true }, content_category: "defi", daily_gas_cap_per_user: "100", max_gas_per_tx: "20", assets_allowed: "GAS", governance_assets_allowed: "BNEO" },
  },
};

const CREATE_TABS = [
  { label: "Basic Info", value: "basic" },
  { label: "Content", value: "content" },
  { label: "Page Layout", value: "layout" },
  { label: "Contracts & Ops", value: "contracts" },
  { label: "Permissions & Limits", value: "perms" },
  { label: "JSON", value: "json" },
];

const BLUEPRINT_TEMPLATES: Record<string, DetailTemplate> = {
  default: { layout: "default", tabs: [{id:"overview",label:"Overview",type:"content"},{id:"reviews",label:"Reviews",type:"reviews"},{id:"forum",label:"Forum",type:"forum"},{id:"news",label:"News",type:"news"}], operation_panel: {title:"Operations",subtitle:"Configure parameters and submit.",cta_label:"Launch App"} },
  prediction: { layout: "prediction", hero: {eyebrow:"Prediction Market",disclaimer:"Probabilities are market-implied."}, tabs: [{id:"market-info",label:"Market Info",type:"content"},{id:"reviews",label:"Reviews",type:"reviews"},{id:"forum",label:"Comments",type:"forum"},{id:"news",label:"Activity",type:"news"}], operation_panel: {title:"Trade Position",subtitle:"Choose side, set amount, submit on-chain.",cta_label:"Open Full Experience"} },
  gaming: { layout: "default", tabs: [{id:"overview",label:"Overview",type:"content"},{id:"leaderboard",label:"Leaderboard",type:"content"},{id:"reviews",label:"Reviews",type:"reviews"},{id:"news",label:"News",type:"news"}], operation_panel: {title:"Play",subtitle:"Configure game parameters and start playing.",cta_label:"Launch Game"} },
  defi: { layout: "default", tabs: [{id:"pool-info",label:"Pool Info",type:"content"},{id:"positions",label:"Positions",type:"content"},{id:"reviews",label:"Reviews",type:"reviews"},{id:"news",label:"Activity",type:"news"}], operation_panel: {title:"Manage Position",subtitle:"Deposit, withdraw, or claim rewards.",cta_label:"Open DeFi App"} },
};

interface ContractEntry { name: string; hash: string }
interface OperationParam { name: string; type: string; label: string; required: boolean; default_value: string; placeholder: string; options: string }
interface OperationEntry { name: string; method: string; description: string; gas_cost: string; button_style: string; confirm_message: string; params: OperationParam[] }
interface ComponentEntry { type: string; display: string; props: string }

interface ContentBlock {
  type: string;
  title?: string;
  content?: string;
  items?: string[];
  tone?: string;
  entries?: Array<{ key: string; value: string }>;
  links?: Array<{ label: string; href: string }>;
}

interface DetailTemplate {
  layout?: string;
  hero?: Record<string, string>;
  tabs?: Array<{ id: string; label: string; type: string; blocks?: ContentBlock[] }>;
  operation_panel?: Record<string, string>;
}

type FrontendSpecFormat = "markdown" | "yaml" | "json";

const EMPTY_FORM = {
  app_id: "", name: "", entry_url: "", version: "1.0.0",
  developer_user_id: "",
  developer_pubkey: "", callback_contract: "", callback_method: "",
  blueprint: "default" as string, detail_template: null as DetailTemplate | null,
  assets_allowed: "GAS", governance_assets_allowed: "BNEO",
  daily_gas_cap_per_user: "", governance_cap: "", max_gas_per_tx: "",
  attestation_required: false,
  permissions: {} as Record<string, boolean>,
  contracts: [] as ContractEntry[],
  operations: [] as OperationEntry[],
  components: [] as ComponentEntry[],
  frontend_spec_format: "markdown" as FrontendSpecFormat,
  frontend_spec_content: "",
  content_description: "", content_icon_url: "", content_logo_url: "", content_banner_url: "", content_docs_url: "", content_category: "", content_tags: "",
};

const SOFT_DELETE_WARNING = "Delete now means disabling the MiniApp (soft delete).";

export default function MiniAppsPage() {
  const { data: miniapps, isLoading, error } = useMiniApps();
  const createMutation = useCreateMiniApp();
  const updateMutation = useUpdateMiniApp();
  const statusMutation = useUpdateMiniAppStatus();
  const deleteMutation = useDeleteMiniApp();
  const importDefinitionsMutation = useImportMiniAppDefinitions();
  const rollbackMutation = useRollbackMiniAppVersion();
  const reviewPublishRequestMutation = useReviewMiniAppPublishRequest();
  const triggerPublishRemindersMutation = useTriggerPublishReminders();
  const verifyPublishAuditMutation = useVerifyPublishAuditChain();

  const [panel, setPanel] = useState<Panel>("none");
  const [selectedApp, setSelectedApp] = useState<MiniApp | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [jsonText, setJsonText] = useState("");
  const [formError, setFormError] = useState("");
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] = useState<MiniAppDefinitionImportResult | null>(null);
  const [publishInfo, setPublishInfo] = useState("");
  const [versionChannel, setVersionChannel] = useState<"all" | "draft" | "published">("all");
  const [versionError, setVersionError] = useState("");
  const [publishRequestStatus, setPublishRequestStatus] = useState<"all" | "pending" | "approved" | "rejected" | "applied" | "cancelled">("pending");
  const [publishReviewError, setPublishReviewError] = useState("");
  const [publishReminderResult, setPublishReminderResult] = useState<MiniAppPublishReminderResult | null>(null);
  const [publishDetailRequestId, setPublishDetailRequestId] = useState<string | null>(null);
  const [publishAuditVerifyResult, setPublishAuditVerifyResult] = useState<MiniAppPublishAuditVerifyResult | null>(null);
  const [selectedDiffVersionId, setSelectedDiffVersionId] = useState<string | null>(null);
  const [diffScope, setDiffScope] = useState<"all" | "manifest" | "operations" | "layout" | "admin">("all");

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
    setForm(EMPTY_FORM);
    setJsonText("");
    setFormError("");
    setPublishInfo("");
  }, []);

  const handleCreate = async () => {
    setFormError("");
    const payload = formToConfig(form);
    const result = miniAppConfigSchema.safeParse(payload);
    if (!result.success) {
      setFormError(result.error.errors[0]?.message || "Validation failed");
      return;
    }

    try {
      const resultPayload = await createMutation.mutateAsync(payload) as { publish_requested?: boolean } | null;
      if (resultPayload?.publish_requested) {
        setPublishInfo("Publish request submitted for approval.");
      }
      resetPanel();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Create failed");
    }
  };

  const handleImportJson = async () => {
    setFormError("");
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      setFormError("Invalid JSON");
      return;
    }

    const result = miniAppConfigSchema.safeParse(parsed);
    if (!result.success) {
      setFormError(result.error.errors.map(e => `${e.path.join(".")}: ${e.message}`).join("; "));
      return;
    }

    try {
      const resultPayload = await createMutation.mutateAsync(parsed as Record<string, unknown>) as { publish_requested?: boolean } | null;
      if (resultPayload?.publish_requested) {
        setPublishInfo("Publish request submitted for approval.");
      }
      resetPanel();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Import failed");
    }
  };

  const handleExport = (app: MiniApp) => {
    const manifest = app.manifest && Object.keys(app.manifest).length > 0
      ? app.manifest
      : { app_id: app.app_id, entry_url: app.entry_url, permissions: app.permissions, limits: app.limits, assets_allowed: app.assets_allowed };
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${app.app_id}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
    setForm(appToForm(app));
    setSelectedApp(app);
    setPanel("edit");
  };

  const handleClone = (app: MiniApp) => {
    setForm({ ...appToForm(app), app_id: "" });
    setSelectedApp(null);
    setPanel("create");
  };

  const handleUpdate = async (action: "save_draft" | "publish" = "save_draft") => {
    setFormError("");
    const payload = formToConfig(form);
    const result = miniAppConfigSchema.safeParse(payload);
    if (!result.success) {
      setFormError(result.error.errors[0]?.message || "Validation failed");
      return;
    }
    try {
      const resultPayload = await updateMutation.mutateAsync({
        appId: selectedApp!.app_id,
        config: {
          ...payload,
          action,
        },
      }) as { action?: string } | null;

      if (resultPayload?.action === "publish_requested") {
        setPublishInfo("Publish request submitted for approval.");
      }

      resetPanel();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Update failed");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setJsonText(reader.result as string);
    reader.readAsText(file);
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

  const handleReviewPublishRequest = async (
    request: MiniAppPublishRequest,
    decision: "approve" | "reject" | "cancel",
  ) => {
    setPublishReviewError("");
    try {
      await reviewPublishRequestMutation.mutateAsync({
        requestId: request.id,
        decision,
        appId: request.app_id,
      });
    } catch (err) {
      setPublishReviewError(err instanceof Error ? err.message : "Failed to review publish request");
    }
  };

  const handleTriggerPublishReminders = async (dryRun: boolean) => {
    setPublishReviewError("");
    try {
      const result = await triggerPublishRemindersMutation.mutateAsync({ dryRun });
      setPublishReminderResult(result);
    } catch (err) {
      setPublishReviewError(err instanceof Error ? err.message : "Failed to trigger reminders");
    }
  };

  const handleVerifyPublishAudit = async () => {
    setPublishReviewError("");
    try {
      const result = await verifyPublishAuditMutation.mutateAsync({
        appId: selectedApp?.app_id,
        limit: 1000,
      });
      setPublishAuditVerifyResult(result);
    } catch (err) {
      setPublishReviewError(err instanceof Error ? err.message : "Failed to verify publish audit chain");
    }
  };

  const versions = versionsQuery.data?.versions || [];
  const selectedPublishRequest = publishRequestsQuery.data?.requests.find((request) => request.id === publishDetailRequestId) || null;
  const selectedDiffVersion = versions.find((item) => item.id === selectedDiffVersionId) || null;
  const selectedDiffIndex = selectedDiffVersion ? versions.findIndex((item) => item.id === selectedDiffVersion.id) : -1;
  const previousDiffVersion = selectedDiffIndex >= 0 && selectedDiffIndex + 1 < versions.length
    ? versions[selectedDiffIndex + 1]
    : null;
  const rawDiffEntries: VersionDiffEntry[] = selectedDiffVersion && previousDiffVersion
    ? diffVersionPayload(previousDiffVersion.row_snapshot || previousDiffVersion.manifest, selectedDiffVersion.row_snapshot || selectedDiffVersion.manifest)
    : [];

  const diffEntries: VersionDiffEntry[] = (() => {
    if (diffScope === "all") return rawDiffEntries;
    if (diffScope === "manifest") {
      return filterDiffEntries(rawDiffEntries, { includePaths: ["manifest"] });
    }
    if (diffScope === "operations") {
      return filterDiffEntries(rawDiffEntries, {
        includePaths: ["manifest.operations", "operations"],
      });
    }
    if (diffScope === "layout") {
      return filterDiffEntries(rawDiffEntries, {
        includePaths: ["manifest.detail_template", "manifest.page_template", "detail_template", "page_template"],
      });
    }
    return filterDiffEntries(rawDiffEntries, { includePaths: ["manifest.admin", "admin"] });
  })();

  const diffSummary = summarizeDiff(diffEntries);

  const exportCurrentDiffCsv = () => {
    const csv = diffEntriesToCsv(diffEntries);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `miniapp-diff-${selectedDiffVersion?.version_no || "latest"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPublishRequestsCsv = () => {
    const params = new URLSearchParams();
    if (selectedApp?.app_id) {
      params.set("app_id", selectedApp.app_id);
    }
    if (publishRequestStatus !== "all") {
      params.set("status", publishRequestStatus);
    }

    const href = `/api/miniapps/publish-requests/export?${params.toString()}`;
    const a = document.createElement("a");
    a.href = href;
    a.click();
  };

  const renderPublishRequestDiff = () => {
    if (!selectedPublishRequest) return null;

    const requestedVersion = versions.find((version) => version.id === selectedPublishRequest.requested_version_id) || null;
    const publishedVersionId = versionsQuery.data?.releases?.published || null;
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
      <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 mt-3">
        <p className="text-xs text-gray-600 dark:text-gray-300 mb-2">
          Request Diff: Published v{publishedVersion.version_no} {"->"} Requested v{requestedVersion.version_no}
        </p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2">
          Total {summary.total} | Added {summary.added} | Removed {summary.removed} | Changed {summary.changed}
        </p>
        {!entries.length ? (
          <p className="text-xs text-gray-500 dark:text-gray-400">No differences found.</p>
        ) : (
          <div className="max-h-48 overflow-auto rounded border border-gray-100 dark:border-gray-800 divide-y dark:divide-gray-800">
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
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">MiniApps</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage registered MiniApps</p>
          {importError && (
            <p className="mt-2 text-sm text-danger-600 dark:text-danger-400">{importError}</p>
          )}
          {publishInfo && (
            <p className="mt-2 text-sm text-warning-600 dark:text-warning-400">{publishInfo}</p>
          )}
          {importResult && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              {importResult.dry_run ? "Validation" : "Import"} finished: total {importResult.summary.total}, imported{" "}
              {importResult.summary.imported}, validated {importResult.summary.validated}, failed{" "}
              {importResult.summary.failed}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            disabled={importDefinitionsMutation.isPending}
            onClick={() => handleImportDefinitions(true)}
          >
            Validate Definitions
          </Button>
          <Button
            variant="secondary"
            disabled={importDefinitionsMutation.isPending}
            onClick={() => handleImportDefinitions(false)}
          >
            Import Definitions
          </Button>
          <Button onClick={() => { resetPanel(); setPanel("create"); }}>Create MiniApp</Button>
        </div>
      </div>

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
          mode={panel === "edit" ? "edit" : "create"}
        />
      )}

      {/* MiniApps Table */}
      <Card>
        <CardHeader><CardTitle>Registered MiniApps ({miniapps?.length ?? 0})</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <Spinner />
          ) : error ? (
            <div className="text-center text-danger-600 dark:text-danger-400">Failed to load MiniApps</div>
          ) : !miniapps?.length ? (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">No MiniApps registered yet</p>
          ) : (
            <div className="overflow-x-auto">
            <Table aria-label="MiniApps list">
              <TableHeader>
                <TableRow>
                  <TableHead>App ID</TableHead>
                  <TableHead>Entry URL</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {miniapps.map((app) => (
                  <TableRow key={app.app_id}>
                    <TableCell className="font-medium">{app.app_id}</TableCell>
                    <TableCell className="text-sm text-gray-500 dark:text-gray-400" title={app.entry_url}>{truncate(app.entry_url, 35)}</TableCell>
                    <TableCell>
                      <Badge variant={app.status === "active" ? "success" : app.status === "pending" ? "warning" : "danger"}>
                        {app.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-gray-500 dark:text-gray-400">
                      {Object.entries(app.permissions || {}).filter(([, v]) => v).map(([k]) => k).join(", ") || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-gray-500 dark:text-gray-400">{formatDate(app.created_at)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(app)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleClone(app)}>
                          Clone
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setSelectedApp(app); setPanel("detail"); }}>
                          View
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleExport(app)}>
                          Export
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleStatus(app)}
                          disabled={statusMutation.isPending}
                        >
                          {app.status === "active" ? "Disable" : "Enable"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(app)}
                          disabled={deleteMutation.isPending}
                          className="text-danger-600 dark:text-danger-400"
                        >
                          Disable
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail Panel */}
      {panel === "detail" && selectedApp && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{selectedApp.app_id}</CardTitle>
              <div className="flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => handleExport(selectedApp)}>Export JSON</Button>
                <Button size="sm" variant="ghost" onClick={resetPanel}>Close</Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div><dt className="font-medium text-gray-500 dark:text-gray-400">Entry URL</dt><dd>{selectedApp.entry_url}</dd></div>
              <div><dt className="font-medium text-gray-500 dark:text-gray-400">Status</dt><dd><Badge variant={selectedApp.status === "active" ? "success" : "danger"}>{selectedApp.status}</Badge></dd></div>
              <div><dt className="font-medium text-gray-500 dark:text-gray-400">Developer Pubkey</dt><dd className="font-mono text-xs break-all">{selectedApp.developer_pubkey || "—"}</dd></div>
              <div><dt className="font-medium text-gray-500 dark:text-gray-400">Assets Allowed</dt><dd>{selectedApp.assets_allowed?.join(", ") || "—"}</dd></div>
              <div><dt className="font-medium text-gray-500 dark:text-gray-400">Permissions</dt><dd>{Object.entries(selectedApp.permissions || {}).filter(([, v]) => v).map(([k]) => k).join(", ") || "—"}</dd></div>
              <div><dt className="font-medium text-gray-500 dark:text-gray-400">Limits</dt><dd><pre className="text-xs overflow-auto">{JSON.stringify(selectedApp.limits, null, 2)}</pre></dd></div>
            </dl>

            {/* Contracts */}
            {(() => {
              const m = selectedApp.manifest as Record<string, unknown> | null;
              const contracts = Array.isArray(m?.contracts) ? m.contracts as Array<{name: string; hash: string}> : [];
              const operations = Array.isArray(m?.operations) ? m.operations as Array<{name: string; method: string; description?: string; gas_cost?: string}> : [];
              const content = (m?.content && typeof m.content === "object") ? m.content as Record<string, unknown> : null;
              return (
                <>
                  {contracts.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Contracts</h4>
                      <div className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y dark:divide-gray-700">
                        {contracts.map((c, i) => (
                          <div key={i} className="flex justify-between px-3 py-2 text-sm">
                            <span className="font-medium shrink-0">{c.name}</span>
                            <span className="font-mono text-xs text-gray-500 dark:text-gray-400 truncate min-w-0 ml-2" title={c.hash}>{c.hash}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {operations.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Operations</h4>
                      <div className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y dark:divide-gray-700">
                        {operations.map((o, i) => (
                          <div key={i} className="flex items-center gap-4 px-3 py-2 text-sm">
                            <span className="font-medium w-32">{o.name}</span>
                            <span className="font-mono text-xs">{o.method}</span>
                            {o.gas_cost && <span className="text-xs text-gray-500 dark:text-gray-400">{o.gas_cost} GAS</span>}
                            {o.description && <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto truncate min-w-0" title={o.description}>{o.description}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {content && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Content</h4>
                      <dl className="grid grid-cols-2 gap-2 text-sm">
                        {!!content.description && <div className="col-span-2"><dt className="font-medium text-gray-500 dark:text-gray-400">Description</dt><dd>{String(content.description)}</dd></div>}
                        {!!content.category && <div><dt className="font-medium text-gray-500 dark:text-gray-400">Category</dt><dd>{String(content.category)}</dd></div>}
                        {Array.isArray(content.tags) && content.tags.length > 0 && <div><dt className="font-medium text-gray-500 dark:text-gray-400">Tags</dt><dd>{(content.tags as string[]).join(", ")}</dd></div>}
                      </dl>
                    </div>
                  )}
                </>
              );
            })()}

            <div><h4 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Full Manifest</h4><pre className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-xs overflow-auto max-h-64">{JSON.stringify(selectedApp.manifest || {}, null, 2)}</pre></div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Version History</h4>
                <div className="flex items-center gap-2">
                  <select
                    className="rounded-md border border-gray-300 dark:border-gray-600 p-1.5 text-xs cursor-pointer transition-colors dark:bg-gray-800 dark:text-gray-100"
                    value={versionChannel}
                    onChange={(e) => setVersionChannel(e.target.value as "all" | "draft" | "published")}
                    aria-label="Version channel filter"
                  >
                    <option value="all">All</option>
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>

              {versionError && <p className="mb-2 text-xs text-danger-600 dark:text-danger-400">{versionError}</p>}

              {versionsQuery.isLoading ? (
                <Spinner />
              ) : versionsQuery.isError ? (
                <p className="text-xs text-danger-600 dark:text-danger-400">
                  {versionsQuery.error instanceof Error ? versionsQuery.error.message : "Failed to load version history"}
                </p>
              ) : !versionsQuery.data?.versions.length ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">No versions yet.</p>
              ) : (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y dark:divide-gray-700">
                  {versionsQuery.data.versions.map((version) => (
                    <div key={version.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                      <span className="font-medium">v{version.version_no}</span>
                      <Badge variant={version.release_channel === "published" ? "success" : "warning"}>
                        {version.release_channel}
                      </Badge>
                      <span className="text-gray-500 dark:text-gray-400">{version.source_action}</span>
                      <span className="text-gray-500 dark:text-gray-400">{formatDate(version.created_at)}</span>
                      <span className="ml-auto flex items-center gap-2">
                        <span className="font-mono text-[10px] text-gray-500 dark:text-gray-400">{truncate(version.id, 14)}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedDiffVersionId(version.id)}
                        >
                          Diff
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleRollback(version)}
                          disabled={rollbackMutation.isPending}
                        >
                          Rollback
                        </Button>
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {selectedDiffVersion && previousDiffVersion && (
                <div className="mt-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <h5 className="text-xs font-medium text-gray-600 dark:text-gray-300">
                      Diff: v{previousDiffVersion.version_no} {"->"} v{selectedDiffVersion.version_no}
                    </h5>
                    <div className="flex items-center gap-2">
                      <select
                        className="rounded-md border border-gray-300 dark:border-gray-600 p-1 text-[11px] cursor-pointer transition-colors dark:bg-gray-800 dark:text-gray-100"
                        value={diffScope}
                        onChange={(e) => setDiffScope(e.target.value as typeof diffScope)}
                        aria-label="Diff scope"
                      >
                        <option value="all">All</option>
                        <option value="manifest">Manifest</option>
                        <option value="operations">Operations</option>
                        <option value="layout">Layout</option>
                        <option value="admin">Admin</option>
                      </select>
                      <Button size="sm" variant="ghost" onClick={exportCurrentDiffCsv}>
                        Export CSV
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setSelectedDiffVersionId(null)}>
                        Close Diff
                      </Button>
                    </div>
                  </div>

                  <p className="mb-2 text-[11px] text-gray-600 dark:text-gray-300">
                    Total {diffSummary.total} | Added {diffSummary.added} | Removed {diffSummary.removed} | Changed {diffSummary.changed}
                  </p>

                  {!diffEntries.length ? (
                    <p className="text-xs text-gray-500 dark:text-gray-400">No differences found.</p>
                  ) : (
                    <div className="max-h-56 overflow-auto rounded border border-gray-100 dark:border-gray-800 divide-y dark:divide-gray-800">
                      {diffEntries.slice(0, 200).map((entry, idx) => (
                        <div key={`${entry.path}-${idx}`} className="px-2 py-1 text-[11px]">
                          <span className="font-mono text-gray-700 dark:text-gray-300">{entry.path || "(root)"}</span>
                          <span className="ml-2 text-gray-500 dark:text-gray-400">{entry.kind}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Publish Requests</h4>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={exportPublishRequestsCsv}
                  >
                    Export Requests CSV
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleVerifyPublishAudit}
                    disabled={verifyPublishAuditMutation.isPending}
                  >
                    Verify Audit Chain
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleTriggerPublishReminders(true)}
                    disabled={triggerPublishRemindersMutation.isPending}
                  >
                    Dry-Run Remind
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleTriggerPublishReminders(false)}
                    disabled={triggerPublishRemindersMutation.isPending}
                  >
                    Send Reminders
                  </Button>
                  <select
                    className="rounded-md border border-gray-300 dark:border-gray-600 p-1.5 text-xs cursor-pointer transition-colors dark:bg-gray-800 dark:text-gray-100"
                    value={publishRequestStatus}
                    onChange={(e) => setPublishRequestStatus(e.target.value as typeof publishRequestStatus)}
                    aria-label="Publish request status filter"
                  >
                    <option value="pending">Pending</option>
                    <option value="all">All</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="applied">Applied</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>

              {publishReviewError && <p className="mb-2 text-xs text-danger-600 dark:text-danger-400">{publishReviewError}</p>}

              {publishReminderResult && (
                <p className="mb-2 text-xs text-gray-600 dark:text-gray-300">
                  Reminder {publishReminderResult.dry_run ? "dry-run" : "sent"}: {publishReminderResult.sent} items ({publishReminderResult.channel})
                </p>
              )}

              {publishAuditVerifyResult && (
                <p className={`mb-2 text-xs ${publishAuditVerifyResult.ok ? "text-success-600 dark:text-success-400" : "text-danger-600 dark:text-danger-400"}`}>
                  Audit chain {publishAuditVerifyResult.ok ? "OK" : "FAILED"} |
                  Events {publishAuditVerifyResult.total_events} |
                  Invalid {publishAuditVerifyResult.invalid_hash_events} |
                  Breaks {publishAuditVerifyResult.chain_break_events}
                </p>
              )}

              {publishRequestsQuery.data?.sla && (
                <div className="mb-2 rounded border border-gray-200 dark:border-gray-700 p-2 text-[11px] text-gray-600 dark:text-gray-300">
                  SLA {publishRequestsQuery.data.sla.minutes}m / Escalation {publishRequestsQuery.data.sla.escalation_minutes}m |
                  Pending {publishRequestsQuery.data.sla.pending} |
                  Breached {publishRequestsQuery.data.sla.sla_breached} |
                  Escalated {publishRequestsQuery.data.sla.escalated}
                </div>
              )}

              {publishRequestsQuery.isLoading ? (
                <Spinner />
              ) : publishRequestsQuery.isError ? (
                <p className="text-xs text-danger-600 dark:text-danger-400">
                  {publishRequestsQuery.error instanceof Error
                    ? publishRequestsQuery.error.message
                    : "Failed to load publish requests"}
                </p>
              ) : !publishRequestsQuery.data?.requests.length ? (
                <p className="text-xs text-gray-500 dark:text-gray-400">No publish requests.</p>
              ) : (
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y dark:divide-gray-700">
                  {publishRequestsQuery.data.requests.map((request) => (
                    <div key={request.id} className="flex items-center gap-3 px-3 py-2 text-xs">
                      <span className="font-mono text-[10px] text-gray-500 dark:text-gray-400">{truncate(request.id, 14)}</span>
                      <span className="font-medium">v{request.requested_version_no ?? "-"}</span>
                      <Badge variant={request.status === "pending" ? "warning" : request.status === "applied" ? "success" : "default"}>
                        {request.status}
                      </Badge>
                      <span className="text-gray-500 dark:text-gray-400">{formatDate(request.requested_at)}</span>
                      {(() => {
                        const timing = request.timing;
                        if (!timing) return null;
                        if (timing.isEscalated) {
                          return <Badge variant="danger">Escalated ({timing.ageMinutes}m)</Badge>;
                        }
                        if (timing.isSlaBreached) {
                          return <Badge variant="warning">SLA Breach ({timing.ageMinutes}m)</Badge>;
                        }
                        return <Badge variant="default">Age {timing.ageMinutes}m</Badge>;
                      })()}
                      <span className="ml-auto flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setPublishDetailRequestId(request.id)}
                        >
                          View Diff
                        </Button>
                        {request.status === "pending" && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleReviewPublishRequest(request, "approve")}
                              disabled={reviewPublishRequestMutation.isPending}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleReviewPublishRequest(request, "reject")}
                              disabled={reviewPublishRequestMutation.isPending}
                            >
                              Reject
                            </Button>
                          </>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {publishDetailRequestId && selectedPublishRequest && (
                <div className="mt-2">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
                      Request {truncate(selectedPublishRequest.id, 20)}
                    </p>
                    <Button size="sm" variant="ghost" onClick={() => setPublishDetailRequestId(null)}>
                      Close Request Diff
                    </Button>
                  </div>
                  {renderPublishRequestDiff()}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function formToConfig(form: typeof EMPTY_FORM) {
  const frontendSpecContent = form.frontend_spec_content.trim();
  const frontendSpec = frontendSpecContent
    ? {
        format: form.frontend_spec_format,
        content: frontendSpecContent,
      }
    : undefined;

  return {
    app_id: form.app_id, name: form.name, entry_url: form.entry_url,
    developer_user_id: form.developer_user_id || undefined,
    template_type: form.blueprint || "default",
    version: form.version || "1.0.0", developer_pubkey: form.developer_pubkey,
    callback_contract: form.callback_contract || undefined,
    callback_method: form.callback_method || undefined,
    blueprint: form.blueprint || undefined,
    detail_template: form.detail_template || undefined,
    frontend_spec: frontendSpec,
    attestation_required: form.attestation_required,
    permissions: form.permissions,
    limits: {
      max_gas_per_tx: form.max_gas_per_tx || undefined,
      daily_gas_cap_per_user: form.daily_gas_cap_per_user || undefined,
      governance_cap: form.governance_cap || undefined,
    },
    assets_allowed: form.assets_allowed.split(",").map(s => s.trim()).filter(Boolean),
    governance_assets_allowed: form.governance_assets_allowed.split(",").map(s => s.trim()).filter(Boolean),
    contracts: form.contracts.filter(c => c.name && c.hash),
    operations: form.operations.filter(o => o.name && o.method).map(o => ({
      name: o.name, method: o.method,
      description: o.description || undefined,
      gas_cost: o.gas_cost || undefined,
      button_style: o.button_style || undefined,
      confirm_message: o.confirm_message || undefined,
      params: o.params.filter(p => p.name && p.type).map(p => ({
        name: p.name, type: p.type,
        label: p.label || undefined,
        required: p.required,
        default_value: p.default_value || undefined,
        placeholder: p.placeholder || undefined,
        options: p.options ? (() => { try { return JSON.parse(p.options); } catch { return undefined; } })() : undefined,
      })),
    })),
    components: form.components.filter(c => c.type).map(c => ({
      type: c.type, display: c.display || undefined,
      props: (() => { try { return c.props ? JSON.parse(c.props) : {}; } catch { return {}; } })(),
    })),
    content: {
      description: form.content_description || undefined,
      icon_url: form.content_icon_url || undefined,
      logo_url: form.content_logo_url || undefined,
      banner_url: form.content_banner_url || undefined,
      docs_url: form.content_docs_url || undefined,
      category: form.content_category || undefined,
      tags: form.content_tags ? form.content_tags.split(",").map(s => s.trim()).filter(Boolean) : [],
    },
  };
}

function appToForm(app: MiniApp): typeof EMPTY_FORM {
  const m = (app.manifest || {}) as Record<string, unknown>;
  const content = (m.content && typeof m.content === "object") ? m.content as Record<string, unknown> : {};
  const contracts = Array.isArray(m.contracts) ? m.contracts as ContractEntry[] : [];
  const operations = Array.isArray(m.operations) ? (m.operations as Array<Record<string, unknown>>).map(o => ({
    name: String(o.name || ""), method: String(o.method || ""), description: String(o.description || ""), gas_cost: String(o.gas_cost || ""),
    button_style: String(o.button_style || ""), confirm_message: String(o.confirm_message || ""),
    params: Array.isArray(o.params) ? (o.params as Array<Record<string, unknown>>).map(p => ({
      name: String(p.name || ""), type: String(p.type || "string"), label: String(p.label || ""),
      required: p.required !== false, default_value: String(p.default_value || ""),
      placeholder: String(p.placeholder || ""),
      options: Array.isArray(p.options) ? JSON.stringify(p.options) : "",
    })) : [] as OperationParam[],
  })) : [];
  const frontendSpecRaw = m.frontend_spec ?? m.ui_spec;
  let frontendSpecFormat: FrontendSpecFormat = "markdown";
  let frontendSpecContent = "";

  if (typeof frontendSpecRaw === "string") {
    frontendSpecContent = frontendSpecRaw;
  } else if (frontendSpecRaw && typeof frontendSpecRaw === "object" && !Array.isArray(frontendSpecRaw)) {
    const specObj = frontendSpecRaw as Record<string, unknown>;
    const candidateFormat = String(specObj.format || "").trim().toLowerCase();
    if (candidateFormat === "yaml" || candidateFormat === "json" || candidateFormat === "markdown") {
      frontendSpecFormat = candidateFormat;
    }
    if (typeof specObj.content === "string") {
      frontendSpecContent = specObj.content;
    } else {
      frontendSpecFormat = "json";
      frontendSpecContent = JSON.stringify(specObj, null, 2);
    }
  }

  return {
    app_id: app.app_id,
    name: String(m.name || app.app_id),
    entry_url: app.entry_url,
    developer_user_id: app.developer_user_id || "",
    version: String(m.version || "1.0.0"),
    developer_pubkey: app.developer_pubkey || "",
    callback_contract: String(m.callback_contract || ""),
    callback_method: String(m.callback_method || ""),
    blueprint: String(m.blueprint || (m.admin as Record<string, unknown>)?.blueprint || "default"),
    detail_template: (m.detail_template || m.page_template || null) as DetailTemplate | null,
    assets_allowed: (app.assets_allowed || []).join(", "),
    governance_assets_allowed: (app.governance_assets_allowed || []).join(", "),
    daily_gas_cap_per_user: String(app.limits?.daily_gas_cap_per_user || ""),
    governance_cap: String(app.limits?.governance_cap || ""),
    max_gas_per_tx: String((m.limits as Record<string, unknown>)?.max_gas_per_tx || ""),
    attestation_required: !!m.attestation_required,
    permissions: Object.fromEntries(Object.entries(app.permissions || {}).map(([k, v]) => [k, !!v])),
    contracts,
    operations,
    components: Array.isArray(m.components)
      ? (m.components as Array<Record<string, unknown>>).map((c) => ({
          type: String(c.type || ""),
          display: String(c.display || ""),
          props: JSON.stringify((c.props && typeof c.props === "object") ? c.props : {}, null, 2),
        }))
      : [] as ComponentEntry[],
    frontend_spec_format: frontendSpecFormat,
    frontend_spec_content: frontendSpecContent,
    content_description: String(content.description || ""),
    content_icon_url: String(content.icon_url || ""),
    content_logo_url: String(content.logo_url || ""),
    content_banner_url: String(content.banner_url || ""),
    content_docs_url: String(content.docs_url || ""),
    content_category: String(content.category || ""),
    content_tags: Array.isArray(content.tags) ? (content.tags as string[]).join(", ") : "",
  };
}

function CreateFormPanel({
  form, setForm, formError, loading, onSubmit, onPublish, onCancel,
  jsonText, setJsonText, onImportJson, onFileUpload, mode = "create",
}: {
  form: typeof EMPTY_FORM;
  setForm: (f: typeof EMPTY_FORM) => void;
  formError: string;
  loading: boolean;
  onSubmit: () => void;
  onPublish?: () => void;
  onCancel: () => void;
  jsonText: string;
  setJsonText: (s: string) => void;
  onImportJson: () => void;
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  mode?: "create" | "edit";
}) {
  const [tab, setTab] = useState("basic");
  const update = (key: string, value: string | boolean) => setForm({ ...form, [key]: value });
  const togglePerm = (key: string) => setForm({ ...form, permissions: { ...form.permissions, [key]: !form.permissions[key] } });

  const dt = (form.detail_template || {}) as DetailTemplate;
  const updateDT = (updates: Partial<DetailTemplate>) => setForm({ ...form, detail_template: { ...dt, ...updates } });
  const dtTabs: Array<{id:string;label:string;type:string;blocks?:ContentBlock[]}> = Array.isArray(dt.tabs) ? dt.tabs : [];
  const dtHero = (dt.hero || {}) as Record<string, string>;
  const dtOp = (dt.operation_panel || {}) as Record<string, string>;

  const addContract = () => setForm({ ...form, contracts: [...form.contracts, { name: "", hash: "" }] });
  const removeContract = (i: number) => setForm({ ...form, contracts: form.contracts.filter((_, idx) => idx !== i) });
  const updateContract = (i: number, field: "name" | "hash", val: string) => {
    const next = [...form.contracts];
    next[i] = { ...next[i], [field]: val };
    setForm({ ...form, contracts: next });
  };

  const addOperation = () => setForm({ ...form, operations: [...form.operations, { name: "", method: "", description: "", gas_cost: "", button_style: "", confirm_message: "", params: [] }] });
  const removeOperation = (i: number) => setForm({ ...form, operations: form.operations.filter((_, idx) => idx !== i) });
  const updateOperation = (i: number, field: keyof OperationEntry, val: string) => {
    const next = [...form.operations];
    next[i] = { ...next[i], [field]: val };
    setForm({ ...form, operations: next });
  };

  const addComponent = () => setForm({ ...form, components: [...form.components, { type: "", display: "", props: "{}" }] });
  const removeComponent = (i: number) => setForm({ ...form, components: form.components.filter((_, idx) => idx !== i) });
  const updateComponent = (i: number, field: keyof ComponentEntry, val: string) => {
    const next = [...form.components];
    next[i] = { ...next[i], [field]: val };
    setForm({ ...form, components: next });
  };

  const applyTemplate = (key: string) => {
    const t = BLUEPRINTS[key];
    if (!t) return;
    setForm({ ...EMPTY_FORM, ...t.overrides, permissions: { ...t.overrides.permissions }, detail_template: BLUEPRINT_TEMPLATES[key] || null });
  };

  // Sync form → JSON when switching to JSON tab
  const handleTabChange = (v: string) => {
    if (v === "json" && tab !== "json") {
      const config = formToConfig(form);
      setJsonText(JSON.stringify(config, null, 2));
    }
    setTab(v);
  };

  return (
    <Card>
      <CardHeader><CardTitle>{mode === "edit" ? "Edit MiniApp" : "Create New MiniApp"}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {/* Template Selector */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Quick Start — choose a blueprint</label>
          <div className="flex gap-2">
            {Object.entries(BLUEPRINTS).map(([key, t]) => (
              <button key={key} type="button" onClick={() => applyTemplate(key)}
                className="flex-1 cursor-pointer rounded-lg border border-gray-200 dark:border-gray-700 p-3 text-left hover:border-primary-400 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50">
                <div className="text-sm font-medium">{t.label}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <Tabs tabs={CREATE_TABS} value={tab} onChange={handleTabChange} />

        {/* Tab: Basic Info */}
        {tab === "basic" && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="App ID *" placeholder="com.example.myapp" value={form.app_id} onChange={e => update("app_id", e.target.value)} disabled={mode === "edit"} />
              <Input label="Name *" placeholder="My App" value={form.name} onChange={e => update("name", e.target.value)} />
              <Input label="Entry URL *" placeholder="mf://builtin?app=com.example.myapp" value={form.entry_url} onChange={e => update("entry_url", e.target.value)} />
              <Input label="Version" placeholder="1.0.0" value={form.version} onChange={e => update("version", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Developer User ID *" placeholder="UUID from users table" value={form.developer_user_id} onChange={e => update("developer_user_id", e.target.value)} />
              <Input label="Developer Pubkey (hex)" placeholder="03f35d..." value={form.developer_pubkey} onChange={e => update("developer_pubkey", e.target.value)} />
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm pb-2">
                  <input type="checkbox" checked={form.attestation_required} onChange={e => update("attestation_required", e.target.checked)} className="rounded accent-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50" />
                  Attestation Required
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Content */}
        {tab === "content" && (
          <div className="space-y-4">
            <textarea className="w-full rounded-md border border-gray-300 dark:border-gray-600 p-2 text-sm transition-colors resize-none dark:bg-gray-800 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 placeholder:text-gray-400 dark:placeholder:text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed" rows={3} placeholder="App description" value={form.content_description} onChange={e => update("content_description", e.target.value)} aria-label="App description" />
            <div className="grid grid-cols-3 gap-4">
              <Input label="Icon URL" placeholder="https://..." value={form.content_icon_url} onChange={e => update("content_icon_url", e.target.value)} />
              <Input label="Logo URL" placeholder="https://..." value={form.content_logo_url} onChange={e => update("content_logo_url", e.target.value)} />
              <Input label="Banner URL" placeholder="https://..." value={form.content_banner_url} onChange={e => update("content_banner_url", e.target.value)} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Docs URL" placeholder="https://docs.example.com" value={form.content_docs_url} onChange={e => update("content_docs_url", e.target.value)} />
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
                <select className="w-full rounded-md border border-gray-300 dark:border-gray-600 p-2 text-sm cursor-pointer transition-colors dark:bg-gray-800 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50" value={form.content_category} onChange={e => update("content_category", e.target.value)} aria-label="Category">
                  <option value="">Select...</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <Input label="Tags (comma-separated)" placeholder="game,defi" value={form.content_tags} onChange={e => update("content_tags", e.target.value)} />
            </div>
          </div>
        )}

        {/* Tab: Page Layout */}
        {tab === "layout" && (
          <div className="space-y-6">
            {/* Hero */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Hero</label>
              <div className="grid grid-cols-2 gap-4">
                <Input label="Eyebrow" placeholder="e.g. Prediction Market" value={dtHero.eyebrow || ""} onChange={e => updateDT({ hero: { ...dtHero, eyebrow: e.target.value } })} />
                <Input label="Disclaimer" placeholder="e.g. Probabilities are market-implied." value={dtHero.disclaimer || ""} onChange={e => updateDT({ hero: { ...dtHero, disclaimer: e.target.value } })} />
              </div>
            </div>

            {/* Tabs editor */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Tabs</label>
                <button type="button" onClick={() => updateDT({ tabs: [...dtTabs, { id: `tab-${dtTabs.length}`, label: "New Tab", type: "content", blocks: [] }] })} className="text-xs cursor-pointer text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 rounded-md">+ Add Tab</button>
              </div>
              {dtTabs.map((t, i) => (
                <div key={i} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 mb-3 space-y-2">
                  <div className="flex gap-2 items-center">
                    <Input placeholder="ID" value={t.id} onChange={e => { const next = [...dtTabs]; next[i] = { ...next[i], id: e.target.value }; updateDT({ tabs: next }); }} />
                    <Input placeholder="Label" value={t.label} onChange={e => { const next = [...dtTabs]; next[i] = { ...next[i], label: e.target.value }; updateDT({ tabs: next }); }} />
                    <select className="rounded-md border border-gray-300 dark:border-gray-600 p-1.5 text-xs cursor-pointer dark:bg-gray-800 dark:text-gray-100 w-32 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50" value={t.type} onChange={e => { const next = [...dtTabs]; next[i] = { ...next[i], type: e.target.value }; updateDT({ tabs: next }); }} aria-label="Tab type">
                      {["content","reviews","forum","news","secrets"].map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                    <button type="button" onClick={() => updateDT({ tabs: dtTabs.filter((_, idx) => idx !== i) })} className="text-red-500 dark:text-red-400 text-xs px-2 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 rounded-lg">Remove</button>
                  </div>
                  {/* Content blocks for content-type tabs */}
                  {t.type === "content" && (
                    <ContentBlocksEditor blocks={t.blocks || []} onChange={blocks => { const next = [...dtTabs]; next[i] = { ...next[i], blocks }; updateDT({ tabs: next }); }} />
                  )}
                </div>
              ))}
              {!dtTabs.length && <p className="text-xs text-gray-500 dark:text-gray-400">No tabs added</p>}
            </div>

            {/* Operation Panel */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Operation Panel</label>
              <div className="grid grid-cols-3 gap-4">
                <Input label="Title" placeholder="Operations" value={dtOp.title || ""} onChange={e => updateDT({ operation_panel: { ...dtOp, title: e.target.value } })} />
                <Input label="Subtitle" placeholder="Configure and submit." value={dtOp.subtitle || ""} onChange={e => updateDT({ operation_panel: { ...dtOp, subtitle: e.target.value } })} />
                <Input label="CTA Label" placeholder="Launch App" value={dtOp.cta_label || ""} onChange={e => updateDT({ operation_panel: { ...dtOp, cta_label: e.target.value } })} />
              </div>
            </div>

            {/* Frontend Spec */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Frontend Spec (Optional)</label>
              <div className="grid grid-cols-4 gap-4 mb-2">
                <div>
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Format</label>
                  <select
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 p-2 text-sm cursor-pointer transition-colors dark:bg-gray-800 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
                    value={form.frontend_spec_format}
                    onChange={e => update("frontend_spec_format", e.target.value as FrontendSpecFormat)}
                    aria-label="Frontend spec format"
                  >
                    <option value="markdown">markdown</option>
                    <option value="yaml">yaml</option>
                    <option value="json">json</option>
                  </select>
                </div>
                <div className="col-span-3">
                  <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Spec Content</label>
                  <textarea
                    className="w-full rounded-md border border-gray-300 dark:border-gray-600 p-2 text-xs font-mono transition-colors resize-none dark:bg-gray-800 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
                    rows={6}
                    placeholder={form.frontend_spec_format === "markdown" ? "# Overview\n\nDescribe app details..." : form.frontend_spec_format === "yaml" ? "page_template:\n  layout: prediction" : "{\n  \"page_template\": { \"layout\": \"default\" }\n}"}
                    value={form.frontend_spec_content}
                    onChange={e => update("frontend_spec_content", e.target.value)}
                    aria-label="Frontend spec content"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Supports `markdown`, `yaml`, or `json`. Host app will render tabs/operation panel from this definition.
              </p>
            </div>
          </div>
        )}

        {/* Tab: Contracts & Operations */}
        {tab === "contracts" && (
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Contracts</label>
                <button type="button" onClick={addContract} className="text-xs cursor-pointer text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 rounded-md">+ Add Contract</button>
              </div>
              {form.contracts.map((c, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <Input placeholder="Contract name" value={c.name} onChange={e => updateContract(i, "name", e.target.value)} />
                  <Input placeholder="0x..." value={c.hash} onChange={e => updateContract(i, "hash", e.target.value)} />
                  <button type="button" onClick={() => removeContract(i)} className="text-red-500 dark:text-red-400 text-xs px-2 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 rounded-lg">Remove</button>
                </div>
              ))}
              {!form.contracts.length && <p className="text-xs text-gray-500 dark:text-gray-400">No contracts added</p>}
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Operations</label>
                <button type="button" onClick={addOperation} className="text-xs cursor-pointer text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 rounded-md">+ Add Operation</button>
              </div>
              {form.operations.map((o, i) => (
                <div key={i} className="rounded-lg border border-gray-200 dark:border-gray-700 p-3 mb-3 space-y-2">
                  <div className="flex gap-2">
                    <Input placeholder="Name" value={o.name} onChange={e => updateOperation(i, "name", e.target.value)} />
                    <Input placeholder="Method" value={o.method} onChange={e => updateOperation(i, "method", e.target.value)} />
                    <Input placeholder="Description" value={o.description} onChange={e => updateOperation(i, "description", e.target.value)} />
                    <Input placeholder="Gas" value={o.gas_cost} onChange={e => updateOperation(i, "gas_cost", e.target.value)} />
                    <button type="button" onClick={() => removeOperation(i)} className="text-red-500 dark:text-red-400 text-xs px-2 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 rounded-lg">Remove</button>
                  </div>
                  <div className="flex gap-2">
                    <div className="w-40">
                      <select className="w-full rounded-md border border-gray-300 dark:border-gray-600 p-1.5 text-xs cursor-pointer transition-colors dark:bg-gray-800 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50" value={o.button_style} onChange={e => updateOperation(i, "button_style", e.target.value)} aria-label="Button style">
                        <option value="">Button Style</option>
                        <option value="primary">Primary</option>
                        <option value="secondary">Secondary</option>
                        <option value="danger">Danger</option>
                        <option value="success">Success</option>
                      </select>
                    </div>
                    <Input placeholder="Confirm message (optional)" value={o.confirm_message} onChange={e => updateOperation(i, "confirm_message", e.target.value)} />
                  </div>
                  <OperationParamsEditor params={o.params} onChange={params => { const next = [...form.operations]; next[i] = { ...next[i], params }; setForm({ ...form, operations: next }); }} />
                </div>
              ))}
              {!form.operations.length && <p className="text-xs text-gray-500 dark:text-gray-400">No operations added</p>}
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Components</label>
                <button type="button" onClick={addComponent} className="text-xs cursor-pointer text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 rounded-md">+ Add Component</button>
              </div>
              {form.components.map((c, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <Input placeholder="live_voting" value={c.type} onChange={e => updateComponent(i, "type", e.target.value)} />
                  <Input placeholder="card" value={c.display} onChange={e => updateComponent(i, "display", e.target.value)} />
                  <Input placeholder='{"key":"value"}' value={c.props} onChange={e => updateComponent(i, "props", e.target.value)} />
                  <button type="button" onClick={() => removeComponent(i)} className="text-red-500 dark:text-red-400 text-xs px-2 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 rounded-lg">Remove</button>
                </div>
              ))}
              {!form.components.length && <p className="text-xs text-gray-500 dark:text-gray-400">No components added</p>}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Callback Contract" placeholder="0x..." value={form.callback_contract} onChange={e => update("callback_contract", e.target.value)} />
              <Input label="Callback Method" placeholder="onCallback" value={form.callback_method} onChange={e => update("callback_method", e.target.value)} />
            </div>
          </div>
        )}

        {/* Tab: Permissions & Limits */}
        {tab === "perms" && (
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Permissions</label>
              <div className="flex flex-wrap gap-3">
                {PERMISSION_KEYS.map(key => (
                  <label key={key} className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" checked={!!form.permissions[key]} onChange={() => togglePerm(key)} className="rounded accent-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50" />
                    {key}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <Input label="Daily Gas Cap/User" placeholder="20" value={form.daily_gas_cap_per_user} onChange={e => update("daily_gas_cap_per_user", e.target.value)} />
              <Input label="Governance Cap" placeholder="100" value={form.governance_cap} onChange={e => update("governance_cap", e.target.value)} />
              <Input label="Max Gas/Tx" placeholder="5" value={form.max_gas_per_tx} onChange={e => update("max_gas_per_tx", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Assets Allowed (comma-separated)" placeholder="GAS" value={form.assets_allowed} onChange={e => update("assets_allowed", e.target.value)} />
              <Input label="Governance Assets (comma-separated)" placeholder="BNEO" value={form.governance_assets_allowed} onChange={e => update("governance_assets_allowed", e.target.value)} />
            </div>
          </div>
        )}

        {/* Tab: JSON */}
        {tab === "json" && (
          <div className="space-y-3">
            <p className="text-xs text-gray-500 dark:text-gray-400">Paste or upload a full MiniApp manifest JSON. This will replace the form fields.</p>
            <div className="flex gap-2 items-center">
              <input type="file" accept=".json" onChange={onFileUpload} className="text-sm dark:text-gray-100 file:mr-2 file:rounded-md file:border-0 file:bg-primary-600 file:px-3 file:py-1.5 file:text-sm file:text-white file:cursor-pointer hover:file:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 rounded-md" aria-label="Upload JSON manifest" />
            </div>
            <textarea
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 p-3 font-mono text-xs transition-colors resize-none dark:bg-gray-800 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 placeholder:text-gray-400 dark:placeholder:text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
              rows={16}
              value={jsonText}
              onChange={e => setJsonText(e.target.value)}
              placeholder='{"app_id": "com.example.app", "name": "My App", ...}'
              aria-label="MiniApp manifest JSON"
            />
            <Button onClick={onImportJson} disabled={!jsonText.trim() || loading}>
              {loading ? "Importing..." : "Import from JSON"}
            </Button>
          </div>
        )}

        {formError && <p role="alert" className="text-sm text-danger-600 dark:text-danger-400">{formError}</p>}
        {tab !== "json" && (
          <div className="flex gap-2">
            <Button onClick={onSubmit} disabled={loading}>{loading ? (mode === "edit" ? "Saving..." : "Creating...") : (mode === "edit" ? "Save Changes" : "Create MiniApp")}</Button>
            {mode === "edit" && onPublish && (
              <Button
                variant="secondary"
                onClick={onPublish}
                disabled={loading}
              >
                {loading ? "Publishing..." : "Save & Publish"}
              </Button>
            )}
            <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          </div>
        )}
        {tab === "json" && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onCancel}>Cancel</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const PARAM_TYPES = ["string", "integer", "boolean", "address", "hash256", "amount", "select"];

function OperationParamsEditor({ params, onChange }: { params: OperationParam[]; onChange: (p: OperationParam[]) => void }) {
  const add = () => onChange([...params, { name: "", type: "string", label: "", required: true, default_value: "", placeholder: "", options: "" }]);
  const remove = (i: number) => onChange(params.filter((_, idx) => idx !== i));
  const update = (i: number, field: keyof OperationParam, val: string | boolean) => {
    const next = [...params];
    next[i] = { ...next[i], [field]: val };
    onChange(next);
  };

  return (
    <div className="pl-4 border-l-2 border-gray-100 dark:border-gray-800">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500 dark:text-gray-400">Parameters</span>
        <button type="button" onClick={add} className="text-xs cursor-pointer text-primary-600 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 rounded-md">+ Add Param</button>
      </div>
      {params.map((p, i) => (
        <div key={i} className="flex gap-1.5 mb-1.5 items-center">
          <Input placeholder="name" value={p.name} onChange={e => update(i, "name", e.target.value)} />
          <select className="rounded-md border border-gray-300 dark:border-gray-600 p-1.5 text-xs cursor-pointer transition-colors dark:bg-gray-800 dark:text-gray-100 w-28 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50" value={p.type} onChange={e => update(i, "type", e.target.value)} aria-label="Parameter type">
            {PARAM_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <Input placeholder="Label" value={p.label} onChange={e => update(i, "label", e.target.value)} />
          <Input placeholder="Placeholder" value={p.placeholder} onChange={e => update(i, "placeholder", e.target.value)} />
          <label className="flex items-center gap-1 text-xs shrink-0">
            <input type="checkbox" checked={p.required} onChange={e => update(i, "required", e.target.checked)} className="rounded accent-primary-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50" />
            Req
          </label>
          <button type="button" onClick={() => remove(i)} className="text-red-500 dark:text-red-400 text-xs px-1 shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 rounded-lg" aria-label="Remove parameter">×</button>
        </div>
      ))}
    </div>
  );
}

const BLOCK_TYPES = ["markdown", "bullet_list", "key_value", "notice", "links"] as const;

function ContentBlocksEditor({ blocks, onChange }: { blocks: ContentBlock[]; onChange: (b: ContentBlock[]) => void }) {
  const updateBlock = (i: number, updates: Partial<ContentBlock>) => {
    const next = [...blocks];
    next[i] = { ...next[i], ...updates };
    onChange(next);
  };
  return (
    <div className="pl-4 border-l-2 border-gray-100 dark:border-gray-800">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-500 dark:text-gray-400">Content Blocks</span>
        <select className="text-xs cursor-pointer text-primary-600 border-0 bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 rounded-md" defaultValue="" onChange={e => { if (e.target.value) { onChange([...blocks, { type: e.target.value, title: "" }]); e.target.value = ""; } }} aria-label="Add block type">
          <option value="" disabled>+ Add Block</option>
          {BLOCK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      {blocks.map((b, i) => (
        <div key={i} className="rounded border border-gray-100 dark:border-gray-700 p-2 mb-2 space-y-1">
          <div className="flex gap-2 items-center">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-20 shrink-0">{b.type}</span>
            <Input placeholder="Title" value={b.title || ""} onChange={e => updateBlock(i, { title: e.target.value })} />
            <button type="button" onClick={() => onChange(blocks.filter((_, idx) => idx !== i))} className="text-red-500 dark:text-red-400 text-xs px-1 shrink-0 cursor-pointer rounded-lg">×</button>
          </div>
          <BlockFields block={b} onChange={updates => updateBlock(i, updates)} />
        </div>
      ))}
    </div>
  );
}

function BlockFields({ block, onChange }: { block: ContentBlock; onChange: (u: Partial<ContentBlock>) => void }) {
  const t = block.type;
  if (t === "markdown") return <textarea className="w-full rounded-md border border-gray-300 dark:border-gray-600 p-2 text-xs resize-none dark:bg-gray-800 dark:text-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50" rows={3} placeholder="Markdown content" value={block.content || ""} onChange={e => onChange({ content: e.target.value })} />;
  if (t === "bullet_list") return <Input placeholder="Items (comma-separated)" value={(block.items || []).join(", ")} onChange={e => onChange({ items: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })} />;
  if (t === "notice") return (
    <div className="flex gap-2">
      <select className="rounded-md border border-gray-300 dark:border-gray-600 p-1.5 text-xs cursor-pointer dark:bg-gray-800 dark:text-gray-100 w-28 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50" value={block.tone || "info"} onChange={e => onChange({ tone: e.target.value })} aria-label="Notice tone">
        {["info","success","warning"].map(v => <option key={v} value={v}>{v}</option>)}
      </select>
      <Input placeholder="Content" value={block.content || ""} onChange={e => onChange({ content: e.target.value })} />
    </div>
  );
  if (t === "key_value") return <KVEditor entries={block.entries || []} onChange={entries => onChange({ entries })} />;
  if (t === "links") return <LinksEditor links={block.links || []} onChange={links => onChange({ links })} />;
  return null;
}

function KVEditor({ entries, onChange }: { entries: Array<{key:string;value:string}>; onChange: (e: Array<{key:string;value:string}>) => void }) {
  return (
    <div>
      {entries.map((e, i) => (
        <div key={i} className="flex gap-1.5 mb-1">
          <Input placeholder="Key" value={e.key} onChange={ev => { const n = [...entries]; n[i] = { ...n[i], key: ev.target.value }; onChange(n); }} />
          <Input placeholder="Value" value={e.value} onChange={ev => { const n = [...entries]; n[i] = { ...n[i], value: ev.target.value }; onChange(n); }} />
          <button type="button" onClick={() => onChange(entries.filter((_, idx) => idx !== i))} className="text-red-500 dark:text-red-400 text-xs px-1 shrink-0 cursor-pointer rounded-lg">×</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...entries, { key: "", value: "" }])} className="text-xs cursor-pointer text-primary-600 hover:underline rounded-md">+ Add pair</button>
    </div>
  );
}

function LinksEditor({ links, onChange }: { links: Array<{label:string;href:string}>; onChange: (l: Array<{label:string;href:string}>) => void }) {
  return (
    <div>
      {links.map((l, i) => (
        <div key={i} className="flex gap-1.5 mb-1">
          <Input placeholder="Label" value={l.label} onChange={e => { const n = [...links]; n[i] = { ...n[i], label: e.target.value }; onChange(n); }} />
          <Input placeholder="https://..." value={l.href} onChange={e => { const n = [...links]; n[i] = { ...n[i], href: e.target.value }; onChange(n); }} />
          <button type="button" onClick={() => onChange(links.filter((_, idx) => idx !== i))} className="text-red-500 dark:text-red-400 text-xs px-1 shrink-0 cursor-pointer rounded-lg">×</button>
        </div>
      ))}
      <button type="button" onClick={() => onChange([...links, { label: "", href: "" }])} className="text-xs cursor-pointer text-primary-600 hover:underline rounded-md">+ Add link</button>
    </div>
  );
}
