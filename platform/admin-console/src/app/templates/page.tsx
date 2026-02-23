"use client";

import { useMemo, useState, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import yaml from "js-yaml";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import {
  useReviewTemplateMarketRequest,
  useTemplateMarketRequests,
  useTemplateMarketTemplates,
  useUpsertTemplateMarketEntry,
  type TemplateCatalogItem,
  type TemplateKind,
  type TemplatePublishRequestRow,
  type TemplateSourceType,
} from "@/lib/hooks/useMiniApps";
import { MINIAPP_TEMPLATE_INSTALL_STORAGE_KEY } from "../miniapps/lib/template-install";

type TemplateManifestFormat = "json" | "yaml";

const CATEGORIES = ["all", "gaming", "defi", "social", "nft", "governance", "utility", "data"];

const EMPTY_FORM = {
  kind: "frontend" as TemplateKind,
  template_id: "",
  version: "1.0.0",
  name: "",
  description: "",
  category: "utility",
  source_type: "community" as TemplateSourceType,
  tags: "",
  factory_template_ref: "",
  schema_text: "{}",
  ui_schema_text: "{}",
  manifest_format: "json" as TemplateManifestFormat,
  manifest_text: "{\n  \"template\": {\n    \"id\": \"example\"\n  }\n}",
};

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  if (value === undefined || value === null) return "";
  return String(value).trim();
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean);
}

function parseManifest(text: string, format: TemplateManifestFormat): Record<string, unknown> {
  const source = String(text || "").trim();
  if (!source) {
    throw new Error("Template manifest is required");
  }

  if (format === "json") {
    const parsed = JSON.parse(source);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Manifest must be an object");
    }
    return parsed as Record<string, unknown>;
  }

  const parsed = yaml.load(source);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("YAML manifest must resolve to an object");
  }
  return parsed as Record<string, unknown>;
}

function parseJSONObject(text: string, field: string): Record<string, unknown> {
  const source = String(text || "").trim();
  if (!source) return {};
  try {
    const parsed = JSON.parse(source);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(`${field} must be a JSON object`);
    }
    return parsed as Record<string, unknown>;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "invalid JSON";
    throw new Error(`${field} parse error: ${detail}`);
  }
}

function parseTemplateId(input: string): string {
  const value = String(input || "").trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(value)) {
    throw new Error("template_id format: lowercase letters/numbers with . _ -");
  }
  return value;
}

function formatDateTime(value: string): string {
  const time = Date.parse(value || "");
  if (!Number.isFinite(time)) return value || "-";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(time));
}

function sourceBadgeVariant(source: TemplateSourceType): "info" | "success" | "default" {
  if (source === "verified") return "success";
  if (source === "builtin") return "info";
  return "default";
}

function kindBadgeVariant(kind: TemplateKind): "warning" | "info" {
  return kind === "contract" ? "warning" : "info";
}

function requestBadgeVariant(status: TemplatePublishRequestRow["status"]): "warning" | "success" | "danger" | "default" {
  if (status === "pending") return "warning";
  if (status === "approved") return "success";
  if (status === "rejected") return "danger";
  return "default";
}

function stringifyManifest(manifest: Record<string, unknown>): string {
  return JSON.stringify(manifest, null, 2);
}

type MiniAppBuilderInstallDraft = {
  source: "template_studio";
  installed_at: string;
  template_kind: TemplateKind;
  template_id: string;
  version?: string;
  variant?: string;
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  params?: Record<string, unknown>;
  factory_template_ref?: string;
  init_params?: Record<string, unknown>;
  init_schema?: Record<string, unknown>;
  method_schema?: Record<string, unknown>;
  security_profile?: Record<string, unknown>;
  requires_host_capability?: string[];
  min_factory_version?: string;
  max_factory_version?: string;
  manifest?: Record<string, unknown>;
};

function buildMiniAppInstallDraft(item: TemplateCatalogItem): MiniAppBuilderInstallDraft {
  const manifest = asObject(item.manifest);
  const templateContainer = asObject(manifest.template);
  const frontendTemplate = asObject(manifest.frontend_template ?? templateContainer.frontend_template);
  const contractTemplate = asObject(manifest.contract_template ?? templateContainer.contract_template);
  const binding = item.template_kind === "contract" ? contractTemplate : frontendTemplate;
  const contractSecurityProfile = asObject(contractTemplate.security_profile);

  const templateId = asString(binding.template_id) || item.template_id;
  const version = asString(binding.version) || asString(item.version) || "1.0.0";
  const variant = asString(binding.variant);
  const draft: MiniAppBuilderInstallDraft = {
    source: "template_studio",
    installed_at: new Date().toISOString(),
    template_kind: item.template_kind,
    template_id: templateId,
    version,
    variant: variant || undefined,
    name: asString(item.name) || undefined,
    description: asString(item.description) || undefined,
    category: asString(item.category) || undefined,
    tags: Array.isArray(item.tags) ? item.tags : [],
    manifest,
  };

  if (item.template_kind === "frontend") {
    draft.params = asObject(binding.params);
    return draft;
  }

  draft.factory_template_ref = asString(contractTemplate.factory_template_ref || item.factory_template_ref) || undefined;
  draft.init_params = asObject(contractTemplate.init_params || manifest.init_params);
  draft.init_schema = asObject(contractTemplate.init_schema);
  draft.method_schema = asObject(contractTemplate.method_schema);
  draft.security_profile = contractSecurityProfile;
  draft.requires_host_capability = asStringArray(contractTemplate.requires_host_capability);
  draft.min_factory_version = asString(contractTemplate.min_factory_version) || undefined;
  draft.max_factory_version = asString(contractTemplate.max_factory_version) || undefined;

  return draft;
}

export default function TemplateStudioPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<TemplateKind | "all">("all");
  const [category, setCategory] = useState("all");
  const [source, setSource] = useState<TemplateSourceType | "all">("all");
  const [active, setActive] = useState<"all" | "true" | "false">("all");
  const [verified, setVerified] = useState<"all" | "true" | "false">("all");
  const [requestStatus, setRequestStatus] = useState<"all" | "pending" | "approved" | "rejected" | "cancelled">("pending");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateCatalogItem | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<TemplatePublishRequestRow | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [formInfo, setFormInfo] = useState("");

  const templatesQuery = useTemplateMarketTemplates({
    kind,
    category: category === "all" ? undefined : category,
    source,
    active,
    verified,
    search,
    limit: 200,
  });

  const requestsQuery = useTemplateMarketRequests({
    kind,
    status: requestStatus,
    limit: 200,
  });

  const upsertMutation = useUpsertTemplateMarketEntry();
  const reviewMutation = useReviewTemplateMarketRequest();

  const templates = templatesQuery.data?.templates || [];
  const requests = requestsQuery.data?.requests || [];

  const selectedManifestText = useMemo(() => {
    if (!selectedTemplate) return "";
    return stringifyManifest(selectedTemplate.manifest || {});
  }, [selectedTemplate]);

  const applyTemplateToForm = (item: TemplateCatalogItem) => {
    setForm((prev) => ({
      ...prev,
      kind: item.template_kind,
      template_id: item.template_id,
      version: item.version || "1.0.0",
      name: item.name || "",
      description: item.description || "",
      category: item.category || "utility",
      source_type: item.source_type,
      tags: (item.tags || []).join(", "),
      factory_template_ref: item.factory_template_ref || "",
      schema_text: stringifyManifest(item.schema || {}),
      ui_schema_text: stringifyManifest(item.ui_schema || {}),
      manifest_format: "json",
      manifest_text: stringifyManifest(item.manifest || {}),
    }));
    setFormError("");
    setFormInfo(`Loaded ${item.template_id}@${item.version} into editor.`);
  };

  const onUploadTemplateFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setFormError("");
      setFormInfo("");
      try {
        const rawText = String(reader.result || "");
        const parsed = parseManifest(rawText, file.name.toLowerCase().endsWith(".json") ? "json" : "yaml");
        const templateContainer = asObject(parsed.template);
        const frontendTemplate = asObject(parsed.frontend_template ?? templateContainer.frontend_template);
        const contractTemplate = asObject(parsed.contract_template ?? templateContainer.contract_template);
        const kindFromPayload = String(parsed.kind || "").trim().toLowerCase();
        const inferredKind: TemplateKind =
          kindFromPayload === "contract"
            ? "contract"
            : kindFromPayload === "frontend"
              ? "frontend"
              : contractTemplate.template_id && !frontendTemplate.template_id
                ? "contract"
                : "frontend";

        const manifest = asObject(parsed.manifest);
        const manifestPayload = Object.keys(manifest).length ? manifest : parsed;

        const inferredTemplateId =
          String(
            parsed.template_id ||
            (inferredKind === "contract" ? contractTemplate.template_id : frontendTemplate.template_id) ||
            "",
          ).trim();

        const inferredVersion =
          String(
            parsed.version ||
            (inferredKind === "contract" ? contractTemplate.version : frontendTemplate.version) ||
            "1.0.0",
          ).trim();

        const sourceTypeRaw = String(parsed.source_type || "").trim().toLowerCase();
        const sourceType: TemplateSourceType =
          sourceTypeRaw === "builtin" || sourceTypeRaw === "verified" ? sourceTypeRaw : "community";

        const tags = Array.isArray(parsed.tags)
          ? parsed.tags.map((item) => String(item || "").trim()).filter(Boolean).join(", ")
          : "";

        setForm((prev) => ({
          ...prev,
          kind: inferredKind,
          template_id: inferredTemplateId || prev.template_id,
          version: inferredVersion || prev.version,
          name: String(parsed.name || prev.name || inferredTemplateId).trim(),
          description: String(parsed.description || prev.description || "").trim(),
          category: String(parsed.category || prev.category || "utility").trim() || "utility",
          source_type: sourceType,
          tags,
          factory_template_ref: String(
            parsed.factory_template_ref ||
            contractTemplate.factory_template_ref ||
            prev.factory_template_ref ||
            "",
          ).trim(),
          schema_text: stringifyManifest(asObject(parsed.schema)),
          ui_schema_text: stringifyManifest(asObject(parsed.ui_schema)),
          manifest_format: "json",
          manifest_text: stringifyManifest(manifestPayload),
        }));
        setFormInfo(`Loaded template payload from ${file.name}`);
      } catch (error) {
        setFormError(error instanceof Error ? error.message : "Failed to parse template file");
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  const onSubmit = async () => {
    setFormError("");
    setFormInfo("");

    try {
      if (!form.template_id.trim()) {
        throw new Error("template_id is required");
      }

      const manifest = parseManifest(form.manifest_text, form.manifest_format);
      const schema = parseJSONObject(form.schema_text, "schema_text");
      const uiSchema = parseJSONObject(form.ui_schema_text, "ui_schema_text");
      const normalizedTemplateId = parseTemplateId(form.template_id);
      const response = await upsertMutation.mutateAsync({
        kind: form.kind,
        template_id: normalizedTemplateId,
        version: form.version.trim() || "1.0.0",
        name: form.name.trim() || form.template_id.trim(),
        description: form.description.trim(),
        category: form.category.trim() || "utility",
        source_type: form.source_type,
        tags: form.tags
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        schema,
        ui_schema: uiSchema,
        manifest,
        factory_template_ref: form.factory_template_ref.trim() || null,
      });

      if (response?.approval_required) {
        setFormInfo("Template saved. Publish request created and waiting for review.");
      } else {
        setFormInfo("Template saved and published.");
      }
      setForm((prev) => ({ ...prev, template_id: normalizedTemplateId, manifest_text: stringifyManifest(manifest) }));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to save template");
    }
  };

  const onReviewRequest = async (request: TemplatePublishRequestRow, decision: "approve" | "reject" | "cancel") => {
    setFormError("");
    setFormInfo("");
    try {
      await reviewMutation.mutateAsync({
        requestId: request.id,
        decision,
      });
      setFormInfo(`Request ${request.id.slice(0, 8)} ${decision}d.`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to review request");
    }
  };

  const installTemplateToMiniAppBuilder = (item: TemplateCatalogItem) => {
    try {
      const draft = buildMiniAppInstallDraft(item);
      window.localStorage.setItem(MINIAPP_TEMPLATE_INSTALL_STORAGE_KEY, JSON.stringify(draft));
      setFormInfo(`Template ${item.template_id}@${item.version} installed into MiniApp Builder draft.`);
      router.push("/miniapps?installed_template=1");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to install template to MiniApp Builder");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Template Studio</h1>
        <p className="text-gray-600 dark:text-gray-400">No-code template marketplace for frontend and contract miniapp templates.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Template Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 lg:grid-cols-6">
            <Input label="Search" placeholder="template id/name/tag" value={search} onChange={(e) => setSearch(e.target.value)} />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Kind</label>
              <select className="w-full rounded-md border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" value={kind} onChange={(e) => setKind(e.target.value as TemplateKind | "all")}> 
                <option value="all">all</option>
                <option value="frontend">frontend</option>
                <option value="contract">contract</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Category</label>
              <select className="w-full rounded-md border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" value={category} onChange={(e) => setCategory(e.target.value)}>
                {CATEGORIES.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Source</label>
              <select className="w-full rounded-md border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" value={source} onChange={(e) => setSource(e.target.value as TemplateSourceType | "all")}> 
                <option value="all">all</option>
                <option value="builtin">builtin</option>
                <option value="community">community</option>
                <option value="verified">verified</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Active</label>
              <select className="w-full rounded-md border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" value={active} onChange={(e) => setActive(e.target.value as "all" | "true" | "false")}> 
                <option value="all">all</option>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Verified</label>
              <select className="w-full rounded-md border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" value={verified} onChange={(e) => setVerified(e.target.value as "all" | "true" | "false")}> 
                <option value="all">all</option>
                <option value="true">true</option>
                <option value="false">false</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Template Marketplace ({templates.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {templatesQuery.isLoading ? (
              <Spinner />
            ) : templatesQuery.isError ? (
              <p className="text-sm text-danger-600 dark:text-danger-400">{templatesQuery.error instanceof Error ? templatesQuery.error.message : "Failed to load templates"}</p>
            ) : !templates.length ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No templates found.</p>
            ) : (
              <div className="space-y-3">
                {templates.map((item) => (
                  <button
                    key={`${item.template_kind}:${item.row_id}`}
                    type="button"
                    onClick={() => setSelectedTemplate(item)}
                    className="w-full rounded-lg border border-gray-200 p-3 text-left transition-colors hover:border-primary-400 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-medium text-gray-900 dark:text-gray-100">{item.name}</span>
                      <Badge variant={kindBadgeVariant(item.template_kind)}>{item.template_kind}</Badge>
                      <Badge variant={sourceBadgeVariant(item.source_type)}>{item.source_type}</Badge>
                      {item.is_verified ? <Badge variant="success">verified</Badge> : null}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400"><code>{item.template_id}</code> · v{item.version} · {item.category}</p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">{item.description || "No description"}</p>
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">usage {item.usage_count} · rating {item.rating_avg ?? "-"} ({item.rating_count})</div>
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Template Detail</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!selectedTemplate ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Select a template to view details.</p>
            ) : (
              <>
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{selectedTemplate.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{selectedTemplate.template_id} · v{selectedTemplate.version}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant={kindBadgeVariant(selectedTemplate.template_kind)}>{selectedTemplate.template_kind}</Badge>
                  <Badge variant={sourceBadgeVariant(selectedTemplate.source_type)}>{selectedTemplate.source_type}</Badge>
                  {selectedTemplate.is_active ? <Badge variant="success">active</Badge> : <Badge variant="danger">inactive</Badge>}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300">{selectedTemplate.description || "No description"}</p>
                <div className="grid grid-cols-2 gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <div>Updated: {formatDateTime(selectedTemplate.updated_at)}</div>
                  <div>Category: {selectedTemplate.category}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => applyTemplateToForm(selectedTemplate)}>Load Into Editor</Button>
                  <Button size="sm" onClick={() => installTemplateToMiniAppBuilder(selectedTemplate)}>Install To MiniApp Builder</Button>
                </div>
                <pre className="max-h-64 overflow-auto rounded-md bg-gray-50 p-2 text-xs dark:bg-gray-800">{selectedManifestText}</pre>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Publish Requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-300">Status</label>
            <select className="rounded-md border border-gray-300 p-1.5 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" value={requestStatus} onChange={(e) => setRequestStatus(e.target.value as "all" | "pending" | "approved" | "rejected" | "cancelled")}> 
              <option value="pending">pending</option>
              <option value="all">all</option>
              <option value="approved">approved</option>
              <option value="rejected">rejected</option>
              <option value="cancelled">cancelled</option>
            </select>
          </div>

          {requestsQuery.isLoading ? (
            <Spinner />
          ) : requestsQuery.isError ? (
            <p className="text-sm text-danger-600 dark:text-danger-400">{requestsQuery.error instanceof Error ? requestsQuery.error.message : "Failed to load requests"}</p>
          ) : !requests.length ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No publish requests.</p>
          ) : (
            <div className="space-y-2">
              {requests.map((request) => (
                <div key={request.id} className="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-mono text-xs text-gray-600 dark:text-gray-300">{request.id.slice(0, 8)}</span>
                    <Badge variant={kindBadgeVariant(request.template_kind)}>{request.template_kind}</Badge>
                    <Badge variant={requestBadgeVariant(request.status)}>{request.status}</Badge>
                    <span className="ml-auto text-xs text-gray-500 dark:text-gray-400">{formatDateTime(request.created_at)}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">template row: {request.template_row_id}</p>
                  <div className="mt-2 flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => setSelectedRequest(request)}>View</Button>
                      {request.status === "pending" ? (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => onReviewRequest(request, "approve")} disabled={reviewMutation.isPending}>Approve</Button>
                          <Button size="sm" variant="ghost" onClick={() => onReviewRequest(request, "reject")} disabled={reviewMutation.isPending}>Reject</Button>
                          <Button size="sm" variant="ghost" onClick={() => onReviewRequest(request, "cancel")} disabled={reviewMutation.isPending}>Cancel</Button>
                        </>
                      ) : null}
                    </div>
                </div>
              ))}
            </div>
          )}

          {selectedRequest ? (
            <div className="rounded-md bg-gray-50 p-3 text-xs text-gray-600 dark:bg-gray-800 dark:text-gray-300">
              <div>Request: {selectedRequest.id}</div>
              <div>Requested by: {selectedRequest.requested_by}</div>
              <div>Reviewed by: {selectedRequest.reviewed_by || "-"}</div>
              <div>Note: {selectedRequest.review_note || "-"}</div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Upload / Edit Template (JSON or YAML)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Import Template File</label>
            <input
              type="file"
              accept=".json,.yaml,.yml"
              onChange={onUploadTemplateFile}
              className="text-sm dark:text-gray-100 file:mr-2 file:rounded-md file:border-0 file:bg-primary-600 file:px-3 file:py-1.5 file:text-sm file:text-white file:cursor-pointer hover:file:bg-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 rounded-md"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Kind</label>
              <select className="w-full rounded-md border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as TemplateKind })}>
                <option value="frontend">frontend</option>
                <option value="contract">contract</option>
              </select>
            </div>
            <Input label="Template ID" value={form.template_id} onChange={(e) => setForm({ ...form, template_id: e.target.value })} placeholder="prediction.market.modern" />
            <Input label="Version" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="1.0.0" />
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Source</label>
              <select className="w-full rounded-md border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" value={form.source_type} onChange={(e) => setForm({ ...form, source_type: e.target.value as TemplateSourceType })}>
                <option value="community">community</option>
                <option value="builtin">builtin</option>
                <option value="verified">verified</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Input label="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Prediction Market UI" />
            <Input label="Category" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="defi" />
            <Input label="Contract Template Ref" value={form.factory_template_ref} onChange={(e) => setForm({ ...form, factory_template_ref: e.target.value })} placeholder="factory.prediction.v2" />
          </div>

          <Input label="Tags" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="prediction, market, no-code" />

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Description</label>
            <textarea className="w-full rounded-md border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What this template is for and what is customizable." />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Param Schema (JSON)</label>
              <textarea
                className="w-full rounded-md border border-gray-300 p-2 font-mono text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                rows={8}
                value={form.schema_text}
                onChange={(e) => setForm({ ...form, schema_text: e.target.value })}
                placeholder={`{
  "type": "object",
  "properties": {}
}`}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">UI Schema (JSON)</label>
              <textarea
                className="w-full rounded-md border border-gray-300 p-2 font-mono text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
                rows={8}
                value={form.ui_schema_text}
                onChange={(e) => setForm({ ...form, ui_schema_text: e.target.value })}
                placeholder={`{
  "ui:order": []
}`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Manifest Format</label>
              <select className="w-full rounded-md border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" value={form.manifest_format} onChange={(e) => setForm({ ...form, manifest_format: e.target.value as TemplateManifestFormat })}>
                <option value="json">json</option>
                <option value="yaml">yaml</option>
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">Template Manifest</label>
              <textarea className="w-full rounded-md border border-gray-300 p-2 font-mono text-xs dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100" rows={12} value={form.manifest_text} onChange={(e) => setForm({ ...form, manifest_text: e.target.value })} placeholder={form.manifest_format === "json" ? "{\n  \"key\": \"value\"\n}" : "template:\n  key: value"} />
            </div>
          </div>

          {formError ? <p className="text-sm text-danger-600 dark:text-danger-400">{formError}</p> : null}
          {formInfo ? <p className="text-sm text-gray-600 dark:text-gray-300">{formInfo}</p> : null}

          <div className="flex gap-2">
            <Button onClick={onSubmit} disabled={upsertMutation.isPending}>{upsertMutation.isPending ? "Saving..." : "Save Template"}</Button>
            <Button variant="secondary" onClick={() => { setForm(EMPTY_FORM); setFormError(""); setFormInfo(""); }}>Reset</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
