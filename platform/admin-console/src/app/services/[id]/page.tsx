"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Gauge,
  Network,
  Save,
  ShieldCheck,
  TimerReset,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Spinner } from "@/components/ui/Spinner";
import {
  getAdminAuthHeaders,
  getAdminFetchOptions,
} from "@/lib/admin-client";
import { cn } from "@/lib/utils";

interface ServiceConfig {
  routing?: {
    enabled?: boolean;
    max_concurrent_requests?: number;
    timeout_ms?: number;
  };
  security?: {
    require_signature?: boolean;
    allowlist_only?: boolean;
  };
  [key: string]: unknown;
}

type IconComponent = typeof Network;

export default function ServiceConfigPage() {
  const params = useParams();
  const router = useRouter();
  const serviceId = resolveParam(params?.id);
  const [config, setConfig] = useState<ServiceConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadConfig() {
      setLoading(true);
      setLoadError(null);
      try {
        if (!serviceId) {
          throw new Error("Missing service id");
        }

        const response = await fetch(
          `/api/services/${encodeURIComponent(serviceId)}/config`,
          {
            ...getAdminFetchOptions(),
            headers: getAdminAuthHeaders(),
            signal: AbortSignal.timeout(15000),
          },
        );
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const data = (await response.json()) as ServiceConfig;
        if (active) {
          setConfig(data);
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Failed to load service configuration";
        console.warn("[services] failed to load service config:", message);
        if (active) {
          setLoadError(message);
          setConfig(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadConfig();
    return () => {
      active = false;
    };
  }, [serviceId]);

  const handleSave = async () => {
    if (!config || !serviceId) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const response = await fetch(
        `/api/services/${encodeURIComponent(serviceId)}/config`,
        {
          ...getAdminFetchOptions(),
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAdminAuthHeaders(),
          },
          body: JSON.stringify(config),
          signal: AbortSignal.timeout(15000),
        },
      );
      if (!response.ok) {
        throw new Error("Failed to save service configuration");
      }
      setSaveSuccess(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : String(error));
    } finally {
      setSaving(false);
    }
  };

  const updateRouting = (
    patch: Partial<NonNullable<ServiceConfig["routing"]>>,
  ) => {
    setConfig((current) => ({
      ...(current ?? {}),
      routing: {
        ...(current?.routing ?? {}),
        ...patch,
      },
    }));
    setSaveSuccess(false);
  };

  const updateSecurity = (
    patch: Partial<NonNullable<ServiceConfig["security"]>>,
  ) => {
    setConfig((current) => ({
      ...(current ?? {}),
      security: {
        ...(current?.security ?? {}),
        ...patch,
      },
    }));
    setSaveSuccess(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-80 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (loadError || !config) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-4">
        <Button
          className="w-fit"
          onClick={() => router.push("/services")}
          variant="ghost"
        >
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          Back
        </Button>
        <div
          aria-label="Service configuration could not be loaded"
          className="rounded-xl border border-warning-200 bg-warning-50 px-5 py-4"
          role="alert"
        >
          <p className="text-sm font-bold text-warning-800">
            Service configuration could not be loaded
          </p>
          <p className="mt-1 text-sm text-warning-700">
            {loadError || "Configuration unavailable"}
          </p>
        </div>
      </div>
    );
  }

  const securityGateCount = [
    config.security?.require_signature,
    config.security?.allowlist_only,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 gap-3">
          <Button
            aria-label="Back"
            className="shrink-0"
            onClick={() => router.push("/services")}
            variant="ghost"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Back</span>
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl font-black text-gray-950 sm:text-2xl">
              Service{" "}
              <span className="text-emerald-600">Configuration</span>
            </h1>
            <p className="mt-1 truncate font-mono text-sm text-gray-600">
              {serviceId}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          {saveSuccess && (
            <p
              className="rounded-full border border-success-200 bg-success-50 px-3 py-1 text-xs font-bold text-success-700"
              role="status"
            >
              Configuration saved
            </p>
          )}
          <Button disabled={saving} isLoading={saving} onClick={handleSave}>
            <Save className="mr-2 h-4 w-4" aria-hidden="true" />
            Save Configuration
          </Button>
        </div>
      </div>

      {saveError && (
        <div
          aria-label="Service configuration save failed"
          className="rounded-xl border border-danger-200 bg-danger-50 px-5 py-4"
          role="alert"
        >
          <p className="text-sm font-bold text-danger-800">
            Failed to save service configuration
          </p>
          <p className="mt-1 text-sm text-danger-700">{saveError}</p>
        </div>
      )}

      <section
        aria-label="Service configuration overview"
        className="service-config-overview grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <SummaryTile
          detail="Service identifier"
          icon={Network}
          label="Service ID"
          tone="info"
          value={serviceId}
        />
        <SummaryTile
          detail="Traffic routing state"
          icon={Gauge}
          label="Routing"
          tone={config.routing?.enabled ? "success" : "neutral"}
          value={config.routing?.enabled ? "Enabled" : "Disabled"}
        />
        <SummaryTile
          detail="Request timeout"
          icon={TimerReset}
          label="Timeout"
          tone="warning"
          value={`${formatNumber(config.routing?.timeout_ms)} ms`}
        />
        <SummaryTile
          detail="Active security controls"
          icon={ShieldCheck}
          label="Security Gates"
          tone={securityGateCount > 0 ? "success" : "neutral"}
          value={securityGateCount.toString()}
        />
      </section>

      <section
        aria-label="Service configuration controls"
        className="service-config-controls grid grid-cols-1 gap-6 xl:grid-cols-2"
      >
        <Card variant="default">
          <CardHeader>
            <CardTitle>Routing & Networking</CardTitle>
            <p className="mt-1 text-sm text-gray-600">
              Tune request admission, routing, and timeout behavior.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <SwitchRow
              checked={config.routing?.enabled ?? false}
              description="Allow the platform gateway to route traffic to this service."
              label="Enable Traffic Routing"
              onChange={(checked) => updateRouting({ enabled: checked })}
            />
            <Input
              className="h-11 px-3"
              id="routing-max-concurrent"
              inputMode="numeric"
              label="Max Concurrent Requests"
              min={0}
              onChange={(event) =>
                updateRouting({
                  max_concurrent_requests: parseNumber(event.target.value),
                })
              }
              type="number"
              value={config.routing?.max_concurrent_requests ?? ""}
            />
            <Input
              className="h-11 px-3"
              id="routing-timeout"
              inputMode="numeric"
              label="Timeout (ms)"
              min={0}
              onChange={(event) =>
                updateRouting({ timeout_ms: parseNumber(event.target.value) })
              }
              type="number"
              value={config.routing?.timeout_ms ?? ""}
            />
          </CardContent>
        </Card>

        <Card variant="default">
          <CardHeader>
            <CardTitle>Security & Compliance</CardTitle>
            <p className="mt-1 text-sm text-gray-600">
              Keep service calls bound to verified contracts and attestations.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <SwitchRow
              checked={config.security?.require_signature ?? false}
              description="Require Nitro attestation signature checks before execution."
              label="Require AWS Nitro Attestation Signature"
              onChange={(checked) =>
                updateSecurity({ require_signature: checked })
              }
            />
            <SwitchRow
              checked={config.security?.allowlist_only ?? false}
              description="Reject requests outside the approved contract allowlist."
              label="Enforce Contract Allowlist Only"
              onChange={(checked) => updateSecurity({ allowlist_only: checked })}
            />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

interface SummaryTileProps {
  detail: string;
  icon: IconComponent;
  label: string;
  tone: "success" | "warning" | "info" | "neutral";
  value: string;
}

function SummaryTile({
  detail,
  icon: Icon,
  label,
  tone,
  value,
}: SummaryTileProps) {
  return (
    <Card variant="default">
      <CardContent className="flex min-h-32 flex-col justify-between gap-5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
              {label}
            </p>
            <p className="mt-3 truncate text-2xl font-black leading-none text-gray-950">
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
        <p className="truncate text-sm font-medium text-gray-600">{detail}</p>
      </CardContent>
    </Card>
  );
}

interface SwitchRowProps {
  checked: boolean;
  description: string;
  label: string;
  onChange: (checked: boolean) => void;
}

function SwitchRow({ checked, description, label, onChange }: SwitchRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 transition hover:bg-white">
      <span className="min-w-0">
        <span className="block text-sm font-bold text-gray-900">{label}</span>
        <span className="mt-1 block text-sm text-gray-600">{description}</span>
      </span>
      <button
        aria-label={label}
        aria-checked={checked}
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40",
          checked
            ? "border-emerald-300 bg-emerald-500"
            : "border-gray-300 bg-gray-200",
        )}
        onClick={() => onChange(!checked)}
        role="switch"
        type="button"
      >
        <span
          className={cn(
            "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform",
            checked && "translate-x-5",
          )}
        />
      </button>
    </div>
  );
}

function resolveParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }
  return value ?? "";
}

function parseNumber(value: string) {
  if (value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function formatNumber(value: number | undefined) {
  return typeof value === "number" ? value.toLocaleString() : "Unset";
}

const summaryToneClasses = {
  success: "border-success-100 bg-success-50 text-success-700",
  warning: "border-warning-100 bg-warning-50 text-warning-700",
  info: "border-primary-100 bg-primary-50 text-primary-700",
  neutral: "border-gray-200 bg-gray-100 text-gray-700",
};
