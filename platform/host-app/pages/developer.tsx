import Head from "next/head";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import {
  X,
  Code2,
  Rocket,
  Shield,
  Dice5,
  TrendingUp,
  ChevronRight,
  ExternalLink,
  Upload,
  Database,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import yaml from "js-yaml";
import { logger } from "@/lib/logger";

const features = [
  { icon: Code2, title: "Template SDK", desc: "Generate miniapps from JSON/YAML", color: "from-blue-500 to-cyan-500" },
  { icon: Shield, title: "Schema Guard", desc: "Config validation before publish", color: "from-purple-500 to-pink-500" },
  { icon: Dice5, title: "Contract Templating", desc: "Parameterized contract templates", color: "from-emerald-500 to-emerald-600" },
  { icon: TrendingUp, title: "Template Market", desc: "Foundation for creator marketplace", color: "from-orange-500 to-yellow-500" },
];

const categories = ["gaming", "defi", "social", "nft", "governance", "utility"] as const;
const templateTypes = ["default", "prediction", "gaming", "defi", "nft"] as const;

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

export default function DeveloperPage() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormData>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [definitionMode, setDefinitionMode] = useState<"json" | "yaml">("json");
  const [definitionText, setDefinitionText] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [catalog, setCatalog] = useState<AdminTemplateCatalog | null>(null);

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const res = await fetch("/api/miniapps/admin/template-catalog", { signal: AbortSignal.timeout(10000) });
        if (!res.ok) return;
        const data = (await res.json()) as AdminTemplateCatalog;
        setCatalog(data);
      } catch (error) {
        logger.debug("template catalog unavailable", error);
      }
    };

    loadCatalog();
  }, []);

  const frontendTemplateOptions = useMemo(
    () => (catalog?.frontend_templates || []).map((item) => item.template_id),
    [catalog],
  );
  const contractTemplateOptions = useMemo(
    () => (catalog?.contract_templates || []).map((item) => item.template_id),
    [catalog],
  );

  const buildDefinitionPayload = () => {
    const appSlug = normalizeSlug(form.app_id || form.name);
    const appId = appSlug.startsWith("miniapp-") ? appSlug : `miniapp-${appSlug}`;
    return {
      app_id: appId,
      name: form.name,
      name_zh: form.name_zh || undefined,
      description: form.description,
      description_zh: form.description_zh || undefined,
      template_type: form.template_type,
      category: form.category,
      icon: form.icon || "📦",
      entry_url: form.entry_url,
      contract_hash: form.contract_hash || undefined,
      docs_url: form.docs_url || undefined,
      developer: {
        name: form.developer_name || undefined,
      },
      template: {
        template_type: form.template_type,
        frontend_template: {
          template_id: form.frontend_template_id || form.template_type,
          version: "1.0.0",
        },
        contract_template: {
          template_id: form.contract_template_id || undefined,
          version: "1.0.0",
        },
      },
      contract_template: {
        template_id: form.contract_template_id || undefined,
      },
      frontend_template: {
        template_id: form.frontend_template_id || form.template_type,
      },
      contract: {
        template_id: form.contract_template_id || undefined,
      },
      media: {
        logo: form.logo_url || undefined,
        banner: form.banner_url || undefined,
      },
      i18n: {
        name_zh: form.name_zh || undefined,
        description_zh: form.description_zh || undefined,
      },
      permissions: {
        payments: true,
      },
      limits: {
        max_gas_per_tx: "10",
        daily_gas_cap_per_user: "100",
      },
      frontend_spec: {
        layout: form.template_type === "prediction" ? "prediction" : "default",
        tabs: [
          {
            id: "overview",
            label: "Overview",
            type: "content",
            blocks: [{ type: "markdown", content: form.description || "" }],
          },
        ],
      },
      operations: [],
    };
  };

  const syncDefinitionText = (mode: "json" | "yaml", payload: Record<string, unknown>) => {
    if (mode === "json") {
      setDefinitionText(JSON.stringify(payload, null, 2));
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
      if (file.name.toLowerCase().endsWith(".yaml") || file.name.toLowerCase().endsWith(".yml")) {
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
      setPreviewResult({ ok: false, message: "Please generate or paste JSON/YAML definition first." });
      return;
    }

    setPreviewLoading(true);
    setPreviewResult(null);
    try {
      const res = await fetch("/api/miniapps/admin/definition-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: definitionText }),
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPreviewResult({ ok: false, message: asErrorMessage(data, "Preview failed") });
        return;
      }
      setPreviewResult({ ok: true, message: "Schema + runtime preview passed." });
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
      const definitionPayloadText = definitionText.trim() || JSON.stringify(payload, null, 2);

      const previewRes = await fetch("/api/miniapps/admin/definition-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: definitionPayloadText }),
        signal: AbortSignal.timeout(30000),
      });
      const previewData = await previewRes.json().catch(() => ({}));
      if (!previewRes.ok) {
        setResult({ success: false, message: asErrorMessage(previewData, "Definition preview failed") });
        return;
      }

      const parsedDefinition =
        previewData && typeof previewData === "object" && !Array.isArray(previewData)
          ? ((previewData as Record<string, unknown>).parsed_definition as Record<string, unknown> | undefined)
          : undefined;

      const upsertSource = parsedDefinition && typeof parsedDefinition === "object" ? parsedDefinition : payload;

      const resolvedDeveloperUserId =
        form.developer_user_id ||
        (typeof upsertSource.developer_user_id === "string" ? upsertSource.developer_user_id : "");

      const resolvedDeveloperPubKey =
        form.developer_pubkey ||
        (typeof upsertSource.developer_pubkey === "string" ? upsertSource.developer_pubkey : "");

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
        signal: AbortSignal.timeout(30000),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok) {
        setResult({ success: true, message: `MiniApp definition for "${form.name}" saved as draft.` });
        setForm(initialForm);
        setDefinitionText("");
        setPreviewResult(null);
        setTimeout(() => setShowForm(false), 1500);
      } else {
        setResult({ success: false, message: asErrorMessage(data, "Save draft failed") });
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
        <title>Developer Portal - Neo MiniApp Platform</title>
      </Head>

      <section className="relative overflow-hidden py-20">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-neo/20 blur-[120px] rounded-full" />
          <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-orange-500/20 blur-[120px] rounded-full" />
        </div>

        <div className="mx-auto max-w-7xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-neo/10 border border-neo/20 text-neo text-sm font-medium mb-6">
              <Rocket size={16} aria-hidden="true" />
              Template-first MiniApp Builder
            </div>
            <h1 className="text-2xl sm:text-4xl md:text-6xl font-extrabold text-gray-900 dark:text-white">
              Developer <span className="neo-gradient-text">Portal</span>
            </h1>
            <p className="mt-6 text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Build, configure, and publish MiniApps from JSON/YAML definitions with frontend and contract templates.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-6 md:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="glass-card rounded-2xl p-8 bg-white dark:bg-gray-900/50"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-neo to-emerald-600 flex items-center justify-center">
                  <Code2 className="text-white" size={24} aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Quick Start</h2>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">No-code + config-driven workflow</p>
                </div>
              </div>
              <div className="rounded-xl bg-gray-900 dark:bg-black/50 p-4 font-mono text-sm overflow-x-auto">
                <div className="text-gray-500"># Build from templates</div>
                <div className="text-neo">Generate JSON or YAML miniapp definition</div>
                <div className="text-gray-500 mt-3"># Validate + save</div>
                <div className="text-neo">POST /api/miniapps/admin/definition-preview</div>
              </div>
              <Link href="/docs">
                <Button className="mt-6 bg-neo hover:bg-neo/90 text-gray-900 font-semibold">
                  Read Documentation
                  <ChevronRight size={16} className="ml-1" aria-hidden="true" />
                </Button>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="glass-card rounded-2xl p-8 bg-white dark:bg-gray-900/50"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-500 to-red-600 flex items-center justify-center">
                  <Database className="text-white" size={24} aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Definition Builder</h2>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">JSON / YAML + template catalog</p>
                </div>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Publish-like-article workflow: fill form, generate definition, preview, then save draft.
              </p>
              <ul className="space-y-2 mb-6">
                {["Template type + template ID mapping", "Schema + runtime preview", "Banner/logo URL + variants ready"].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-neo" />
                    {item}
                  </li>
                ))}
              </ul>
              <Button
                onClick={() => setShowForm(true)}
                className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-semibold"
              >
                Open Builder
                <ExternalLink size={16} className="ml-2" aria-hidden="true" />
              </Button>
            </motion.div>
          </div>
        </div>
      </section>

      <section className="py-12 px-4">
        <div className="mx-auto max-w-7xl">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-8">Platform Features</h2>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            {features.map((f, idx) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 * idx }}
                className="group glass-card rounded-xl p-6 bg-gray-100 dark:bg-gray-900/30 hover:bg-gray-200 dark:hover:bg-gray-900/50 transition-all"
              >
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                >
                  <f.icon className="text-white" size={24} aria-hidden="true" />
                </div>
                <h3 className="font-bold text-gray-900 dark:text-white mb-1">{f.title}</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <AnimatePresence>
        {result && !showForm && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 right-6 z-50"
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
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            />

            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              role="dialog"
              aria-modal="true"
              aria-label="Template Builder"
              className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-2xl bg-white dark:bg-gray-900/95 backdrop-blur-xl border-l border-gray-200 dark:border-gray-700 shadow-2xl overflow-y-auto"
              tabIndex={-1}
            >
              <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200 dark:border-gray-700 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white">MiniApp Template Builder</h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">No-code style config + definition preview</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    aria-label="Close panel"
                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
                  >
                    <X className="text-gray-500 dark:text-gray-400" size={20} />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div>
                  <label htmlFor="submit-app-id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">App ID</label>
                  <input
                    id="submit-app-id"
                    type="text"
                    placeholder="miniapp-my-app"
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus-visible:outline-none focus-visible:border-neo/50 focus-visible:ring-1 focus-visible:ring-neo/50 transition-all"
                    value={form.app_id}
                    onChange={(e) => setForm({ ...form, app_id: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="submit-app-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Name *</label>
                    <input
                      id="submit-app-name"
                      type="text"
                      required
                      placeholder="My MiniApp"
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus-visible:outline-none focus-visible:border-neo/50 focus-visible:ring-1 focus-visible:ring-neo/50 transition-all"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label htmlFor="submit-app-name-zh" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Name (中文)</label>
                    <input
                      id="submit-app-name-zh"
                      type="text"
                      placeholder="可选"
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus-visible:outline-none focus-visible:border-neo/50 focus-visible:ring-1 focus-visible:ring-neo/50 transition-all"
                      value={form.name_zh}
                      onChange={(e) => setForm({ ...form, name_zh: e.target.value })}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="submit-app-desc" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description *</label>
                  <textarea
                    id="submit-app-desc"
                    required
                    rows={3}
                    placeholder="Describe what your app does..."
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus-visible:outline-none focus-visible:border-neo/50 focus-visible:ring-1 focus-visible:ring-neo/50 transition-all resize-none"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                  />
                </div>

                <div>
                  <label htmlFor="submit-app-desc-zh" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Description (中文)</label>
                  <textarea
                    id="submit-app-desc-zh"
                    rows={2}
                    placeholder="可选"
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus-visible:outline-none focus-visible:border-neo/50 focus-visible:ring-1 focus-visible:ring-neo/50 transition-all resize-none"
                    value={form.description_zh}
                    onChange={(e) => setForm({ ...form, description_zh: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label htmlFor="submit-app-icon" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Icon</label>
                    <input
                      id="submit-app-icon"
                      type="text"
                      placeholder="📦"
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-center text-2xl placeholder-gray-500 dark:placeholder-gray-400 focus-visible:outline-none focus-visible:border-neo/50 focus-visible:ring-1 focus-visible:ring-neo/50 transition-all"
                      value={form.icon}
                      onChange={(e) => setForm({ ...form, icon: e.target.value })}
                    />
                  </div>
                  <div>
                    <label htmlFor="submit-app-category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category</label>
                    <select
                      id="submit-app-category"
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus-visible:outline-none focus-visible:border-neo/50 focus-visible:ring-1 focus-visible:ring-neo/50 transition-all"
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value as FormData["category"] })}
                    >
                      {categories.map((c) => (
                        <option key={c} value={c} className="bg-white dark:bg-gray-900">{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="submit-template-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Template Type</label>
                    <select
                      id="submit-template-type"
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white focus-visible:outline-none focus-visible:border-neo/50 focus-visible:ring-1 focus-visible:ring-neo/50 transition-all"
                      value={form.template_type}
                      onChange={(e) => setForm({ ...form, template_type: e.target.value as FormData["template_type"] })}
                    >
                      {templateTypes.map((t) => (
                        <option key={t} value={t} className="bg-white dark:bg-gray-900">{t}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="submit-contract-hash" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Contract Hash</label>
                    <input
                      id="submit-contract-hash"
                      type="text"
                      placeholder="0x..."
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus-visible:outline-none focus-visible:border-neo/50 focus-visible:ring-1 focus-visible:ring-neo/50 transition-all font-mono text-sm"
                      value={form.contract_hash}
                      onChange={(e) => setForm({ ...form, contract_hash: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="submit-frontend-template-id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Frontend Template ID</label>
                    <input
                      id="submit-frontend-template-id"
                      type="text"
                      list="frontend-template-options"
                      placeholder="default"
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus-visible:outline-none focus-visible:border-neo/50 focus-visible:ring-1 focus-visible:ring-neo/50 transition-all"
                      value={form.frontend_template_id}
                      onChange={(e) => setForm({ ...form, frontend_template_id: e.target.value })}
                    />
                    <datalist id="frontend-template-options">
                      {frontendTemplateOptions.map((id) => (
                        <option key={id} value={id} />
                      ))}
                    </datalist>
                  </div>
                  <div>
                    <label htmlFor="submit-contract-template-id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Contract Template ID</label>
                    <input
                      id="submit-contract-template-id"
                      type="text"
                      list="contract-template-options"
                      placeholder="prediction-binary"
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus-visible:outline-none focus-visible:border-neo/50 focus-visible:ring-1 focus-visible:ring-neo/50 transition-all"
                      value={form.contract_template_id}
                      onChange={(e) => setForm({ ...form, contract_template_id: e.target.value })}
                    />
                    <datalist id="contract-template-options">
                      {contractTemplateOptions.map((id) => (
                        <option key={id} value={id} />
                      ))}
                    </datalist>
                  </div>
                </div>

                <div>
                  <label htmlFor="submit-entry-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Entry URL *</label>
                  <input
                    id="submit-entry-url"
                    type="url"
                    required
                    placeholder="https://your-app.com/miniapp"
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus-visible:outline-none focus-visible:border-neo/50 focus-visible:ring-1 focus-visible:ring-neo/50 transition-all"
                    value={form.entry_url}
                    onChange={(e) => setForm({ ...form, entry_url: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label htmlFor="submit-logo-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Logo URL</label>
                    <input
                      id="submit-logo-url"
                      type="url"
                      placeholder="https://cdn/logo.png"
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus-visible:outline-none focus-visible:border-neo/50 focus-visible:ring-1 focus-visible:ring-neo/50 transition-all"
                      value={form.logo_url}
                      onChange={(e) => setForm({ ...form, logo_url: e.target.value })}
                    />
                  </div>
                  <div>
                    <label htmlFor="submit-banner-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Banner URL</label>
                    <input
                      id="submit-banner-url"
                      type="url"
                      placeholder="https://cdn/banner.png"
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus-visible:outline-none focus-visible:border-neo/50 focus-visible:ring-1 focus-visible:ring-neo/50 transition-all"
                      value={form.banner_url}
                      onChange={(e) => setForm({ ...form, banner_url: e.target.value })}
                    />
                  </div>
                  <div>
                    <label htmlFor="submit-docs-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Docs URL</label>
                    <input
                      id="submit-docs-url"
                      type="url"
                      placeholder="https://docs.example.com"
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus-visible:outline-none focus-visible:border-neo/50 focus-visible:ring-1 focus-visible:ring-neo/50 transition-all"
                      value={form.docs_url}
                      onChange={(e) => setForm({ ...form, docs_url: e.target.value })}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Developer Metadata</h3>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="submit-dev-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Developer Name</label>
                      <input
                        id="submit-dev-name"
                        type="text"
                        placeholder="Your name or team"
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus-visible:outline-none focus-visible:border-neo/50 focus-visible:ring-1 focus-visible:ring-neo/50 transition-all"
                        value={form.developer_name}
                        onChange={(e) => setForm({ ...form, developer_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <label htmlFor="submit-dev-user-id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Developer User ID (UUID) *</label>
                      <input
                        id="submit-dev-user-id"
                        type="text"
                        required
                        placeholder="123e4567-e89b-12d3-a456-426614174000"
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus-visible:outline-none focus-visible:border-neo/50 focus-visible:ring-1 focus-visible:ring-neo/50 transition-all font-mono text-sm"
                        value={form.developer_user_id}
                        onChange={(e) => setForm({ ...form, developer_user_id: e.target.value })}
                      />
                    </div>
                    <div>
                      <label htmlFor="submit-dev-pubkey" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Developer PubKey</label>
                      <input
                        id="submit-dev-pubkey"
                        type="text"
                        placeholder="03ab..."
                        className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus-visible:outline-none focus-visible:border-neo/50 focus-visible:ring-1 focus-visible:ring-neo/50 transition-all font-mono text-sm"
                        value={form.developer_pubkey}
                        onChange={(e) => setForm({ ...form, developer_pubkey: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">JSON / YAML Definition</h3>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className={`px-2.5 py-1 rounded-md text-xs border ${definitionMode === "json" ? "border-neo text-neo" : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300"}`}
                        onClick={() => setDefinitionMode("json")}
                      >
                        JSON
                      </button>
                      <button
                        type="button"
                        className={`px-2.5 py-1 rounded-md text-xs border ${definitionMode === "yaml" ? "border-neo text-neo" : "border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300"}`}
                        onClick={() => setDefinitionMode("yaml")}
                      >
                        YAML
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mb-3">
                    <Button type="button" variant="outline" className="text-xs" onClick={handleGenerateDefinition}>
                      <Database size={14} className="mr-1" />
                      Generate From Form
                    </Button>
                    <Button type="button" variant="outline" className="text-xs" onClick={handlePreviewDefinition}>
                      <Rocket size={14} className="mr-1" />
                      {previewLoading ? "Previewing..." : "Schema + Runtime Preview"}
                    </Button>
                    <label className="inline-flex items-center px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-xs cursor-pointer hover:bg-gray-100 dark:hover:bg-white/10">
                      <Upload size={14} className="mr-1" />
                      Import File
                      <input
                        type="file"
                        accept=".json,.yaml,.yml"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImportDefinition(file);
                          e.currentTarget.value = "";
                        }}
                      />
                    </label>
                  </div>

                  <textarea
                    value={definitionText}
                    onChange={(e) => setDefinitionText(e.target.value)}
                    rows={10}
                    placeholder={definitionMode === "json" ? "Paste miniapp definition JSON..." : "Paste miniapp definition YAML..."}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus-visible:outline-none focus-visible:border-neo/50 focus-visible:ring-1 focus-visible:ring-neo/50 transition-all font-mono text-xs"
                  />

                  {previewResult && (
                    <div
                      role="alert"
                      className={`mt-3 rounded-xl p-3 text-xs ${
                        previewResult.ok
                          ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-300"
                          : "bg-red-500/20 border border-red-500/30 text-red-300"
                      }`}
                    >
                      {previewResult.message}
                    </div>
                  )}
                </div>

                {result && (
                  <div
                    role="alert"
                    className={`rounded-xl p-4 ${
                      result.success
                        ? "bg-emerald-500/20 border border-emerald-500/30 text-emerald-400"
                        : "bg-red-500/20 border border-red-500/30 text-red-400"
                    }`}
                  >
                    {result.message}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowForm(false)}
                    className="flex-1 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 bg-gradient-to-r from-neo to-emerald-600 hover:from-neo/90 hover:to-emerald-600/90 text-gray-900 font-semibold"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-gray-900/30 border-t-gray-900 rounded-full animate-spin" />
                        Saving...
                      </span>
                    ) : (
                      "Save Draft"
                    )}
                  </Button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </Layout>
  );
}
