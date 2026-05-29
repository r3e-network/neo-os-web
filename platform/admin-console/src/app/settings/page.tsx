"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  getAdminAuthHeaders,
  getAdminFetchOptions,
} from "@/lib/admin-client";

interface PlatformConfig {
  maintenanceMode?: boolean;
  approvalGateRequired?: boolean;
  maxMiniappSizeMb?: number;
  pricefeedIntervalMs?: number;
  logLevel?: string;
  [key: string]: unknown;
}

export default function SettingsPage() {
  const [config, setConfig] = useState<PlatformConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/settings", {
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
          setLoadError(null);
          setLoading(false);
        }
      })
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : "Failed to load settings";
        console.warn("[settings] failed to load config:", msg);
        if (active) {
          setLoadError(msg);
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/settings", {
        ...getAdminFetchOptions(),
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAdminAuthHeaders() },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      const nextConfig = await res.json().catch(() => null);
      if (nextConfig && typeof nextConfig === "object") {
        setConfig(nextConfig);
      }
      setSaveSuccess(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  const updateNumber = (
    key: "maxMiniappSizeMb" | "pricefeedIntervalMs",
    value: string,
  ) => {
    if (!config) return;
    const parsed = Number.parseInt(value, 10);
    setConfig({
      ...config,
      [key]: Number.isFinite(parsed) ? parsed : undefined,
    });
    setSaveSuccess(false);
  };

  const updateBoolean = (
    key: "maintenanceMode" | "approvalGateRequired",
    checked: boolean,
  ) => {
    if (!config) return;
    setConfig({ ...config, [key]: checked });
    setSaveSuccess(false);
  };

  const updateLogLevel = (value: string) => {
    if (!config) return;
    setConfig({ ...config, logLevel: value });
    setSaveSuccess(false);
  };

  const formatInterval = (ms?: number) =>
    typeof ms === "number" && Number.isFinite(ms)
      ? `${Math.round(ms / 1000)}s`
      : "Not set";
  const summaryItems = config
    ? [
        {
          label: "Runtime Mode",
          value: config.maintenanceMode ? "Maintenance" : "Operational",
          helper: config.maintenanceMode
            ? "Non-admin traffic paused"
            : "Traffic allowed",
        },
        {
          label: "Approval Review",
          value: config.approvalGateRequired ? "Required" : "Optional",
          helper: "Production publish gate",
        },
        {
          label: "PriceFeed Refresh",
          value: formatInterval(config.pricefeedIntervalMs),
          helper: "Oracle polling cadence",
        },
        {
          label: "Bundle Limit",
          value:
            typeof config.maxMiniappSizeMb === "number"
              ? `${config.maxMiniappSizeMb} MB`
              : "Not set",
          helper: "MiniApp upload guardrail",
        },
      ]
    : [];
  const controlRowClass =
    "flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 p-4";
  const switchInputClass =
    "settings-switch-input peer absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0";
  const switchTrackClass =
    "settings-switch-track pointer-events-none relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-gray-300 bg-gray-200 transition-colors peer-checked:border-emerald-500 peer-checked:bg-emerald-500 peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-primary-500";
  const switchThumbClass =
    "h-5 w-5 translate-x-1 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-6";
  const selectClass =
    "block h-11 w-full rounded-xl border border-gray-300 bg-white px-3 text-sm text-gray-900 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary-100";

  return (
    <div className="space-y-6">
      {saveError && (
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-4">
          <p className="text-sm font-semibold text-danger-700">
            Failed to save settings: {saveError}
          </p>
        </div>
      )}
      {saveSuccess && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 p-4"
        >
          <p className="text-sm font-semibold text-emerald-800">
            Settings saved
          </p>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title="Platform Settings"
          description="Control runtime gates, publishing defaults, and oracle polling."
          highlightLastWord
        />
        <Button
          onClick={handleSave}
          disabled={loading || saving || !config}
          isLoading={saving}
        >
          Save Configuration
        </Button>
      </div>

      {loading && (
        <div className="flex justify-center p-12">
          <Spinner />
        </div>
      )}

      {!loading && (loadError || !config) && (
        <div
          role="alert"
          aria-label="Platform settings could not be loaded"
          className="rounded-xl border border-danger-200 bg-danger-50 p-6"
        >
          <p className="text-sm font-semibold text-danger-700">
            Platform settings could not be loaded
          </p>
          <p className="mt-1 text-sm text-danger-700">
            {loadError || "Settings unavailable"}
          </p>
          <Button
            className="mt-4"
            variant="secondary"
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
        </div>
      )}

      {!loading && config && (
        <>
          <div
            aria-label="Platform settings summary"
            className="settings-summary-grid grid gap-3 lg:grid-cols-4"
          >
            {summaryItems.map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
              >
                <p className="text-xs font-semibold uppercase text-gray-500">
                  {item.label}
                </p>
                <p className="mt-2 text-2xl font-black text-gray-950">
                  {item.value}
                </p>
                <p className="mt-1 text-xs font-medium text-gray-500">
                  {item.helper}
                </p>
              </div>
            ))}
          </div>

          <div
            aria-label="Platform settings controls"
            className="settings-controls-grid grid gap-6 xl:grid-cols-2"
          >
            <Card variant="default">
              <CardHeader>
                <CardTitle>System Controls</CardTitle>
                <p className="mt-1 text-sm text-gray-500">
                  Keep high-impact switches explicit before changing production
                  behavior.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className={controlRowClass}>
                  <div className="min-w-0">
                    <label
                      htmlFor="maintenance-mode-toggle"
                      className="cursor-pointer font-semibold text-gray-950"
                    >
                      Maintenance Mode
                    </label>
                    <p className="mt-1 text-sm text-gray-500">
                      Suspend all non-admin traffic.
                    </p>
                  </div>
                  <label
                    htmlFor="maintenance-mode-toggle"
                    className="relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center"
                  >
                    <input
                      id="maintenance-mode-toggle"
                      aria-label="Maintenance Mode"
                      type="checkbox"
                      checked={config.maintenanceMode ?? false}
                      onChange={(e) =>
                        updateBoolean("maintenanceMode", e.target.checked)
                      }
                      className={switchInputClass}
                    />
                    <span className={switchTrackClass} aria-hidden="true">
                      <span className={switchThumbClass} />
                    </span>
                  </label>
                </div>
                <div className={controlRowClass}>
                  <div className="min-w-0">
                    <label
                      htmlFor="approval-gate-toggle"
                      className="cursor-pointer font-semibold text-gray-950"
                    >
                      MiniApp Approval Gate
                    </label>
                    <p className="mt-1 text-sm text-gray-500">
                      Require manual review for production publish.
                    </p>
                  </div>
                  <label
                    htmlFor="approval-gate-toggle"
                    className="relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center"
                  >
                    <input
                      id="approval-gate-toggle"
                      aria-label="MiniApp Approval Gate"
                      type="checkbox"
                      checked={config.approvalGateRequired ?? false}
                      onChange={(e) =>
                        updateBoolean("approvalGateRequired", e.target.checked)
                      }
                      className={switchInputClass}
                    />
                    <span className={switchTrackClass} aria-hidden="true">
                      <span className={switchThumbClass} />
                    </span>
                  </label>
                </div>
              </CardContent>
            </Card>

            <Card variant="default">
              <CardHeader>
                <CardTitle>Runtime Parameters</CardTitle>
                <p className="mt-1 text-sm text-gray-500">
                  Tune bundle guardrails, oracle refresh cadence, and log
                  verbosity.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Input
                  id="max-bundle-size"
                  label="Max MiniApp Bundle Size (MB)"
                  type="number"
                  value={config.maxMiniappSizeMb ?? ""}
                  className="h-11 px-3"
                  onChange={(e) =>
                    updateNumber("maxMiniappSizeMb", e.target.value)
                  }
                />
                <Input
                  id="pricefeed-interval"
                  label="PriceFeed Refresh Interval (ms)"
                  type="number"
                  value={config.pricefeedIntervalMs ?? ""}
                  className="h-11 px-3"
                  onChange={(e) =>
                    updateNumber("pricefeedIntervalMs", e.target.value)
                  }
                />
                <div>
                  <label
                    htmlFor="log-level"
                    className="mb-1 block text-sm font-medium text-gray-700"
                  >
                    Log Level
                  </label>
                  <select
                    id="log-level"
                    value={config.logLevel ?? "info"}
                    onChange={(e) => updateLogLevel(e.target.value)}
                    className={selectClass}
                  >
                    <option value="debug">Debug</option>
                    <option value="info">Info</option>
                    <option value="warn">Warn</option>
                    <option value="error">Error</option>
                  </select>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
