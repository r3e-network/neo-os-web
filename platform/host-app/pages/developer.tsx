import Head from "next/head";
import { useEffect, useMemo, useRef, useState } from "react";
import { Layout, PageHero } from "@/components/layout";
import { IconFeatureGrid } from "@/components/content";
import {
  DefinitionActionBar,
  DefinitionModeToggle,
  DeveloperCalloutCard,
  DeveloperDrawerFooter,
  DeveloperDrawerHeader,
  DeveloperStateCard,
  TemplateMarketCard,
  TemplateMarketFilters,
} from "@/components/developer";
import { SelectField, TextAreaField, TextField } from "@/components/forms";
import { Alert } from "@/components/ui/alert";
import {
  Code2,
  Database,
  Shield,
  Dice5,
  TrendingUp,
  Store,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import yaml from "js-yaml";
import { logger } from "@/lib/logger";

const features = [
  {
    icon: Code2,
    title: "Template SDK",
    desc: "Generate miniapps from JSON/YAML",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: Shield,
    title: "Schema Guard",
    desc: "Config validation before publish",
    color: "from-purple-500 to-pink-500",
  },
  {
    icon: Dice5,
    title: "Contract Templating",
    desc: "Parameterized contract templates",
    color: "from-emerald-500 to-emerald-600",
  },
  {
    icon: TrendingUp,
    title: "Template Market",
    desc: "Foundation for creator marketplace",
    color: "from-orange-500 to-yellow-500",
  },
];

const categories = [
  "gaming",
  "defi",
  "social",
  "nft",
  "governance",
  "utility",
] as const;
const templateTypes = [
  "default",
  "prediction",
  "gaming",
  "defi",
  "nft",
] as const;
const enableAdminTemplateCatalog =
  process.env.NEXT_PUBLIC_ENABLE_ADMIN_TEMPLATE_CATALOG === "true";

type FormData = {
  app_id: string;
  name: string;
  name_zh: string;
  description: string;
  description_zh: string;
  icon: string;
  category: (typeof categories)[number];
  template_type: (typeof templateTypes)[number];
  frontend_template_id: string;
  contract_template_id: string;
  contract_hash: string;
  entry_url: string;
  logo_url: string;
  banner_url: string;
  docs_url: string;
  developer_name: string;
  developer_user_id: string;
  developer_pubkey: string;
};

type AdminTemplateCatalog = {
  frontend_templates?: Array<{ template_id: string; name: string }>;
  contract_templates?: Array<{ template_id: string; name: string }>;
};

type MarketTemplateKind = "frontend" | "contract";
type MarketTemplateSource = "miniapp" | "community" | "verified";
type MarketTemplateItem = {
  template_kind: MarketTemplateKind;
  template_id: string;
  version: string;
  name: string;
  description: string;
  category: string;
  source_type: MarketTemplateSource;
  tags: string[];
  is_verified: boolean;
  usage_count: number;
  rating_avg: number | null;
  rating_count: number;
  schema: Record<string, unknown>;
  ui_schema: Record<string, unknown>;
  manifest: Record<string, unknown>;
  factory_template_ref: string | null;
  updated_at: string;
};

const initialForm: FormData = {
  app_id: "",
  name: "",
  name_zh: "",
  description: "",
  description_zh: "",
  icon: "📦",
  category: "utility",
  template_type: "default",
  frontend_template_id: "default",
  contract_template_id: "",
  contract_hash: "",
  entry_url: "",
  logo_url: "",
  banner_url: "",
  docs_url: "",
  developer_name: "",
  developer_user_id: "",
  developer_pubkey: "",
};

function normalizeSlug(input: string): string {
  const value = String(input || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return value;
}

function asErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== "object") return fallback;
  const obj = payload as Record<string, unknown>;
  const error = obj.error;
  if (error && typeof error === "object") {
    const message = (error as Record<string, unknown>).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  if (typeof obj.message === "string" && obj.message.trim()) return obj.message;
  if (typeof obj.error === "string" && obj.error.trim()) return obj.error;
  return fallback;
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function isCategory(value: string): value is FormData["category"] {
  return (categories as readonly string[]).includes(value);
}

function isTemplateType(value: string): value is FormData["template_type"] {
  return (templateTypes as readonly string[]).includes(value);
}

export default function DeveloperPage() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormData>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [definitionMode, setDefinitionMode] = useState<"json" | "yaml">("json");
  const [definitionText, setDefinitionText] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<{
    ok: boolean;
    message: string;
  } | null>(null);
  const [catalog, setCatalog] = useState<AdminTemplateCatalog | null>(null);
  const [marketTemplates, setMarketTemplates] = useState<MarketTemplateItem[]>(
    [],
  );
  const [marketLoading, setMarketLoading] = useState(false);
  const [marketError, setMarketError] = useState("");
  const [marketKind, setMarketKind] = useState<"all" | MarketTemplateKind>(
    "all",
  );
  const [marketCategory, setMarketCategory] = useState<
    "all" | FormData["category"]
  >("all");
  const [marketSource, setMarketSource] = useState<
    "all" | MarketTemplateSource
  >("all");
  const [marketVerified, setMarketVerified] = useState<"all" | "true">("all");
  const [marketSearch, setMarketSearch] = useState("");
  const mountedRef = useRef(true);
  const hideFormTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (hideFormTimeoutRef.current) clearTimeout(hideFormTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!enableAdminTemplateCatalog) return;

    const loadCatalog = async () => {
      try {
        const res = await fetch("/api/miniapps/admin/template-catalog", {
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return;
        const data = (await res.json()) as AdminTemplateCatalog;
        if (mountedRef.current) setCatalog(data);
      } catch (error) {
        logger.debug("template catalog unavailable", error);
      }
    };

    loadCatalog();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setMarketLoading(true);
      setMarketError("");
      try {
        const params = new URLSearchParams();
        params.set("kind", marketKind);
        params.set("source", marketSource);
        params.set("verified", marketVerified);
        params.set("limit", "80");
        if (marketCategory !== "all") params.set("category", marketCategory);
        if (marketSearch.trim()) params.set("search", marketSearch.trim());

        const res = await fetch(
          `/api/miniapps/template-market?${params.toString()}`,
          {
            signal: AbortSignal.timeout(12000),
          },
        );
        const payload = await res.json().catch((e: unknown) => {
          console.warn(
            "[developer] failed to parse marketplace template response:",
            e instanceof Error ? e.message : String(e),
          );
          return {};
        });
        if (!res.ok) {
          if (!cancelled) {
            setMarketTemplates([]);
            setMarketError(
              asErrorMessage(payload, "Failed to load marketplace templates"),
            );
          }
          return;
        }

        const templates = Array.isArray(
          (payload as Record<string, unknown>).templates,
        )
          ? ((payload as Record<string, unknown>)
              .templates as MarketTemplateItem[])
          : [];
        if (!cancelled) {
          setMarketTemplates(templates);
        }
      } catch (error) {
        logger.debug("template market fetch failed", error);
        if (!cancelled) {
          setMarketTemplates([]);
          setMarketError("Template marketplace request failed");
        }
      } finally {
        if (!cancelled) {
          setMarketLoading(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [marketKind, marketCategory, marketSource, marketVerified, marketSearch]);

  const frontendTemplateOptions = useMemo(
    () => (catalog?.frontend_templates || []).map((item) => item.template_id),
    [catalog],
  );
  const contractTemplateOptions = useMemo(
    () => (catalog?.contract_templates || []).map((item) => item.template_id),
    [catalog],
  );

  const buildDefinitionPayload = (sourceForm: FormData = form) => {
    const appSlug = normalizeSlug(sourceForm.app_id || sourceForm.name);
    const appId = appSlug.startsWith("miniapp-")
      ? appSlug
      : `miniapp-${appSlug}`;
    return {
      app_id: appId,
      name: sourceForm.name,
      name_zh: sourceForm.name_zh || undefined,
      description: sourceForm.description,
      description_zh: sourceForm.description_zh || undefined,
      template_type: sourceForm.template_type,
      category: sourceForm.category,
      icon: sourceForm.icon || "📦",
      entry_url: sourceForm.entry_url,
      contract_hash: sourceForm.contract_hash || undefined,
      docs_url: sourceForm.docs_url || undefined,
      developer: {
        name: sourceForm.developer_name || undefined,
      },
      template: {
        template_type: sourceForm.template_type,
        frontend_template: {
          template_id:
            sourceForm.frontend_template_id || sourceForm.template_type,
          version: "1.0.0",
        },
        contract_template: {
          template_id: sourceForm.contract_template_id || undefined,
          version: "1.0.0",
        },
      },
      contract_template: {
        template_id: sourceForm.contract_template_id || undefined,
      },
      frontend_template: {
        template_id:
          sourceForm.frontend_template_id || sourceForm.template_type,
      },
      contract: {
        template_id: sourceForm.contract_template_id || undefined,
      },
      media: {
        logo: sourceForm.logo_url || undefined,
        banner: sourceForm.banner_url || undefined,
      },
      i18n: {
        name_zh: sourceForm.name_zh || undefined,
        description_zh: sourceForm.description_zh || undefined,
      },
      permissions: {
        payments: true,
      },
      limits: {
        max_gas_per_tx: "10",
        daily_gas_cap_per_user: "100",
      },
      frontend_spec: {
        layout:
          sourceForm.template_type === "prediction" ? "prediction" : "default",
        tabs: [
          {
            id: "overview",
            label: "Overview",
            type: "content",
            blocks: [
              { type: "markdown", content: sourceForm.description || "" },
            ],
          },
        ],
      },
      operations: [],
    };
  };

  const applyMarketTemplateToFormData = (
    baseForm: FormData,
    item: MarketTemplateItem,
  ): FormData => {
    const manifest = asObject(item.manifest);
    const templateContainer = asObject(manifest.template);
    const frontendTemplate = asObject(
      manifest.frontend_template ?? templateContainer.frontend_template,
    );
    const contractTemplate = asObject(
      manifest.contract_template ?? templateContainer.contract_template,
    );
    const media = asObject(manifest.media);

    const next: FormData = { ...baseForm };

    if (item.template_kind === "frontend") {
      const frontendTemplateId = String(
        frontendTemplate.template_id || item.template_id || "",
      ).trim();
      if (frontendTemplateId) {
        next.frontend_template_id = frontendTemplateId;
      }
    }

    if (item.template_kind === "contract") {
      const contractTemplateId = String(
        contractTemplate.template_id || item.template_id || "",
      ).trim();
      if (contractTemplateId) {
        next.contract_template_id = contractTemplateId;
      }
    }

    const templateTypeRaw = String(
      manifest.template_type || templateContainer.template_type || "",
    )
      .trim()
      .toLowerCase();
    if (isTemplateType(templateTypeRaw)) {
      next.template_type = templateTypeRaw;
    }

    const categoryRaw = String(manifest.category || "")
      .trim()
      .toLowerCase();
    if (isCategory(categoryRaw)) {
      next.category = categoryRaw;
    }

    if (!next.name.trim() && item.name.trim()) {
      next.name = item.name.trim();
    }
    if (!next.description.trim() && item.description.trim()) {
      next.description = item.description.trim();
    }

    const docsUrl = String(manifest.docs_url || "").trim();
    if (!next.docs_url.trim() && docsUrl) {
      next.docs_url = docsUrl;
    }

    const logoUrl = String(
      manifest.logo_url || media.logo_url || media.logo || "",
    ).trim();
    if (!next.logo_url.trim() && logoUrl) {
      next.logo_url = logoUrl;
    }

    const bannerUrl = String(
      manifest.banner_url || media.banner_url || media.banner || "",
    ).trim();
    if (!next.banner_url.trim() && bannerUrl) {
      next.banner_url = bannerUrl;
    }

    return next;
  };

  const handleApplyMarketTemplate = (item: MarketTemplateItem) => {
    const nextForm = applyMarketTemplateToFormData(form, item);
    setForm(nextForm);
    syncDefinitionText(
      definitionMode,
      buildDefinitionPayload(nextForm) as Record<string, unknown>,
    );
    setPreviewResult({
      ok: true,
      message: `Applied ${item.template_kind} template ${item.template_id}@${item.version} to builder.`,
    });
    setShowForm(true);
  };

  const syncDefinitionText = (
    mode: "json" | "yaml",
    payload: Record<string, unknown>,
  ) => {
    if (mode === "json") {
      try {
        setDefinitionText(JSON.stringify(payload, null, 2));
      } catch (err) {
        logger.warn(
          "Failed to serialize definition payload",
          err instanceof Error ? err.message : String(err),
        );
        setDefinitionText("");
      }
      return;
    }
    setDefinitionText(yaml.dump(payload, { noRefs: true, lineWidth: 120 }));
  };

  const handleGenerateDefinition = () => {
    const payload = buildDefinitionPayload() as Record<string, unknown>;
    syncDefinitionText(definitionMode, payload);
    setPreviewResult(null);
  };

  const handleImportDefinition = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setDefinitionText(text);
      if (
        file.name.toLowerCase().endsWith(".yaml") ||
        file.name.toLowerCase().endsWith(".yml")
      ) {
        setDefinitionMode("yaml");
      } else {
        setDefinitionMode("json");
      }
      setPreviewResult(null);
    };
    reader.readAsText(file);
  };

  const handlePreviewDefinition = async () => {
    if (!definitionText.trim()) {
      setPreviewResult({
        ok: false,
        message: "Please generate or paste JSON/YAML definition first.",
      });
      return;
    }

    setPreviewLoading(true);
    setPreviewResult(null);
    try {
      const res = await fetch("/api/miniapps/admin/definition-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: definitionText }),
        signal: AbortSignal.timeout(10_000),
      });
      const data = await res.json().catch((e: unknown) => {
        console.warn(
          "[developer] failed to parse schema preview response:",
          e instanceof Error ? e.message : String(e),
        );
        return {};
      });
      if (!res.ok) {
        setPreviewResult({
          ok: false,
          message: asErrorMessage(data, "Preview failed"),
        });
        return;
      }
      setPreviewResult({
        ok: true,
        message: "Schema + runtime preview passed.",
      });
    } catch (error) {
      logger.warn("definition preview failed", error);
      setPreviewResult({ ok: false, message: "Preview network error" });
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setResult(null);

    try {
      const payload = buildDefinitionPayload() as Record<string, unknown>;
      const definitionPayloadText =
        definitionText.trim() || JSON.stringify(payload, null, 2);

      const previewRes = await fetch("/api/miniapps/admin/definition-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: definitionPayloadText }),
        signal: AbortSignal.timeout(10_000),
      });
      const previewData = await previewRes.json().catch((e: unknown) => {
        console.warn(
          "[developer] failed to parse definition preview response:",
          e instanceof Error ? e.message : String(e),
        );
        return {};
      });
      if (!previewRes.ok) {
        setResult({
          success: false,
          message: asErrorMessage(previewData, "Definition preview failed"),
        });
        return;
      }

      const parsedDefinition =
        previewData &&
        typeof previewData === "object" &&
        !Array.isArray(previewData)
          ? ((previewData as Record<string, unknown>).parsed_definition as
              | Record<string, unknown>
              | undefined)
          : undefined;

      const upsertSource =
        parsedDefinition && typeof parsedDefinition === "object"
          ? parsedDefinition
          : payload;

      const resolvedDeveloperUserId =
        form.developer_user_id ||
        (typeof upsertSource.developer_user_id === "string"
          ? upsertSource.developer_user_id
          : "");

      const resolvedDeveloperPubKey =
        form.developer_pubkey ||
        (typeof upsertSource.developer_pubkey === "string"
          ? upsertSource.developer_pubkey
          : "");

      const upsertBody = {
        ...upsertSource,
        action: "save_draft",
        developer_user_id: resolvedDeveloperUserId,
        developer_pubkey: resolvedDeveloperPubKey,
      };

      const res = await fetch("/api/miniapps/admin/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(upsertBody),
        signal: AbortSignal.timeout(10_000),
      });
      const data = await res.json().catch((e: unknown) => {
        console.warn(
          "[developer] failed to parse save draft response:",
          e instanceof Error ? e.message : String(e),
        );
        return {};
      });

      if (res.ok) {
        setResult({
          success: true,
          message: `MiniApp definition for "${form.name}" saved as draft.`,
        });
        setForm(initialForm);
        setDefinitionText("");
        setPreviewResult(null);
        if (hideFormTimeoutRef.current)
          clearTimeout(hideFormTimeoutRef.current);
        hideFormTimeoutRef.current = setTimeout(() => {
          if (mountedRef.current) setShowForm(false);
        }, 1500);
      } else {
        setResult({
          success: false,
          message: asErrorMessage(data, "Save draft failed"),
        });
      }
    } catch (err) {
      logger.warn("Failed to save miniapp draft:", err);
      setResult({ success: false, message: "Network error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout>
      <Head>
        <title>Developer Portal - Yiwu MiniApps</title>
      </Head>

      <PageHero
        align="center"
        eyebrow="Template-first builder"
        title="Developer Portal"
        description="Build, configure, and publish MiniApps from JSON or YAML definitions with frontend templates, contract templates, and draft-first validation."
        stats={[
          {
            label: "Feature modules",
            value: String(features.length),
            hint: "SDK, schema, contracts, market",
          },
          {
            label: "Builder modes",
            value: "JSON + YAML",
            hint: "Generate, preview, save draft",
          },
          {
            label: "Marketplace",
            value: "Live",
            hint: "Install templates into builder",
          },
        ]}
      />

      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 md:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <DeveloperCalloutCard
                icon={Code2}
                title="Quick Start"
                subtitle="No-code + config-driven workflow"
                accentClassName="bg-gradient-to-br from-neo to-emerald-600"
                surfaceClassName="mt-6 bg-neo text-gray-900 font-semibold hover:bg-neo/90"
                codeLines={[
                  "# Build from templates",
                  "Generate JSON or YAML miniapp definition",
                  "# Validate + save",
                  "POST /api/miniapps/admin/definition-preview",
                ]}
                href="/docs"
                ctaLabel="Read Documentation"
                ctaVariant="docs"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <DeveloperCalloutCard
                icon={Database}
                title="Definition Builder"
                subtitle="JSON / YAML + template catalog"
                accentClassName="bg-gradient-to-br from-orange-500 to-red-600"
                surfaceClassName="bg-gradient-to-r from-orange-500 to-red-600 text-white font-semibold hover:from-orange-600 hover:to-red-700"
                description="Publish-like-article workflow: fill form, generate definition, preview, then save draft."
                bullets={[
                  "Template type + template ID mapping",
                  "Schema + runtime preview",
                  "Banner/logo URL + variants ready",
                ]}
                ctaLabel="Open Builder"
                ctaVariant="builder"
                onClick={() => setShowForm(true)}
              />
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Template Marketplace
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Browse published frontend and contract templates, then install
                to builder in one click.
              </p>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-gray-200 px-3 py-1 text-xs text-gray-600">
              <Store size={14} aria-hidden="true" />
              Live Market Feed
            </div>
          </div>

          <TemplateMarketFilters
            categories={categories}
            marketKind={marketKind}
            marketCategory={marketCategory}
            marketSource={marketSource}
            marketVerified={marketVerified}
            marketSearch={marketSearch}
            onMarketKindChange={(value) =>
              setMarketKind(value as "all" | MarketTemplateKind)
            }
            onMarketCategoryChange={(value) =>
              setMarketCategory(value as "all" | FormData["category"])
            }
            onMarketSourceChange={(value) =>
              setMarketSource(value as "all" | MarketTemplateSource)
            }
            onMarketVerifiedChange={(value) =>
              setMarketVerified(value as "all" | "true")
            }
            onMarketSearchChange={setMarketSearch}
          />

          {marketError ? (
            <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/15 px-3 py-2 text-sm text-red-300">
              {marketError}
            </div>
          ) : null}

          {marketLoading ? (
            <DeveloperStateCard message="Loading template marketplace..." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {marketTemplates.slice(0, 18).map((item) => (
                <TemplateMarketCard
                  key={`${item.template_kind}:${item.template_id}:${item.version}`}
                  templateKind={item.template_kind}
                  templateId={item.template_id}
                  version={item.version}
                  name={item.name}
                  description={item.description}
                  category={item.category}
                  sourceType={item.source_type}
                  isVerified={item.is_verified}
                  usageCount={item.usage_count}
                  ratingAvg={item.rating_avg}
                  ratingCount={item.rating_count}
                  tags={item.tags}
                  onInstall={() => handleApplyMarketTemplate(item)}
                />
              ))}
              {!marketTemplates.length ? (
                <DeveloperStateCard message="No templates matched current filters." />
              ) : null}
            </div>
          )}
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">
            Platform Features
          </h2>
          <IconFeatureGrid
            columns={4}
            items={features.map((feature) => ({
              icon: feature.icon,
              title: feature.title,
              description: feature.desc,
              colorClass: `bg-gradient-to-br ${feature.color}`,
            }))}
          />
        </div>
      </section>

      <AnimatePresence>
        {result && !showForm && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 right-6 z-[130]"
          >
            <div
              role="alert"
              className={`rounded-xl p-4 shadow-2xl backdrop-blur-xl ${
                result.success
                  ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
                  : "bg-red-500/20 border border-red-500/30 text-red-400"
              }`}
            >
              {result.message}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showForm && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowForm(false)}
              onKeyDown={(e) => e.key === "Escape" && setShowForm(false)}
              role="button"
              tabIndex={0}
              aria-label="Close dialog"
              className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              role="dialog"
              aria-modal="true"
              aria-label="Template Builder"
              className="fixed bottom-0 right-0 top-0 z-[1000] w-full max-w-2xl overflow-y-auto border-l border-gray-200 bg-white shadow-2xl backdrop-blur-xl"
              tabIndex={-1}
            >
              <DeveloperDrawerHeader onClose={() => setShowForm(false)} />

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <TextField
                  id="submit-app-id"
                  type="text"
                  label="App ID"
                  placeholder="miniapp-my-app"
                  value={form.app_id}
                  onChange={(e) => setForm({ ...form, app_id: e.target.value })}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextField
                    id="submit-app-name"
                    type="text"
                    required
                    label="Name *"
                    placeholder="My MiniApp"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                  />
                  <TextField
                    id="submit-app-name-zh"
                    type="text"
                    label="Name (中文)"
                    placeholder="可选"
                    value={form.name_zh}
                    onChange={(e) =>
                      setForm({ ...form, name_zh: e.target.value })
                    }
                  />
                </div>

                <TextAreaField
                  id="submit-app-desc"
                  required
                  rows={3}
                  label="Description *"
                  placeholder="Describe what your app does..."
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />

                <TextAreaField
                  id="submit-app-desc-zh"
                  rows={2}
                  label="Description (中文)"
                  placeholder="可选"
                  value={form.description_zh}
                  onChange={(e) =>
                    setForm({ ...form, description_zh: e.target.value })
                  }
                />

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <TextField
                    id="submit-app-icon"
                    type="text"
                    label="Icon"
                    placeholder="📦"
                    className="text-center text-2xl"
                    value={form.icon}
                    onChange={(e) => setForm({ ...form, icon: e.target.value })}
                  />
                  <SelectField
                    id="submit-app-category"
                    label="Category"
                    value={form.category}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        category: e.target.value as FormData["category"],
                      })
                    }
                  >
                    {categories.map((c) => (
                      <option key={c} value={c} className="bg-white">
                        {c}
                      </option>
                    ))}
                  </SelectField>
                  <SelectField
                    id="submit-template-type"
                    label="Template Type"
                    value={form.template_type}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        template_type: e.target
                          .value as FormData["template_type"],
                      })
                    }
                  >
                    {templateTypes.map((t) => (
                      <option key={t} value={t} className="bg-white">
                        {t}
                      </option>
                    ))}
                  </SelectField>
                  <TextField
                    id="submit-contract-hash"
                    type="text"
                    label="Contract Hash"
                    placeholder="0x..."
                    className="font-mono text-sm"
                    value={form.contract_hash}
                    onChange={(e) =>
                      setForm({ ...form, contract_hash: e.target.value })
                    }
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <TextField
                      id="submit-frontend-template-id"
                      type="text"
                      list="frontend-template-options"
                      label="Frontend Template ID"
                      placeholder="default"
                      value={form.frontend_template_id}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          frontend_template_id: e.target.value,
                        })
                      }
                    />
                    <datalist id="frontend-template-options">
                      {frontendTemplateOptions.map((id) => (
                        <option key={id} value={id} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <TextField
                      id="submit-contract-template-id"
                      type="text"
                      list="contract-template-options"
                      label="Contract Template ID"
                      placeholder="prediction-binary"
                      value={form.contract_template_id}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          contract_template_id: e.target.value,
                        })
                      }
                    />
                    <datalist id="contract-template-options">
                      {contractTemplateOptions.map((id) => (
                        <option key={id} value={id} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <TextField
                  id="submit-entry-url"
                  type="url"
                  required
                  label="Entry URL *"
                  placeholder="https://your-app.com/miniapp"
                  value={form.entry_url}
                  onChange={(e) =>
                    setForm({ ...form, entry_url: e.target.value })
                  }
                />

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <TextField
                    id="submit-logo-url"
                    type="url"
                    label="Logo URL"
                    placeholder="https://cdn/logo.png"
                    value={form.logo_url}
                    onChange={(e) =>
                      setForm({ ...form, logo_url: e.target.value })
                    }
                  />
                  <TextField
                    id="submit-banner-url"
                    type="url"
                    label="Banner URL"
                    placeholder="https://cdn/banner.png"
                    value={form.banner_url}
                    onChange={(e) =>
                      setForm({ ...form, banner_url: e.target.value })
                    }
                  />
                  <TextField
                    id="submit-docs-url"
                    type="url"
                    label="Docs URL"
                    placeholder="https://docs.example.com"
                    value={form.docs_url}
                    onChange={(e) =>
                      setForm({ ...form, docs_url: e.target.value })
                    }
                  />
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">
                    Developer Metadata
                  </h3>
                  <div className="space-y-4">
                    <TextField
                      id="submit-dev-name"
                      type="text"
                      label="Developer Name"
                      placeholder="Your name or team"
                      value={form.developer_name}
                      onChange={(e) =>
                        setForm({ ...form, developer_name: e.target.value })
                      }
                    />
                    <TextField
                      id="submit-dev-user-id"
                      type="text"
                      required
                      label="Developer User ID (UUID) *"
                      placeholder="123e4567-e89b-12d3-a456-426614174000"
                      className="font-mono text-sm"
                      value={form.developer_user_id}
                      onChange={(e) =>
                        setForm({ ...form, developer_user_id: e.target.value })
                      }
                    />
                    <TextField
                      id="submit-dev-pubkey"
                      type="text"
                      label="Developer PubKey"
                      placeholder="03ab..."
                      className="font-mono text-sm"
                      value={form.developer_pubkey}
                      onChange={(e) =>
                        setForm({ ...form, developer_pubkey: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700">
                      JSON / YAML Definition
                    </h3>
                    <DefinitionModeToggle
                      mode={definitionMode}
                      onChange={setDefinitionMode}
                    />
                  </div>

                  <DefinitionActionBar
                    previewLoading={previewLoading}
                    onGenerate={handleGenerateDefinition}
                    onPreview={handlePreviewDefinition}
                    onImport={handleImportDefinition}
                  />

                  <TextAreaField
                    rows={10}
                    placeholder={
                      definitionMode === "json"
                        ? "Paste miniapp definition JSON..."
                        : "Paste miniapp definition YAML..."
                    }
                    value={definitionText}
                    onChange={(e) => setDefinitionText(e.target.value)}
                    className="font-mono text-xs"
                  />

                  {previewResult && (
                    <Alert
                      variant={previewResult.ok ? "success" : "error"}
                      className="mt-3 text-xs"
                    >
                      {previewResult.message}
                    </Alert>
                  )}
                </div>

                {result && (
                  <Alert variant={result.success ? "success" : "error"}>
                    {result.message}
                  </Alert>
                )}

                <DeveloperDrawerFooter
                  submitting={submitting}
                  onCancel={() => setShowForm(false)}
                />
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </Layout>
  );
}
