"use client";

import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import yaml from "js-yaml";
import {
  Boxes,
  CheckCircle2,
  FileCode2,
  GitPullRequestArrow,
  Search,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";
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

const CATEGORIES = [
  "all",
  "gaming",
  "defi",
  "social",
  "nft",
  "governance",
  "utility",
  "data",
];

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
  manifest_text: '{\n "template": {\n "id": "example"\n }\n}',
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

function parseManifest(
  text: string,
  format: TemplateManifestFormat,
): Record<string, unknown> {
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
  const value = String(input || "")
    .trim()
    .toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(value)) {
    throw new Error(
      `parseTemplateId: invalid template_id="${value}" — must be lowercase letters/numbers with . _ -`,
    );
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

function sourceBadgeVariant(
  source: TemplateSourceType,
): "info" | "success" | "default" {
  if (source === "verified") return "success";
  if (source === "miniapp") return "info";
  return "default";
}

function kindBadgeVariant(kind: TemplateKind): "warning" | "info" {
  return kind === "contract" ? "warning" : "info";
}

function requestBadgeVariant(
  status: TemplatePublishRequestRow["status"],
): "warning" | "success" | "danger" | "default" {
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

function buildMiniAppInstallDraft(
  item: TemplateCatalogItem,
): MiniAppBuilderInstallDraft {
  const manifest = asObject(item.manifest);
  const templateContainer = asObject(manifest.template);
  const frontendTemplate = asObject(
    manifest.frontend_template ?? templateContainer.frontend_template,
  );
  const contractTemplate = asObject(
    manifest.contract_template ?? templateContainer.contract_template,
  );
  const binding =
    item.template_kind === "contract" ? contractTemplate : frontendTemplate;
  const contractSecurityProfile = asObject(contractTemplate.security_profile);

  const templateId = asString(binding.template_id) || item.template_id;
  const version =
    asString(binding.version) || asString(item.version) || "1.0.0";
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

  draft.factory_template_ref =
    asString(
      contractTemplate.factory_template_ref || item.factory_template_ref,
    ) || undefined;
  draft.init_params = asObject(
    contractTemplate.init_params || manifest.init_params,
  );
  draft.init_schema = asObject(contractTemplate.init_schema);
  draft.method_schema = asObject(contractTemplate.method_schema);
  draft.security_profile = contractSecurityProfile;
  draft.requires_host_capability = asStringArray(
    contractTemplate.requires_host_capability,
  );
  draft.min_factory_version =
    asString(contractTemplate.min_factory_version) || undefined;
  draft.max_factory_version =
    asString(contractTemplate.max_factory_version) || undefined;

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
  const [requestStatus, setRequestStatus] = useState<
    "all" | "pending" | "approved" | "rejected" | "cancelled"
  >("pending");
  const [selectedTemplate, setSelectedTemplate] =
    useState<TemplateCatalogItem | null>(null);
  const [selectedRequest, setSelectedRequest] =
    useState<TemplatePublishRequestRow | null>(null);
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
  const verifiedTemplates = templates.filter((item) => item.is_verified).length;
  const activeTemplates = templates.filter((item) => item.is_active).length;
  const pendingRequests = requests.filter(
    (request) => request.status === "pending",
  ).length;
  const hasTemplateError = templatesQuery.isError;
  const hasRequestError = requestsQuery.isError;

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
        const parsed = parseManifest(
          rawText,
          file.name.toLowerCase().endsWith(".json") ? "json" : "yaml",
        );
        const templateContainer = asObject(parsed.template);
        const frontendTemplate = asObject(
          parsed.frontend_template ?? templateContainer.frontend_template,
        );
        const contractTemplate = asObject(
          parsed.contract_template ?? templateContainer.contract_template,
        );
        const kindFromPayload = String(parsed.kind || "")
          .trim()
          .toLowerCase();
        const inferredKind: TemplateKind =
          kindFromPayload === "contract"
            ? "contract"
            : kindFromPayload === "frontend"
              ? "frontend"
              : contractTemplate.template_id && !frontendTemplate.template_id
                ? "contract"
                : "frontend";

        const manifest = asObject(parsed.manifest);
        const manifestPayload = Object.keys(manifest).length
          ? manifest
          : parsed;

        const inferredTemplateId = String(
          parsed.template_id ||
            (inferredKind === "contract"
              ? contractTemplate.template_id
              : frontendTemplate.template_id) ||
            "",
        ).trim();

        const inferredVersion = String(
          parsed.version ||
            (inferredKind === "contract"
              ? contractTemplate.version
              : frontendTemplate.version) ||
            "1.0.0",
        ).trim();

        const sourceTypeRaw = String(parsed.source_type || "")
          .trim()
          .toLowerCase();
        const sourceType: TemplateSourceType =
          sourceTypeRaw === "miniapp" || sourceTypeRaw === "verified"
            ? sourceTypeRaw
            : "community";

        const tags = Array.isArray(parsed.tags)
          ? parsed.tags
              .map((item) => String(item || "").trim())
              .filter(Boolean)
              .join(", ")
          : "";

        setForm((prev) => ({
          ...prev,
          kind: inferredKind,
          template_id: inferredTemplateId || prev.template_id,
          version: inferredVersion || prev.version,
          name: String(parsed.name || prev.name || inferredTemplateId).trim(),
          description: String(
            parsed.description || prev.description || "",
          ).trim(),
          category:
            String(parsed.category || prev.category || "utility").trim() ||
            "utility",
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
        setFormError(
          error instanceof Error
            ? error.message
            : "Failed to parse template file",
        );
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
        setFormInfo(
          "Template saved. Publish request created and waiting for review.",
        );
      } else {
        setFormInfo("Template saved and published.");
      }
      setForm((prev) => ({
        ...prev,
        template_id: normalizedTemplateId,
        manifest_text: stringifyManifest(manifest),
      }));
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Failed to save template",
      );
    }
  };

  const onReviewRequest = async (
    request: TemplatePublishRequestRow,
    decision: "approve" | "reject" | "cancel",
  ) => {
    setFormError("");
    setFormInfo("");
    try {
      await reviewMutation.mutateAsync({
        requestId: request.id,
        decision,
      });
      setFormInfo(`Request ${request.id.slice(0, 8)} ${decision}d.`);
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Failed to review request",
      );
    }
  };

  const installTemplateToMiniAppBuilder = (item: TemplateCatalogItem) => {
    try {
      const draft = buildMiniAppInstallDraft(item);
      try {
        window.localStorage.setItem(
          MINIAPP_TEMPLATE_INSTALL_STORAGE_KEY,
          JSON.stringify(draft),
        );
      } catch {
        setFormError("Failed to save template draft to local storage");
        return;
      }
      setFormInfo(
        `Template ${item.template_id}@${item.version} installed into MiniApp Builder draft.`,
      );
      router.push("/miniapps?installed_template=1");
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Failed to install template to MiniApp Builder",
      );
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Template Studio"
        description="Curate frontend and contract templates before they become MiniApp Builder drafts."
        highlightLastWord
      />

      <section
        aria-label="Template Studio operations summary"
        className="template-studio-summary-grid grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <SummaryCard
          icon={Boxes}
          label="Marketplace"
          value={hasTemplateError ? "Unavailable" : templates.length.toLocaleString()}
          detail={
            hasTemplateError
              ? "Template catalog failed to load"
              : "Catalog entries in the current view"
          }
          tone={hasTemplateError ? "danger" : "info"}
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Verified"
          value={hasTemplateError ? "-" : verifiedTemplates.toLocaleString()}
          detail="Templates approved for reuse"
          tone="success"
        />
        <SummaryCard
          icon={GitPullRequestArrow}
          label="Pending Requests"
          value={hasRequestError ? "Unavailable" : pendingRequests.toLocaleString()}
          detail="Publish requests awaiting review"
          tone={pendingRequests > 0 ? "warning" : "neutral"}
        />
        <SummaryCard
          icon={Sparkles}
          label="Active Templates"
          value={
            hasTemplateError
              ? "-"
              : `${activeTemplates.toLocaleString()}/${templates.length.toLocaleString()}`
          }
          detail="Available to MiniApp Builder"
          tone="neutral"
        />
      </section>

      <Card
        aria-label="Template Studio controls"
        className="template-studio-filters-card overflow-hidden"
        variant="default"
      >
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary-100 bg-primary-50 text-primary-700">
              <Search className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle>Template Filters</CardTitle>
              <p className="mt-1 text-sm text-gray-600">
                Narrow by template role, source, activation, and verification.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
            <Input
              label="Search"
              placeholder="template id/name/tag"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <SelectField
              id="template-kind"
              label="Kind"
              value={kind}
              onChange={(value) => setKind(value as TemplateKind | "all")}
              options={["all", "frontend", "contract"]}
            />
            <SelectField
              id="template-category"
              label="Category"
              value={category}
              onChange={setCategory}
              options={CATEGORIES}
            />
            <SelectField
              id="template-source"
              label="Source"
              value={source}
              onChange={(value) =>
                setSource(value as TemplateSourceType | "all")
              }
              options={["all", "miniapp", "community", "verified"]}
            />
            <SelectField
              id="template-active"
              label="Active"
              value={active}
              onChange={(value) =>
                setActive(value as "all" | "true" | "false")
              }
              options={["all", "true", "false"]}
            />
            <SelectField
              id="template-verified"
              label="Verified"
              value={verified}
              onChange={(value) =>
                setVerified(value as "all" | "true" | "false")
              }
              options={["all", "true", "false"]}
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Card
          aria-label="Template marketplace panel"
          className="template-marketplace-card overflow-hidden xl:col-span-2"
          variant="default"
        >
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Template Marketplace</CardTitle>
              <p className="mt-1 text-sm text-gray-600">
                Review reusable UI and contract starting points.
              </p>
            </div>
            <Badge variant={hasTemplateError ? "danger" : "info"}>
              {hasTemplateError ? "Unavailable" : `${templates.length} Total`}
            </Badge>
          </CardHeader>
          <CardContent>
            {templatesQuery.isLoading ? (
              <LoadingState />
            ) : templatesQuery.isError ? (
              <AlertState
                label="Template marketplace could not be loaded"
                title="Template marketplace could not be loaded"
                message={
                  templatesQuery.error instanceof Error
                    ? templatesQuery.error.message
                    : "Fresh template catalog data is unavailable."
                }
              />
            ) : !templates.length ? (
              <EmptyState message="No templates found" />
            ) : (
              <div className="space-y-3">
                {templates.map((item) => (
                  <TemplateListItem
                    key={`${item.template_kind}:${item.row_id}`}
                    item={item}
                    selected={selectedTemplate?.row_id === item.row_id}
                    onSelect={() => setSelectedTemplate(item)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card
          aria-label="Template detail panel"
          className="template-detail-card overflow-hidden"
          variant="default"
        >
          <CardHeader>
            <CardTitle>Template Detail</CardTitle>
            <p className="mt-1 text-sm text-gray-600">
              Inspect manifest payloads before editing or installing.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedTemplate ? (
              <EmptyState message="Select a template to view details" />
            ) : (
              <>
                <div>
                  <p className="text-base font-bold text-gray-950">
                    {selectedTemplate.name}
                  </p>
                  <p className="mt-1 text-xs font-medium text-gray-500">
                    {selectedTemplate.template_id} · v{selectedTemplate.version}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge
                    variant={kindBadgeVariant(selectedTemplate.template_kind)}
                  >
                    {selectedTemplate.template_kind}
                  </Badge>
                  <Badge
                    variant={sourceBadgeVariant(selectedTemplate.source_type)}
                  >
                    {selectedTemplate.source_type}
                  </Badge>
                  <Badge
                    variant={selectedTemplate.is_active ? "success" : "danger"}
                  >
                    {selectedTemplate.is_active ? "active" : "inactive"}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600">
                  {selectedTemplate.description || "No description"}
                </p>
                <dl className="grid grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs">
                  <div>
                    <dt className="font-bold uppercase tracking-wide text-gray-500">
                      Updated
                    </dt>
                    <dd className="mt-1 font-medium text-gray-700">
                      {formatDateTime(selectedTemplate.updated_at)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-bold uppercase tracking-wide text-gray-500">
                      Category
                    </dt>
                    <dd className="mt-1 font-medium text-gray-700">
                      {selectedTemplate.category}
                    </dd>
                  </div>
                </dl>
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => applyTemplateToForm(selectedTemplate)}
                  >
                    Load Into Editor
                  </Button>
                  <Button
                    size="sm"
                    onClick={() =>
                      installTemplateToMiniAppBuilder(selectedTemplate)
                    }
                  >
                    Install To MiniApp Builder
                  </Button>
                </div>
                <pre className="max-h-64 overflow-auto rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                  {selectedManifestText}
                </pre>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <Card
        aria-label="Template publish requests panel"
        className="template-requests-card overflow-hidden"
        variant="default"
      >
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Publish Requests</CardTitle>
            <p className="mt-1 text-sm text-gray-600">
              Approve, reject, or cancel queued template submissions.
            </p>
          </div>
          <SelectField
            id="request-status"
            label="Status"
            value={requestStatus}
            onChange={(value) =>
              setRequestStatus(
                value as
                  | "all"
                  | "pending"
                  | "approved"
                  | "rejected"
                  | "cancelled",
              )
            }
            options={["pending", "all", "approved", "rejected", "cancelled"]}
            compact
          />
        </CardHeader>
        <CardContent className="space-y-3">
          {requestsQuery.isLoading ? (
            <LoadingState />
          ) : requestsQuery.isError ? (
            <AlertState
              label="Template publish requests could not be loaded"
              title="Template publish requests could not be loaded"
              message={
                requestsQuery.error instanceof Error
                  ? requestsQuery.error.message
                  : "Fresh request data is unavailable."
              }
            />
          ) : !requests.length ? (
            <EmptyState message="No publish requests" />
          ) : (
            <div className="space-y-2">
              {requests.map((request) => (
                <div
                  key={request.id}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-3"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-gray-700">
                      {request.id.slice(0, 8)}
                    </span>
                    <Badge variant={kindBadgeVariant(request.template_kind)}>
                      {request.template_kind}
                    </Badge>
                    <Badge variant={requestBadgeVariant(request.status)}>
                      {request.status}
                    </Badge>
                    <span className="ml-auto text-xs font-medium text-gray-500">
                      {formatDateTime(request.created_at)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-medium text-gray-500">
                    template row: {request.template_row_id}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setSelectedRequest(request)}
                    >
                      View
                    </Button>
                    {request.status === "pending" ? (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onReviewRequest(request, "approve")}
                          disabled={reviewMutation.isPending}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onReviewRequest(request, "reject")}
                          disabled={reviewMutation.isPending}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onReviewRequest(request, "cancel")}
                          disabled={reviewMutation.isPending}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}

          {selectedRequest ? (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
              <div>Request: {selectedRequest.id}</div>
              <div>Requested by: {selectedRequest.requested_by}</div>
              <div>Reviewed by: {selectedRequest.reviewed_by || "-"}</div>
              <div>Note: {selectedRequest.review_note || "-"}</div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card
        aria-label="Template editor panel"
        className="template-editor-card overflow-hidden"
        variant="default"
      >
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-success-100 bg-success-50 text-success-700">
              <FileCode2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <CardTitle>Upload / Edit Template</CardTitle>
              <p className="mt-1 text-sm text-gray-600">
                Import JSON or YAML, normalize metadata, then publish or queue
                for review.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <FieldLabel htmlFor="import-template-file">
              Import Template File
            </FieldLabel>
            <input
              id="import-template-file"
              type="file"
              accept=".json,.yaml,.yml"
              onChange={onUploadTemplateFile}
              className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-700 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-primary-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-primary-800 hover:file:bg-primary-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <SelectField
              id="template-kind-form"
              label="Kind"
              value={form.kind}
              onChange={(value) =>
                setForm({ ...form, kind: value as TemplateKind })
              }
              options={["frontend", "contract"]}
            />
            <Input
              label="Template ID"
              value={form.template_id}
              onChange={(e) =>
                setForm({ ...form, template_id: e.target.value })
              }
              placeholder="prediction.market.modern"
            />
            <Input
              label="Version"
              value={form.version}
              onChange={(e) => setForm({ ...form, version: e.target.value })}
              placeholder="1.0.0"
            />
            <SelectField
              id="template-source-form"
              label="Source"
              value={form.source_type}
              onChange={(value) =>
                setForm({
                  ...form,
                  source_type: value as TemplateSourceType,
                })
              }
              options={["community", "miniapp", "verified"]}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Input
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Prediction Market UI"
            />
            <Input
              label="Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              placeholder="defi"
            />
            <Input
              label="Contract Template Ref"
              value={form.factory_template_ref}
              onChange={(e) =>
                setForm({ ...form, factory_template_ref: e.target.value })
              }
              placeholder="factory.prediction.v2"
            />
          </div>

          <Input
            label="Tags"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
            placeholder="prediction, market, no-code"
          />

          <TextAreaField
            id="template-description"
            label="Description"
            rows={3}
            value={form.description}
            onChange={(value) => setForm({ ...form, description: value })}
            placeholder="What this template is for and what is customizable."
          />

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <TextAreaField
              id="param-schema"
              label="Param Schema (JSON)"
              rows={8}
              value={form.schema_text}
              onChange={(value) => setForm({ ...form, schema_text: value })}
              placeholder={`{
 "type": "object",
 "properties": {}
}`}
              mono
            />
            <TextAreaField
              id="ui-schema"
              label="UI Schema (JSON)"
              rows={8}
              value={form.ui_schema_text}
              onChange={(value) => setForm({ ...form, ui_schema_text: value })}
              placeholder={`{
 "ui:order": []
}`}
              mono
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <SelectField
              id="manifest-format"
              label="Manifest Format"
              value={form.manifest_format}
              onChange={(value) =>
                setForm({
                  ...form,
                  manifest_format: value as TemplateManifestFormat,
                })
              }
              options={["json", "yaml"]}
            />
            <div className="md:col-span-3">
              <TextAreaField
                id="template-manifest"
                label="Template Manifest"
                rows={12}
                value={form.manifest_text}
                onChange={(value) => setForm({ ...form, manifest_text: value })}
                placeholder={
                  form.manifest_format === "json"
                    ? '{\n "key": "value"\n}'
                    : "template:\n key: value"
                }
                mono
              />
            </div>
          </div>

          {formError ? (
            <InlineAlert tone="danger">{formError}</InlineAlert>
          ) : null}
          {formInfo ? <InlineAlert tone="info">{formInfo}</InlineAlert> : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button onClick={onSubmit} disabled={upsertMutation.isPending}>
              {upsertMutation.isPending ? "Saving..." : "Save Template"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setForm(EMPTY_FORM);
                setFormError("");
                setFormInfo("");
              }}
            >
              Reset
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  tone: "success" | "warning" | "danger" | "info" | "neutral";
}) {
  return (
    <Card variant="default">
      <CardContent className="flex min-h-36 flex-col justify-between gap-5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
              {label}
            </p>
            <p className="mt-3 text-3xl font-black leading-none text-gray-950">
              {value}
            </p>
          </div>
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border",
              summaryToneClasses[tone],
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
        </div>
        <p className="text-sm font-medium text-gray-600">{detail}</p>
      </CardContent>
    </Card>
  );
}

function TemplateListItem({
  item,
  selected,
  onSelect,
}: {
  item: TemplateCatalogItem;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-xl border p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50",
        selected
          ? "border-primary-300 bg-primary-50"
          : "border-gray-200 bg-gray-50 hover:border-primary-300 hover:bg-white",
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-gray-950">
            {item.name}
          </p>
          <p className="mt-1 text-xs font-medium text-gray-500">
            <code>{item.template_id}</code> · v{item.version} · {item.category}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant={kindBadgeVariant(item.template_kind)}>
            {item.template_kind}
          </Badge>
          <Badge variant={sourceBadgeVariant(item.source_type)}>
            {item.source_type}
          </Badge>
          {item.is_verified ? <Badge variant="success">verified</Badge> : null}
        </div>
      </div>
      <p className="mt-3 text-sm text-gray-600">
        {item.description || "No description"}
      </p>
      <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium text-gray-500">
        <span>usage {item.usage_count}</span>
        <span>
          rating {item.rating_avg ?? "-"} ({item.rating_count})
        </span>
      </div>
    </button>
  );
}

function FieldLabel({
  htmlFor,
  children,
}: {
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-sm font-semibold text-gray-700"
    >
      {children}
    </label>
  );
}

function SelectField({
  id,
  label,
  value,
  onChange,
  options,
  compact = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  compact?: boolean;
}) {
  return (
    <div className={compact ? "min-w-36" : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <select
        id={id}
        className={cn(
          "w-full rounded-xl border border-gray-300 bg-white text-sm text-gray-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50",
          compact ? "h-10 px-3" : "h-11 px-3",
        )}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextAreaField({
  id,
  label,
  value,
  onChange,
  placeholder,
  rows,
  mono = false,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows: number;
  mono?: boolean;
}) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <textarea
        id={id}
        className={cn(
          "w-full resize-y rounded-xl border border-gray-300 bg-white p-3 text-gray-900 transition-colors placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50",
          mono ? "font-mono text-xs" : "text-sm",
        )}
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex min-h-32 items-center justify-center">
      <Spinner />
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <p className="rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-8 text-center text-sm font-medium text-gray-500">
      {message}
    </p>
  );
}

function AlertState({
  label,
  title,
  message,
}: {
  label: string;
  title: string;
  message: string;
}) {
  return (
    <div
      aria-label={label}
      className="rounded-xl border border-warning-200 bg-warning-50 px-4 py-3"
      role="alert"
    >
      <p className="text-sm font-bold text-warning-800">{title}</p>
      <p className="mt-1 text-sm text-warning-700">{message}</p>
    </div>
  );
}

function InlineAlert({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "danger" | "info";
}) {
  return (
    <p
      className={cn(
        "rounded-xl border px-4 py-3 text-sm font-medium",
        tone === "danger"
          ? "border-danger-100 bg-danger-50 text-danger-700"
          : "border-primary-100 bg-primary-50 text-primary-700",
      )}
    >
      {children}
    </p>
  );
}

const summaryToneClasses = {
  success: "border-success-100 bg-success-50 text-success-700",
  warning: "border-warning-100 bg-warning-50 text-warning-700",
  danger: "border-danger-100 bg-danger-50 text-danger-700",
  info: "border-primary-100 bg-primary-50 text-primary-700",
  neutral: "border-gray-200 bg-gray-100 text-gray-700",
};
