"use client";

import { useMemo, useState } from "react";
import type { CatalogUpsertRequest, RuntimeMiniAppConfig } from "./types";
import { Button } from "@/components/ui/Button";

const CATEGORY_OPTIONS: Array<CatalogUpsertRequest["category"]> = [
  "utility",
  "gaming",
  "defi",
  "social",
  "nft",
  "governance",
];

const DEFAULT_OPERATION_JSON = JSON.stringify(
  {
    title: "Operation Panel",
    description: "Configure action fields for this miniapp",
    actionLabel: "Submit",
    actionMethod: "execute",
    fields: [
      {
        key: "amount",
        type: "amount",
        label: "Amount",
        placeholder: "1.0",
        required: true,
        argType: "Integer",
      },
    ],
  },
  null,
  2
);

const DEFAULT_BUTTONS_JSON = JSON.stringify(
  [
    {
      id: "submit",
      label: "Execute",
      variant: "primary",
      action: {
        type: "invoke",
        method: "execute",
      },
    },
  ],
  null,
  2
);

function parseJsonOrThrow<T>(label: string, raw: string, fallback: T): T {
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error(`${label} must be valid JSON`);
  }
}

export function CatalogBuilder() {
  const [form, setForm] = useState({
    app_id: "",
    name: "",
    name_zh: "",
    description: "",
    description_zh: "",
    short_description: "",
    category: "utility" as CatalogUpsertRequest["category"],
    entry_url: "",
    chain_id: "neo-n3-mainnet",
    contract_address: "",
    icon_url: "",
    banner_url: "",
    developer_name: "Platform Admin",
    developer_address: "platform-admin",
    docs_title: "",
    docs_subtitle: "",
    docs_steps: "",
    docs_features_json: "",
    operation_json: DEFAULT_OPERATION_JSON,
    buttons_json: DEFAULT_BUTTONS_JSON,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return Boolean(
      form.app_id.trim() &&
      form.name.trim() &&
      form.description.trim() &&
      form.entry_url.trim() &&
      form.chain_id.trim() &&
      form.contract_address.trim()
    );
  }, [form]);

  const setField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setError(null);
    setSuccess(null);
    setIsSubmitting(true);

    try {
      const docsSteps = form.docs_steps
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      const docsFeatures = parseJsonOrThrow<Array<{ name: string; description: string }>>(
        "Docs features",
        form.docs_features_json,
        []
      );

      const runtimeConfig: RuntimeMiniAppConfig = {};
      if (form.docs_title.trim()) {
        runtimeConfig.docs = {
          title: form.docs_title.trim(),
          subtitle: form.docs_subtitle.trim() || undefined,
          steps: docsSteps.length > 0 ? docsSteps : undefined,
          features: docsFeatures.length > 0 ? docsFeatures : undefined,
        };
      }

      const operation = parseJsonOrThrow<RuntimeMiniAppConfig["operation"]>(
        "Operation config",
        form.operation_json,
        undefined
      );
      if (operation) {
        runtimeConfig.operation = operation;
      }

      const buttons = parseJsonOrThrow<RuntimeMiniAppConfig["buttons"]>("Button options", form.buttons_json, []);
      if (buttons && buttons.length > 0) {
        runtimeConfig.buttons = buttons;
      }

      const payload: CatalogUpsertRequest = {
        app_id: form.app_id.trim(),
        name: form.name.trim(),
        name_zh: form.name_zh.trim() || undefined,
        description: form.description.trim(),
        description_zh: form.description_zh.trim() || undefined,
        short_description: form.short_description.trim() || undefined,
        category: form.category,
        entry_url: form.entry_url.trim(),
        chain_id: form.chain_id.trim(),
        contract_address: form.contract_address.trim(),
        icon_url: form.icon_url.trim() || undefined,
        banner_url: form.banner_url.trim() || undefined,
        developer_name: form.developer_name.trim() || undefined,
        developer_address: form.developer_address.trim() || undefined,
        runtime_config: Object.keys(runtimeConfig).length > 0 ? runtimeConfig : undefined,
      };

      const response = await fetch("/api/admin/miniapps/catalog", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to save miniapp");
      }

      setSuccess(`Miniapp ${payload.app_id} saved and published.`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unknown error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-emerald-50 p-4 dark:bg-emerald-900/20">
        <h3 className="mb-1 text-sm font-semibold text-emerald-900 dark:text-emerald-300">No-Code MiniApp Builder</h3>
        <p className="text-xs text-emerald-700 dark:text-emerald-400">
          Create or update a miniapp by configuring metadata, contract address, docs, operation interface, and button
          options. No additional code changes are required.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">App ID</span>
          <input
            className="border-border/30 bg-muted/20 w-full rounded border px-3 py-2"
            value={form.app_id}
            onChange={(event) => setField("app_id", event.target.value)}
            placeholder="miniapp-my-app"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Category</span>
          <select
            className="border-border/30 bg-muted/20 w-full rounded border px-3 py-2"
            value={form.category}
            onChange={(event) => setField("category", event.target.value)}
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Name</span>
          <input
            className="border-border/30 bg-muted/20 w-full rounded border px-3 py-2"
            value={form.name}
            onChange={(event) => setField("name", event.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Name (ZH)</span>
          <input
            className="border-border/30 bg-muted/20 w-full rounded border px-3 py-2"
            value={form.name_zh}
            onChange={(event) => setField("name_zh", event.target.value)}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Entry URL</span>
          <input
            className="border-border/30 bg-muted/20 w-full rounded border px-3 py-2"
            value={form.entry_url}
            onChange={(event) => setField("entry_url", event.target.value)}
            placeholder="https://cdn.example.com/miniapps/my-app/index.html"
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Chain ID</span>
          <input
            className="border-border/30 bg-muted/20 w-full rounded border px-3 py-2"
            value={form.chain_id}
            onChange={(event) => setField("chain_id", event.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Contract Address</span>
          <input
            className="border-border/30 bg-muted/20 w-full rounded border px-3 py-2"
            value={form.contract_address}
            onChange={(event) => setField("contract_address", event.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Short Description</span>
          <input
            className="border-border/30 bg-muted/20 w-full rounded border px-3 py-2"
            value={form.short_description}
            onChange={(event) => setField("short_description", event.target.value)}
          />
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Icon URL</span>
          <input
            className="border-border/30 bg-muted/20 w-full rounded border px-3 py-2"
            value={form.icon_url}
            onChange={(event) => setField("icon_url", event.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Banner URL</span>
          <input
            className="border-border/30 bg-muted/20 w-full rounded border px-3 py-2"
            value={form.banner_url}
            onChange={(event) => setField("banner_url", event.target.value)}
          />
        </label>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Description</span>
        <textarea
          className="border-border/30 bg-muted/20 min-h-[96px] w-full rounded border px-3 py-2"
          value={form.description}
          onChange={(event) => setField("description", event.target.value)}
        />
      </label>

      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Description (ZH)</span>
        <textarea
          className="border-border/30 bg-muted/20 min-h-[96px] w-full rounded border px-3 py-2"
          value={form.description_zh}
          onChange={(event) => setField("description_zh", event.target.value)}
        />
      </label>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Docs Title</span>
          <input
            className="border-border/30 bg-muted/20 w-full rounded border px-3 py-2"
            value={form.docs_title}
            onChange={(event) => setField("docs_title", event.target.value)}
          />
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Docs Subtitle</span>
          <input
            className="border-border/30 bg-muted/20 w-full rounded border px-3 py-2"
            value={form.docs_subtitle}
            onChange={(event) => setField("docs_subtitle", event.target.value)}
          />
        </label>
      </div>

      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Docs Steps (one per line)</span>
        <textarea
          className="border-border/30 bg-muted/20 min-h-[96px] w-full rounded border px-3 py-2"
          value={form.docs_steps}
          onChange={(event) => setField("docs_steps", event.target.value)}
          placeholder={`Connect wallet\nEnter amount\nSubmit transaction`}
        />
      </label>

      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Docs Features JSON</span>
        <textarea
          className="border-border/30 bg-muted/20 min-h-[120px] w-full rounded border px-3 py-2 font-mono text-xs"
          value={form.docs_features_json}
          onChange={(event) => setField("docs_features_json", event.target.value)}
          placeholder={`[{"name":"Fast settlement","description":"Transactions settle quickly"}]`}
        />
      </label>

      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Operation Config JSON</span>
        <textarea
          className="border-border/30 bg-muted/20 min-h-[180px] w-full rounded border px-3 py-2 font-mono text-xs"
          value={form.operation_json}
          onChange={(event) => setField("operation_json", event.target.value)}
        />
      </label>

      <label className="block space-y-1 text-sm">
        <span className="text-muted-foreground">Button Options JSON</span>
        <textarea
          className="border-border/30 bg-muted/20 min-h-[180px] w-full rounded border px-3 py-2 font-mono text-xs"
          value={form.buttons_json}
          onChange={(event) => setField("buttons_json", event.target.value)}
        />
      </label>

      {error && <div className="rounded border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">{error}</div>}
      {success && <div className="rounded border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-400">{success}</div>}

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
          {isSubmitting ? "Saving..." : "Save MiniApp"}
        </Button>
      </div>
    </div>
  );
}
