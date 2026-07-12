import React, { useCallback, useEffect, useState } from "react";
import { Workflow } from "lucide-react";

import type { MiniAppInfo } from "@/components/types";
import { getLaunchParam } from "@/lib/miniapp-launch-params";

import {
  ActionBoard,
  ActivityPanel,
  ChainStateStrip,
  EmbeddedDappSurface,
  MetricGrid,
  PlayShell,
  PreviewStat,
  SecondaryInfo,
  buildEmbeddedDappUrl,
} from "./PlayAreaShared";
import { PROFILED_PLAYAREAS, type PlayAreaProfile } from "./PlayAreaProfiles";
import type { PlayAreaRegistryProps } from "./PlayAreaShared";

type MetadataRecord = Record<string, unknown>;

function asMetadataRecord(value: unknown): MetadataRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as MetadataRecord;
}

function hasMeaningfulMetadata(value: unknown): boolean {
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.some(hasMeaningfulMetadata);
  return Object.values(asMetadataRecord(value)).some(hasMeaningfulMetadata);
}

function hasRuntimeContractBinding(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasRuntimeContractBinding);
  const record = asMetadataRecord(value);
  return Object.entries(record).some(([key, entry]) => {
    const normalizedKey = key.toLowerCase().replace(/[-_]/g, "");
    if (
      (normalizedKey === "contracthash" || normalizedKey === "scripthash")
      && typeof entry === "string"
      && entry.trim()
    ) {
      return true;
    }
    return hasRuntimeContractBinding(entry);
  });
}

function hasDeclaredOperations(
  app: MiniAppInfo,
  manifest: MetadataRecord,
): boolean {
  const operationPanel = asMetadataRecord(manifest.operation_panel);
  const detailOperationPanel = asMetadataRecord(
    app.detail_template?.operation_panel,
  );
  return [
    app.operations,
    app.detail_template?.operation_panel?.operations,
    manifest.operations,
    operationPanel.operations,
    detailOperationPanel.operations,
  ].some(hasMeaningfulMetadata);
}

function hasDeclaredPermissions(
  app: MiniAppInfo,
  manifest: MetadataRecord,
): boolean {
  const hasInteractivePermission = (
    value: unknown,
    permissionKey = "",
  ): boolean => {
    const normalizedKey = permissionKey.trim().toLowerCase();
    const isReadOnlyKey = normalizedKey.startsWith("read")
      || normalizedKey.startsWith("view");
    if (typeof value === "boolean") return value && !isReadOnlyKey;
    if (typeof value === "number") {
      return Number.isFinite(value) && value !== 0 && !isReadOnlyKey;
    }
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (!normalized) return false;
      return !normalized.startsWith("read:")
        && !normalized.startsWith("view:")
        && normalized !== "read"
        && normalized !== "view";
    }
    if (Array.isArray(value)) {
      return value.some((entry) => hasInteractivePermission(entry));
    }
    return Object.entries(asMetadataRecord(value)).some(([key, entry]) =>
      hasInteractivePermission(entry, key),
    );
  };

  return hasInteractivePermission(app.permissions)
    || hasInteractivePermission(manifest.permissions);
}

/**
 * Defaults to chain-relevant unless metadata explicitly proves a local-only
 * runtime. This keeps incomplete and transactional manifests on the existing
 * diagnostics/operation path while allowing complete guest games to stay
 * focused on their real embedded surface. A historical deployment hash alone
 * does not make a transactions=false release chain-interactive.
 */
export function isChainRelevant(app: MiniAppInfo): boolean {
  const manifest = asMetadataRecord(app.manifest);
  const platform = asMetadataRecord(manifest.platform);
  const hasRuntimeBinding = hasRuntimeContractBinding(manifest.runtime)
    || hasRuntimeContractBinding(manifest.deployment);
  const explicitlyLocal = platform.transactions === false
    && !hasRuntimeBinding
    && !hasDeclaredOperations(app, manifest)
    && !hasDeclaredPermissions(app, manifest);

  return !explicitlyLocal;
}

export function ProfiledPlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    stats,
    activity,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
  } = props;
  const profile = PROFILED_PLAYAREAS[app.app_id];
  const dappUrl = buildEmbeddedDappUrl(app, network, launchContext);
  const chainRelevant = isChainRelevant(app);
  const embeddedOwnsWorkflow = app.app_id === "miniapp-automation-copilot";
  const initialValues = useCallback(
    () =>
      Object.fromEntries(
        profile.fields.map((field) => [
          field.key,
          getLaunchParam(launchContext, field.key, ""),
        ]),
      ) as Record<string, string>,
    [launchContext, profile],
  );
  const [values, setValues] = useState<Record<string, string>>(initialValues);

  useEffect(() => {
    setValues(initialValues());
  }, [initialValues]);

  return (
    <PlayShell
      app={app}
      title={profile.title}
      subtitle={profile.subtitle}
      tone={profile.tone}
      immersive
      footer={chainRelevant ? (
        <ChainStateStrip
          loading={loading}
          error={error}
          contractHash={contractHash}
          network={network}
          onRefresh={onRefresh}
        />
      ) : undefined}
    >
      <div className="space-y-3">
        <EmbeddedDappSurface
          title={chainRelevant ? "Live MiniApp workspace" : "Play locally"}
          subtitle={
            chainRelevant
              ? "The center playarea loads the actual standalone MiniApp so users can complete the app-specific business flow instead of only reading a status summary."
              : "The complete guest experience runs inside the MiniApp below without wallet, contract, or transaction setup."
          }
          url={dappUrl}
          tone={profile.tone}
          frameTitle={`${app.name} dApp`}
          testId={`profiled-dapp-frame-${app.app_id}`}
          appId={app.app_id}
          network={network}
          heightClass={profile.embeddedHeightClass}
        />
        {chainRelevant && !embeddedOwnsWorkflow && (
          <SecondaryInfo
            title="Activity and details"
            description="Workflow checklist, activity, metrics, and launch parameters stay available without replacing the real MiniApp surface."
            meta="secondary"
          >
            <div className="space-y-3">
              <ProfileMarketPanel
                profile={profile}
                values={values}
              />
              <ProfileWorkflowPanel profile={profile} />
              <ProfileModelPanel profile={profile} />
              <ProfileLaunchParamsPanel profile={profile} values={values} />
              <ActivityPanel activity={activity} />
              <MetricGrid stats={stats} />
            </div>
          </SecondaryInfo>
        )}
      </div>
    </PlayShell>
  );
}

function ProfileMarketPanel({
  profile,
  values,
}: {
  profile: PlayAreaProfile;
  values: Record<string, string>;
}) {
  const launchValues = profile.fields
    .map((field) => values[field.key]?.trim())
    .filter(Boolean);
  const primaryInput = launchValues[0];
  const rows = [
    {
      label: profile.primaryAction,
      detail:
        profile.steps[0] ||
        "Use the right operation panel to prepare and submit this action.",
      value: primaryInput || "Operation panel",
      valueLabel: primaryInput ? "from URL" : "primary",
      active: true,
      icon: profile.icon,
    },
    ...profile.steps.slice(1, 4).map((step, index) => ({
      label: step,
      detail: launchValues[index + 1]
        ? profile.fields[index + 1]?.label
        : undefined,
      value: launchValues[index + 1] || undefined,
      valueLabel: launchValues[index + 1] ? "from URL" : undefined,
    })),
  ];

  return (
    <ActionBoard
      title={profile.visual.headline}
      subtitle={profile.visual.footnote || profile.subtitle}
      rows={rows}
      tone={profile.tone}
    />
  );
}

function ProfileWorkflowPanel({ profile }: { profile: PlayAreaProfile }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white/85 p-4">
      <h3 className="m-0 flex items-center gap-2 text-sm font-semibold text-gray-900">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gray-100 text-gray-700">
          {profile.icon}
        </span>
        Workflow
      </h3>
      <div className="mt-4 space-y-3">
        {profile.steps.map((step, index) => (
          <div key={step} className="flex items-center gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-semibold text-emerald-700">
              {index + 1}
            </span>
            <span className="text-sm font-semibold text-gray-700">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfileModelPanel({ profile }: { profile: PlayAreaProfile }) {
  if (profile.cards.length === 0) return null;
  return (
    <div className="rounded-lg border border-gray-200 bg-white/85 p-4">
      <h3 className="m-0 text-sm font-semibold text-gray-900">
        What this MiniApp controls
      </h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {profile.cards.slice(0, 6).map((card) => (
          <div
            key={`${card.label}:${card.value}`}
            className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2"
          >
            <p className="m-0 text-[10px] font-bold uppercase tracking-wide text-gray-500">
              {card.label}
            </p>
            <p className="m-0 mt-1 break-words text-sm font-semibold text-gray-900">
              {card.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProfileLaunchParamsPanel({
  profile,
  values,
}: {
  profile: PlayAreaProfile;
  values: Record<string, string>;
}) {
  const rows = profile.fields
    .map((field) => ({
      label: field.label,
      value: values[field.key]?.trim(),
    }))
    .filter((row): row is { label: string; value: string } =>
      Boolean(row.value),
    );

  if (rows.length === 0) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white/85 p-4">
      <h3 className="m-0 text-sm font-semibold text-gray-900">
        URL launch parameters
      </h3>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <PreviewStat key={row.label} label={row.label} value={row.value} />
        ))}
      </div>
    </div>
  );
}

export function GenericPlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    stats,
    activity,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
  } = props;
  const dappUrl = buildEmbeddedDappUrl(app, network, launchContext);
  const chainRelevant = isChainRelevant(app);

  return (
    <PlayShell
      app={app}
      title={app.name}
      subtitle={app.description}
      tone="emerald"
      immersive
      footer={chainRelevant ? (
        <ChainStateStrip
          loading={loading}
          error={error}
          contractHash={contractHash}
          network={network}
          onRefresh={onRefresh}
        />
      ) : undefined}
    >
      <div className="space-y-3">
        <EmbeddedDappSurface
          title={
            chainRelevant ? "Live MiniApp workspace" : "Open local MiniApp"
          }
          subtitle={
            chainRelevant
              ? "This fallback still opens the real standalone MiniApp as the primary surface, with diagnostics kept below."
              : "This guest-only MiniApp runs locally without wallet, contract, or transaction setup."
          }
          url={dappUrl}
          tone="emerald"
          frameTitle={`${app.name} dApp`}
          testId={`generic-dapp-frame-${app.app_id}`}
          appId={app.app_id}
          network={network}
        />
        {chainRelevant && (
          <SecondaryInfo
            title="Activity and details"
            description="Optional activity, raw metrics, and diagnostic context."
            meta="secondary"
          >
            <div className="space-y-3">
              <ActionBoard
                title="Primary task"
                subtitle="Use the live MiniApp above for the complete business flow; this row only summarizes the platform operation wiring."
                rows={buildGenericActionRows(app)}
                tone="emerald"
              />
              <ActivityPanel activity={activity} />
              <MetricGrid stats={stats} />
            </div>
          </SecondaryInfo>
        )}
      </div>
    </PlayShell>
  );
}

function buildGenericActionRows(app: MiniAppInfo) {
  const primaryOperation =
    app.operations?.find((operation) => operation.priority === "primary") ||
    app.operations?.[0];
  const permissionEntries = Object.entries(app.permissions || {})
    .filter(([, enabled]) => Boolean(enabled))
    .map(([permission]) => permission.replace(/_/g, " "));

  return [
    {
      label: primaryOperation?.name || "Open MiniApp operation",
      detail:
        primaryOperation?.description ||
        "Prepare the primary user action in the right operation panel.",
      active: true,
      icon: <Workflow className="h-4 w-4" />,
    },
    {
      label: "Main capability",
      detail: permissionEntries[0] || app.category,
      value: app.category,
      valueLabel: "category",
    },
    {
      label: "Network scope",
      detail: "Mainnet and testnet state are read separately.",
      value: app.status || "listed",
      valueLabel: "catalog",
    },
  ];
}
