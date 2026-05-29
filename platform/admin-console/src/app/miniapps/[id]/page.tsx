"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import {
  getAdminAuthHeaders,
  getAdminFetchOptions,
} from "@/lib/admin-client";

interface MiniAppConfig {
  permissions: Record<string, boolean | number>;
  tokens?: {
    allowed_assets?: string[];
    withdrawal_limit_24h?: number;
  };
  actions: Record<string, boolean>;
  [key: string]: unknown;
}

const rowClass =
  "flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4";
const labelClass = "cursor-pointer font-semibold text-gray-950 capitalize";
const helperClass = "mt-1 text-sm text-gray-500";
const inputClass =
  "h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm transition-colors placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-100";
const compactNumberClass =
  "h-11 w-28 rounded-xl border border-gray-300 bg-white px-3 text-right text-sm text-gray-900 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-100";
const switchInputClass =
  "miniapp-config-switch-input peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0";
const switchTrackClass =
  "miniapp-config-switch-track pointer-events-none relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-gray-300 bg-gray-200 transition-colors peer-checked:border-emerald-500 peer-checked:bg-emerald-500 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary-500";
const switchThumbClass =
  "h-5 w-5 translate-x-1 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-6";

function formatKey(key: string) {
  return key.replace(/_/g, " ");
}

function parseNumber(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function splitAssets(value: string) {
  return value
    .split(",")
    .map((asset) => asset.trim())
    .filter(Boolean);
}

export default function MiniAppConfigPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const appId = String(params?.id || "");
  const [config, setConfig] = useState<MiniAppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [assetText, setAssetText] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/miniapps/${appId}/config`, {
      ...getAdminFetchOptions(),
      headers: getAdminAuthHeaders(),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) {
          const message =
            data && typeof data === "object" && "error" in data
              ? String(data.error)
              : `HTTP ${res.status}`;
          throw new Error(message);
        }
        return data;
      })
      .then((data) => {
        if (active) {
          setConfig(data);
          setAssetText(
            ((data as MiniAppConfig).tokens?.allowed_assets ?? []).join(", "),
          );
          setLoadError(null);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        const msg =
          e instanceof Error
            ? e.message
            : "Failed to load miniapp configuration";
        console.warn("[miniapps] failed to load miniapp config:", msg);
        if (active) {
          setLoadError(msg);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [appId]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/miniapps/${appId}/config`, {
        ...getAdminFetchOptions(),
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminAuthHeaders() },
        body: JSON.stringify(
          config
            ? {
                ...config,
                tokens: {
                  ...config.tokens,
                  allowed_assets: splitAssets(assetText),
                },
              }
            : config,
        ),
      });
      const payload = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          payload && typeof payload === "object" && "error" in payload
            ? String(payload.error)
            : "Failed to save miniapp configuration";
        throw new Error(message);
      }
      if (
        payload &&
        typeof payload === "object" &&
        "config" in payload &&
        payload.config &&
        typeof payload.config === "object"
      ) {
        const nextConfig = payload.config as MiniAppConfig;
        setConfig(nextConfig);
        setAssetText((nextConfig.tokens?.allowed_assets ?? []).join(", "));
      }
      setSaveSuccess(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  const updatePermission = (key: string, value: boolean | number) => {
    if (!config) return;
    setConfig({
      ...config,
      permissions: { ...config.permissions, [key]: value },
    });
    setSaveSuccess(false);
  };

  const updateAction = (key: string, value: boolean) => {
    if (!config) return;
    setConfig({
      ...config,
      actions: { ...config.actions, [key]: value },
    });
    setSaveSuccess(false);
  };

  const updateTokens = (tokens: NonNullable<MiniAppConfig["tokens"]>) => {
    if (!config) return;
    setConfig({ ...config, tokens: { ...config.tokens, ...tokens } });
    setSaveSuccess(false);
  };

  const goBack = () => router.push("/miniapps");

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Spinner />
      </div>
    );
  }

  if (loadError || !config) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={goBack}>
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-black text-gray-950 sm:text-3xl">
              MiniApp Configuration
            </h1>
            <p className="mt-1 font-mono text-sm text-gray-500">{appId}</p>
          </div>
        </div>
        <div
          role="alert"
          aria-label="MiniApp configuration could not be loaded"
          className="rounded-xl border border-danger-200 bg-danger-50 p-6"
        >
          <p className="text-sm font-semibold text-danger-700">
            MiniApp configuration could not be loaded
          </p>
          <p className="mt-1 text-sm text-danger-700">
            {loadError || "Configuration unavailable"}
          </p>
        </div>
      </div>
    );
  }

  const allowedAssets = config.tokens?.allowed_assets ?? [];
  const summaryItems = [
    {
      label: "MiniApp ID",
      value: appId,
      helper: "Scoped runtime config",
    },
    {
      label: "TEE Gates",
      value: String(Object.keys(config.permissions).length),
      helper: "Oracle, compute, and gas limits",
    },
    {
      label: "Allowed Assets",
      value: String(allowedAssets.length),
      helper: allowedAssets.join(", ") || "No assets configured",
    },
    {
      label: "Lifecycle Locks",
      value: String(Object.values(config.actions).filter(Boolean).length),
      helper: "Enabled safety actions",
    },
  ];

  return (
    <div className="space-y-6">
      {saveError && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-4">
          <p className="text-sm font-semibold text-danger-700">
            Failed to save: {saveError}
          </p>
        </div>
      )}
      {saveSuccess && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"
        >
          <p className="text-sm font-semibold text-emerald-800">
            Configuration saved
          </p>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-4">
          <Button variant="ghost" onClick={goBack}>
            <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-black text-gray-950 sm:text-3xl">
              MiniApp Configuration
            </h1>
            <p className="mt-1 font-mono text-sm text-gray-500">{appId}</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving} isLoading={saving}>
          Save Configuration
        </Button>
      </div>

      <div
        aria-label="MiniApp configuration overview"
        className="miniapp-config-overview grid gap-3 lg:grid-cols-4"
      >
        {summaryItems.map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
          >
            <p className="text-xs font-semibold uppercase text-gray-500">
              {item.label}
            </p>
            <p className="mt-2 truncate text-2xl font-black text-gray-950">
              {item.value}
            </p>
            <p className="mt-1 truncate text-xs font-medium text-gray-500">
              {item.helper}
            </p>
          </div>
        ))}
      </div>

      <div
        aria-label="MiniApp configuration controls"
        className="miniapp-config-controls grid gap-6 xl:grid-cols-2"
      >
        <Card variant="default">
          <CardHeader>
            <CardTitle>TEE Permissions</CardTitle>
            <p className="mt-1 text-sm text-gray-500">
              Keep runtime access and gas ceilings readable before publishing.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(config.permissions).map(([key, value]) => {
              const label = formatKey(key);
              return (
                <div key={key} className={rowClass}>
                  <div className="min-w-0">
                    <label
                      id={`perm-${key}-label`}
                      htmlFor={`perm-${key}-${typeof value}`}
                      className={labelClass}
                    >
                      {label}
                    </label>
                    <p className={helperClass}>
                      {typeof value === "boolean"
                        ? "Permission gate"
                        : "Numeric policy limit"}
                    </p>
                  </div>
                  {typeof value === "boolean" ? (
                    <label
                      htmlFor={`perm-${key}-boolean`}
                      className="relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center"
                    >
                      <input
                        id={`perm-${key}-boolean`}
                        type="checkbox"
                        aria-labelledby={`perm-${key}-label`}
                        checked={value}
                        onChange={(e) =>
                          updatePermission(key, e.target.checked)
                        }
                        className={switchInputClass}
                      />
                      <span className={switchTrackClass} aria-hidden="true">
                        <span className={switchThumbClass} />
                      </span>
                    </label>
                  ) : (
                    <input
                      id={`perm-${key}-number`}
                      type="number"
                      aria-label={`${label} value`}
                      value={value}
                      onChange={(e) =>
                        updatePermission(key, parseNumber(e.target.value))
                      }
                      className={compactNumberClass}
                    />
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card variant="default">
          <CardHeader>
            <CardTitle>Tokens & Assets</CardTitle>
            <p className="mt-1 text-sm text-gray-500">
              Define wallet-facing assets and withdrawal guardrails.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label
                htmlFor="allowed-assets"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Allowed Assets (Comma separated)
              </label>
              <input
                id="allowed-assets"
                type="text"
                value={assetText}
                onChange={(e) => {
                  setAssetText(e.target.value);
                  updateTokens({ allowed_assets: splitAssets(e.target.value) });
                }}
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="withdrawal-limit"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                24H Withdrawal Limit
              </label>
              <input
                id="withdrawal-limit"
                type="number"
                value={config.tokens?.withdrawal_limit_24h ?? ""}
                onChange={(e) =>
                  updateTokens({
                    withdrawal_limit_24h: parseNumber(e.target.value),
                  })
                }
                className={inputClass}
              />
            </div>
          </CardContent>
        </Card>

        <Card variant="default" className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Lifecycle Actions</CardTitle>
            <p className="mt-1 text-sm text-gray-500">
              Use explicit safety toggles for app suspension and maintenance.
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {Object.entries(config.actions).map(([key, value]) => {
              const label = formatKey(key);
              return (
                <div key={key} className={rowClass}>
                  <div className="min-w-0">
                    <label
                      id={`action-${key}-label`}
                      htmlFor={`action-${key}-toggle`}
                      className={labelClass}
                    >
                      {label}
                    </label>
                    <p className={helperClass}>Safety action</p>
                  </div>
                  <label
                    htmlFor={`action-${key}-toggle`}
                    className="relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center"
                  >
                    <input
                      id={`action-${key}-toggle`}
                      type="checkbox"
                      aria-labelledby={`action-${key}-label`}
                      checked={value}
                      onChange={(e) => updateAction(key, e.target.checked)}
                      className={switchInputClass}
                    />
                    <span className={switchTrackClass} aria-hidden="true">
                      <span className={switchThumbClass} />
                    </span>
                  </label>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
