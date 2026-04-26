"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

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

  useEffect(() => {
    let active = true;
    fetch("/api/settings")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        return res.json();
      })
      .then((data) => {
        if (active) {
          setConfig(data);
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
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      alert("Settings saved successfully.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSaveError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading)
    return (
      <div className="flex justify-center p-12">
        <Spinner />
      </div>
    );

  if (loadError || !config) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-400 mb-4">
          {loadError || "Settings unavailable"}
        </p>
        <Button variant="secondary" onClick={() => window.location.reload()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {saveError && (
        <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
          <p className="text-sm text-red-400">Failed to save: {saveError}</p>
        </div>
      )}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Platform Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Global configuration and platform tuning
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save Configuration"}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card variant="glass">
          <CardHeader>
            <CardTitle>System Maintenance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-xl border-gray-200 dark:border-white/10 bg-white/5">
              <label
                htmlFor="maintenance-mode-toggle"
                className="cursor-pointer"
              >
                <div className="font-semibold text-white">Maintenance Mode</div>
                <div className="text-sm text-gray-400">
                  Suspend all non-admin traffic
                </div>
              </label>
              <input
                id="maintenance-mode-toggle"
                type="checkbox"
                checked={config.maintenanceMode ?? false}
                onChange={(e) =>
                  setConfig({ ...config, maintenanceMode: e.target.checked })
                }
                className="w-5 h-5 accent-neo"
              />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-xl border-gray-200 dark:border-white/10 bg-white/5">
              <label htmlFor="approval-gate-toggle" className="cursor-pointer">
                <div className="font-semibold text-white">
                  MiniApp Approval Gate
                </div>
                <div className="text-sm text-gray-400">
                  Require manual review for production publish
                </div>
              </label>
              <input
                id="approval-gate-toggle"
                type="checkbox"
                checked={config.approvalGateRequired ?? false}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    approvalGateRequired: e.target.checked,
                  })
                }
                className="w-5 h-5 accent-neo"
              />
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader>
            <CardTitle>Tuning Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label
                htmlFor="max-bundle-size"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                Max MiniApp Bundle Size (MB)
              </label>
              <input
                id="max-bundle-size"
                type="number"
                value={config.maxMiniappSizeMb ?? ""}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    maxMiniappSizeMb: parseInt(e.target.value),
                  })
                }
                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-neo focus:ring-1 focus:ring-neo"
              />
            </div>
            <div>
              <label
                htmlFor="pricefeed-interval"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                PriceFeed Refresh Interval (ms)
              </label>
              <input
                id="pricefeed-interval"
                type="number"
                value={config.pricefeedIntervalMs ?? ""}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    pricefeedIntervalMs: parseInt(e.target.value),
                  })
                }
                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-neo focus:ring-1 focus:ring-neo"
              />
            </div>
            <div>
              <label
                htmlFor="log-level"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                Log Level
              </label>
              <select
                id="log-level"
                value={config.logLevel ?? "info"}
                onChange={(e) =>
                  setConfig({ ...config, logLevel: e.target.value })
                }
                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-neo focus:ring-1 focus:ring-neo"
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
    </div>
  );
}
