"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { type ContractInitSchemaField, extractContractInitSchemaFields } from "../lib/contract-init-schema";
import {
  buildModularPlanFilename,
  buildModularPlanPathHint,
  buildModularPreview,
  buildModularRegistrationDraft,
  buildModularValidateOnlyCommand,
} from "../lib/modular-preview";
import { downloadJsonFile } from "../lib/download-utils";
import type { MiniAppMediaAssetKind, MiniAppMediaUploadVariant, MediaUploadOptions } from "@/lib/hooks/useMiniApps";
import { BasicTab } from "./create-form-tabs/BasicTab";
import { ContentTab } from "./create-form-tabs/ContentTab";
import { LayoutTab } from "./create-form-tabs/LayoutTab";
import { ContractsTab } from "./create-form-tabs/ContractsTab";
import { PermissionsTab } from "./create-form-tabs/PermissionsTab";
import { JsonTab } from "./create-form-tabs/JsonTab";

import type { MiniAppFormState } from "../lib/form-types";

type AssetVariantSettings = {
  theme: "" | "light" | "dark" | "any";
  density: "" | "1x" | "2x" | "3x";
  locale: string;
  applyAsPrimary: boolean;
};

type ContentBlock = {
  type: string;
  title?: string;
  content?: string;
  items?: string[];
  tone?: string;
  entries?: Array<{ key: string; value: string }>;
  links?: Array<{ label: string; href: string }>;
};

type DetailTemplate = {
  layout?: string;
  hero?: Record<string, string>;
  tabs?: Array<{ id: string; label: string; type: string; blocks?: ContentBlock[] }>;
  operation_panel?: Record<string, string>;
};

type OperationParam = {
  name: string;
  type: string;
  label: string;
  required: boolean;
  default_value: string;
  placeholder: string;
  options: string;
};

type OperationEntry = {
  name: string;
  method: string;
  description: string;
  gas_cost: string;
  button_style: string;
  confirm_message: string;
  params: OperationParam[];
};

type ComponentEntry = {
  type: string;
  display: string;
  props: string;
};

type BlueprintItem = {
  label: string;
  desc: string;
  overrides: Partial<MiniAppFormState>;
};

type CreateFormPanelProps = {
  form: MiniAppFormState;
  setForm: (form: MiniAppFormState) => void;
  formError: string;
  loading: boolean;
  onSubmit: () => void;
  onPublish?: () => void;
  onCancel: () => void;
  jsonText: string;
  setJsonText: (s: string) => void;
  onImportJson: () => void;
  onFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  onUploadMediaAsset: (assetType: MiniAppMediaAssetKind, file: File, options?: MediaUploadOptions) => Promise<void>;
  mediaUploadPending: boolean;
  mediaUploadError: string;
  mediaUploadInfo: string;
  mode?: "create" | "edit";
  createTabs: Array<{ label: string; value: string }>;
  permissionKeys: string[];
  categories: string[];
  blueprints: Record<string, BlueprintItem>;
  blueprintTemplates: Record<string, DetailTemplate>;
  emptyForm: MiniAppFormState;
  toConfig: (form: MiniAppFormState) => Record<string, unknown>;
  parseJSONObjectText: (input: string, fieldName: string) => Record<string, unknown>;
};

export function CreateFormPanel({
  form, setForm, formError, loading, onSubmit, onPublish, onCancel,
  jsonText, setJsonText, onImportJson, onFileUpload,
  onUploadMediaAsset, mediaUploadPending, mediaUploadError, mediaUploadInfo,
  mode = "create", createTabs, permissionKeys, categories, blueprints, blueprintTemplates, emptyForm, toConfig,
  parseJSONObjectText,
}: CreateFormPanelProps) {
  const [tab, setTab] = useState("basic");
  const [modularCommandInfo, setModularCommandInfo] = useState("");
  const [assetFiles, setAssetFiles] = useState<Partial<Record<MiniAppMediaAssetKind, File>>>({});
  const [assetVariantSettings, setAssetVariantSettings] = useState<Record<"logo" | "banner", AssetVariantSettings>>({
    logo: { theme: "", density: "", locale: "", applyAsPrimary: true },
    banner: { theme: "", density: "", locale: "", applyAsPrimary: true },
  });
  const update = (key: string, value: string | boolean) => setForm({ ...form, [key]: value });
  const togglePerm = (key: string) => setForm({ ...form, permissions: { ...form.permissions, [key]: !form.permissions[key] } });
  const updateAssetVariantSettings = (
    kind: "logo" | "banner",
    next: Partial<AssetVariantSettings>,
  ) => {
    setAssetVariantSettings((prev) => ({
      ...prev,
      [kind]: {
        ...prev[kind],
        ...next,
      },
    }));
  };

  const handleAssetFileSelect = (assetType: MiniAppMediaAssetKind, event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setAssetFiles((prev) => ({
      ...prev,
      [assetType]: file,
    }));
  };

  const contractInitSchemaState = useMemo(
    () => extractContractInitSchemaFields(form.contract_template_init_schema_json),
    [form.contract_template_init_schema_json],
  );
  const contractInitParamValues = useMemo(() => {
    try {
      return parseJSONObjectText(form.contract_template_init_params_json, "contract_template_init_params_json");
    } catch (_e: unknown) {
      console.warn("[CreateFormPanel] init params JSON parse failed:", _e instanceof Error ? _e.message : String(_e));
      return {} as Record<string, unknown>;
    }
  }, [form.contract_template_init_params_json]);
  const modularPreview = useMemo(() => buildModularPreview(form, toConfig), [form, toConfig]);
  const modularPlanDraft = useMemo(() => buildModularRegistrationDraft(form, toConfig), [form, toConfig]);
  const modularPlanFilename = useMemo(
    () => buildModularPlanFilename(String(form.app_id || "").trim()),
    [form.app_id],
  );
  const modularPlanPathHint = useMemo(
    () => (modularPlanDraft ? buildModularPlanPathHint(modularPlanDraft, modularPlanFilename) : ""),
    [modularPlanDraft, modularPlanFilename],
  );
  const modularValidateOnlyCommand = useMemo(
    () => (modularPlanDraft ? buildModularValidateOnlyCommand(modularPlanDraft, modularPlanPathHint) : ""),
    [modularPlanDraft, modularPlanPathHint],
  );

  const updateContractInitParamField = (field: ContractInitSchemaField, rawValue: string | boolean) => {
    const next = {
      ...contractInitParamValues,
    };

    if (field.type === "boolean") {
      next[field.key] = Boolean(rawValue);
      update("contract_template_init_params_json", JSON.stringify(next, null, 2));
      return;
    }

    const textValue = String(rawValue).trim();
    if (!textValue) {
      delete next[field.key];
      update("contract_template_init_params_json", JSON.stringify(next, null, 2));
      return;
    }

    if (field.type === "number" || field.type === "integer") {
      const numeric = Number(textValue);
      if (!Number.isFinite(numeric)) return;
      next[field.key] = field.type === "integer" ? Math.trunc(numeric) : numeric;
      update("contract_template_init_params_json", JSON.stringify(next, null, 2));
      return;
    }

    next[field.key] = textValue;
    update("contract_template_init_params_json", JSON.stringify(next, null, 2));
  };

  const applyContractSchemaDefaults = () => {
    if (!contractInitSchemaState.fields.length) return;
    const next = {
      ...contractInitParamValues,
    };
    let changed = false;

    for (const field of contractInitSchemaState.fields) {
      if (next[field.key] !== undefined) continue;
      if (field.defaultValue === undefined) continue;
      next[field.key] = field.defaultValue;
      changed = true;
    }

    if (!changed) return;
    update("contract_template_init_params_json", JSON.stringify(next, null, 2));
  };

  const dt = (form.detail_template || {}) as DetailTemplate;
  const updateDT = (updates: Partial<DetailTemplate>) => setForm({ ...form, detail_template: { ...dt, ...updates } });
  const dtTabs: Array<{id:string;label:string;type:string;blocks?:ContentBlock[]}> = Array.isArray(dt.tabs) ? dt.tabs : [];
  const dtHero = (dt.hero || {}) as Record<string, string>;
  const dtOp = (dt.operation_panel || {}) as Record<string, string>;

  const addContract = () => setForm({ ...form, contracts: [...form.contracts, { name: "", hash: "" }] });
  const removeContract = (i: number) => setForm({ ...form, contracts: form.contracts.filter((_: unknown, idx: number) => idx !== i) });
  const updateContract = (i: number, field: "name" | "hash", val: string) => {
    const next = [...form.contracts];
    next[i] = { ...next[i], [field]: val };
    setForm({ ...form, contracts: next });
  };

  const addOperation = () => setForm({ ...form, operations: [...form.operations, { name: "", method: "", description: "", gas_cost: "", button_style: "", confirm_message: "", params: [] }] });
  const removeOperation = (i: number) => setForm({ ...form, operations: form.operations.filter((_: unknown, idx: number) => idx !== i) });
  const updateOperation = (i: number, field: keyof OperationEntry, val: string) => {
    const next = [...form.operations];
    next[i] = { ...next[i], [field]: val };
    setForm({ ...form, operations: next });
  };

  const addComponent = () => setForm({ ...form, components: [...form.components, { type: "", display: "", props: "{}" }] });
  const removeComponent = (i: number) => setForm({ ...form, components: form.components.filter((_: unknown, idx: number) => idx !== i) });
  const updateComponent = (i: number, field: keyof ComponentEntry, val: string) => {
    const next = [...form.components];
    next[i] = { ...next[i], [field]: val };
    setForm({ ...form, components: next });
  };

  const applyTemplate = (key: string) => {
    const t = blueprints[key];
    if (!t) return;
    setForm({ ...emptyForm, ...t.overrides, permissions: { ...t.overrides.permissions }, detail_template: blueprintTemplates[key] || null });
  };

  // Sync form → JSON when switching to JSON tab
  const handleTabChange = (v: string) => {
    if (v === "json" && tab !== "json") {
      try {
        const config = toConfig(form);
        setJsonText(JSON.stringify(config, null, 2));
      } catch (error) {
        setJsonText("");
      }
    }
    setTab(v);
  };

  const copyValidateOnlyCommand = async () => {
    const command = modularValidateOnlyCommand;
    try {
      await navigator.clipboard.writeText(command);
      setModularCommandInfo("Copied validate-only command.");
    } catch (_e: unknown) {
      setModularCommandInfo(command);
    }
  };

  return (
    <Card variant="glass">
      <CardHeader><CardTitle>{mode === "edit" ? "Edit MiniApp" : "Create New MiniApp"}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {/* Template Marketplace Selector */}
        <div className="mb-6 rounded-xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900/50 p-6 overflow-hidden relative">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 rounded-full bg-primary-100/50 dark:bg-primary-900/20 blur-2xl"></div>
          <div className="absolute bottom-0 left-0 -ml-8 -mb-8 w-32 h-32 rounded-full bg-blue-100/50 dark:bg-blue-900/20 blur-2xl"></div>
          <div className="relative">
            <h3 className="mb-2 text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <span className="text-xl">🏪</span> Template Marketplace
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
              Select a fully-featured template to scaffold your MiniApp frontend and smart contract without writing code.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {Object.entries(blueprints).map(([key, t]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => applyTemplate(key)}
                  className="group relative flex flex-col items-start rounded-xl border border-gray-200 bg-white p-4 text-left transition-all hover:-translate-y-1 hover:border-primary-400 hover:shadow-lg hover:shadow-primary-500/10 dark:border-gray-700 dark:bg-gray-800 dark:hover:border-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
                >
                  <div className="mb-3 rounded-lg bg-primary-50 p-2 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                  <div className="text-base font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                    {t.label}
                  </div>
                  <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    {t.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        <Tabs tabs={createTabs} value={tab} onChange={handleTabChange} />

        {/* Tab: Basic Info */}
        {tab === "basic" && (
          <BasicTab
            form={form}
            mode={mode}
            update={update}
            contractInitSchemaState={contractInitSchemaState}
            contractInitParamValues={contractInitParamValues}
            updateContractInitParamField={updateContractInitParamField}
            applyContractSchemaDefaults={applyContractSchemaDefaults}
          />
        )}

        {/* Tab: Content */}
        {tab === "content" && (
          <ContentTab
            form={form}
            categories={categories}
            update={update}
            assetFiles={assetFiles}
            assetVariantSettings={assetVariantSettings}
            updateAssetVariantSettings={updateAssetVariantSettings}
            handleAssetFileSelect={handleAssetFileSelect}
            onUploadMediaAsset={onUploadMediaAsset}
            mediaUploadPending={mediaUploadPending}
            mediaUploadError={mediaUploadError}
            mediaUploadInfo={mediaUploadInfo}
          />
        )}

        {/* Tab: Page Layout */}
        {tab === "layout" && (
          <LayoutTab
            form={form}
            update={update}
            dtTabs={dtTabs}
            dtHero={dtHero}
            dtOp={dtOp}
            updateDT={updateDT}
          />
        )}

        {/* Tab: Contracts & Operations */}
        {tab === "contracts" && (
          <ContractsTab
            form={form}
            update={update}
            setForm={setForm}
            addContract={addContract}
            removeContract={removeContract}
            updateContract={updateContract}
            addOperation={addOperation}
            removeOperation={removeOperation}
            updateOperation={updateOperation}
            addComponent={addComponent}
            removeComponent={removeComponent}
            updateComponent={updateComponent}
            modularPreview={modularPreview}
          />
        )}

        {/* Tab: Permissions & Limits */}
        {tab === "perms" && (
          <PermissionsTab
            form={form}
            permissionKeys={permissionKeys}
            togglePerm={togglePerm}
            update={update}
          />
        )}

        {/* Tab: JSON */}
        {tab === "json" && (
          <JsonTab
            jsonText={jsonText}
            setJsonText={setJsonText}
            onFileUpload={onFileUpload}
            onImportJson={onImportJson}
            loading={loading}
          />
        )}

        {formError && <p role="alert" className="text-sm text-danger-600 dark:text-danger-400">{formError}</p>}
        {modularPlanDraft && modularPreview.valid && !formError && (
          <details className="rounded-xl border border-gray-200 bg-gray-50/70 p-3 text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-300">
            <summary className="cursor-pointer list-none font-semibold text-gray-900 dark:text-gray-100 focus-visible:outline-none">
              Modular thin plan usage
            </summary>
            <div className="mt-3 space-y-2">
              <p>
                Suggested plan path:
                {" "}
                <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] dark:bg-gray-950">{modularPlanPathHint}</code>
              </p>
              {modularPlanDraft.definition_path && (
                <p>
                  Definition source:
                  {" "}
                  <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] dark:bg-gray-950">{modularPlanDraft.definition_path}</code>
                </p>
              )}
              <p>
                Validate-only usage:
                {" "}
                <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] dark:bg-gray-950">{modularValidateOnlyCommand}</code>
              </p>
            </div>
          </details>
        )}
        {modularCommandInfo && !formError && (
          <p className="text-xs text-gray-500 dark:text-gray-400">{modularCommandInfo}</p>
        )}
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
            {modularPlanDraft && modularPreview.valid && (
              <Button
                variant="secondary"
                onClick={() => downloadJsonFile(
                  modularPlanDraft,
                  modularPlanFilename,
                )}
              >
                Download Thin Plan
              </Button>
            )}
            {modularPlanDraft && modularPreview.valid && (
              <Button variant="secondary" onClick={copyValidateOnlyCommand}>
                Copy Validate-Only Command
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
