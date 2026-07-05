import Head from "next/head";
import { useEffect, useMemo, useRef, useState } from "react";
import { Layout, PageHero } from "@/components/layout";
import {
  DeveloperBuilderForm,
  DeveloperCalloutSection,
  DeveloperDrawerHeader,
  DeveloperResultToast,
  PlatformFeaturesSection,
  TemplateMarketplaceSection,
} from "@/components/developer";
import {
  categories,
  templateTypes,
  type AdminTemplateCatalog,
  type FormData,
  type MarketTemplateItem,
  type MarketTemplateKind,
  type MarketTemplateSource,
} from "@/components/developer/types";
import { Code2, Shield, Dice5, TrendingUp } from "lucide-react";
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

const enableAdminTemplateCatalog =
  process.env.NEXT_PUBLIC_ENABLE_ADMIN_TEMPLATE_CATALOG === "true";

const initialForm: FormData = {
  app_id: "",
  name: "",
  name_zh: "",
  description: "",
  description_zh: "",
  icon: "app-window",
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
      icon: sourceForm.icon || "app-window",
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
        <title>Developer Portal - Neo Miniapps</title>
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

      <DeveloperCalloutSection onOpenBuilder={() => setShowForm(true)} />

      <TemplateMarketplaceSection
        categories={categories}
        marketKind={marketKind}
        marketCategory={marketCategory}
        marketSource={marketSource}
        marketVerified={marketVerified}
        marketSearch={marketSearch}
        marketLoading={marketLoading}
        marketError={marketError}
        marketTemplates={marketTemplates}
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
        onApplyTemplate={handleApplyMarketTemplate}
      />

      <PlatformFeaturesSection
        items={features.map((feature) => ({
          icon: feature.icon,
          title: feature.title,
          description: feature.desc,
          colorClass: `bg-gradient-to-br ${feature.color}`,
        }))}
      />

      <DeveloperResultToast result={result} showForm={showForm} />

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

              <DeveloperBuilderForm
                form={form}
                onFormChange={setForm}
                categories={categories}
                templateTypes={templateTypes}
                frontendTemplateOptions={frontendTemplateOptions}
                contractTemplateOptions={contractTemplateOptions}
                definitionMode={definitionMode}
                onDefinitionModeChange={setDefinitionMode}
                definitionText={definitionText}
                onDefinitionTextChange={setDefinitionText}
                previewLoading={previewLoading}
                previewResult={previewResult}
                result={result}
                submitting={submitting}
                onGenerate={handleGenerateDefinition}
                onPreview={handlePreviewDefinition}
                onImport={handleImportDefinition}
                onSubmit={handleSubmit}
                onCancel={() => setShowForm(false)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </Layout>
  );
}
