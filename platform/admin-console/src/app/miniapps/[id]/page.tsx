"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";

interface MiniAppConfig {
  permissions: Record<string, boolean | number>;
  tokens?: {
    allowed_assets?: string[];
    withdrawal_limit_24h?: number;
  };
  actions: Record<string, boolean>;
  [key: string]: unknown;
}

export default function MiniAppConfigPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = use(props.params);
  const router = useRouter();
  const [config, setConfig] = useState<MiniAppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/miniapps/${params.id}/config`)
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
  }, [params.id]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/miniapps/${params.id}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error("Failed to save miniapp configuration");
      alert("Configuration saved successfully.");
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
          {loadError || "Configuration unavailable"}
        </p>
        <Button variant="ghost" onClick={() => router.push("/miniapps")}>
          &larr; Back
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
      <div className="flex items-center gap-4 mb-8">
        <Button variant="ghost" onClick={() => router.push("/miniapps")}>
          &larr; Back
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            MiniApp Configuration
          </h1>
          <p className="text-gray-600 dark:text-gray-400 font-mono text-sm">
            {params.id}
          </p>
        </div>
        <div className="ml-auto">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save Configuration"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card variant="glass">
          <CardHeader>
            <CardTitle>TEE Permissions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(config.permissions).map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between p-4 border rounded-xl border-white/10 bg-white/5"
              >
                <label
                  id={`perm-${key}-label`}
                  htmlFor={`perm-${key}-checkbox`}
                  className="font-semibold text-white capitalize cursor-pointer"
                >
                  {key.replace(/_/g, " ")}
                </label>
                {typeof value === "boolean" ? (
                  <input
                    id={`perm-${key}-checkbox`}
                    type="checkbox"
                    aria-labelledby={`perm-${key}-label`}
                    checked={value}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        permissions: {
                          ...config.permissions,
                          [key]: e.target.checked,
                        },
                      })
                    }
                    className="w-5 h-5 accent-neo"
                  />
                ) : (
                  <input
                    id={`perm-${key}-number`}
                    type="number"
                    aria-label={`${key.replace(/_/g, " ")} value`}
                    value={value as number}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        permissions: {
                          ...config.permissions,
                          [key]: parseFloat(e.target.value),
                        },
                      })
                    }
                    className="w-24 bg-black/20 border border-white/10 rounded-lg px-3 py-1 text-white text-right"
                  />
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader>
            <CardTitle>Tokens & Assets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label
                htmlFor="allowed-assets"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                Allowed Assets (Comma separated)
              </label>
              <input
                id="allowed-assets"
                type="text"
                value={(config.tokens?.allowed_assets ?? []).join(", ")}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    tokens: {
                      ...config.tokens,
                      allowed_assets: e.target.value
                        .split(",")
                        .map((s) => s.trim()),
                    },
                  })
                }
                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white"
              />
            </div>
            <div>
              <label
                htmlFor="withdrawal-limit"
                className="block text-sm font-medium text-gray-300 mb-1"
              >
                24H Withdrawal Limit
              </label>
              <input
                id="withdrawal-limit"
                type="number"
                value={config.tokens?.withdrawal_limit_24h ?? ""}
                onChange={(e) =>
                  setConfig({
                    ...config,
                    tokens: {
                      ...config.tokens,
                      withdrawal_limit_24h: parseFloat(e.target.value),
                    },
                  })
                }
                className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white"
              />
            </div>
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardHeader>
            <CardTitle>Lifecycle Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {Object.entries(config.actions).map(([key, value]) => (
              <div
                key={key}
                className="flex items-center justify-between p-4 border rounded-xl border-red-500/20 bg-red-500/5"
              >
                <label
                  id={`action-${key}-label`}
                  htmlFor={`action-${key}-checkbox`}
                  className="font-semibold text-white capitalize cursor-pointer"
                >
                  {key.replace(/_/g, " ")}
                </label>
                <input
                  id={`action-${key}-checkbox`}
                  type="checkbox"
                  aria-labelledby={`action-${key}-label`}
                  checked={value as boolean}
                  onChange={(e) =>
                    setConfig({
                      ...config,
                      actions: { ...config.actions, [key]: e.target.checked },
                    })
                  }
                  className="w-5 h-5 accent-red-500"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
