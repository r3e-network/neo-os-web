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
      footer={
        <ChainStateStrip
          loading={loading}
          error={error}
          contractHash={contractHash}
          network={network}
          onRefresh={onRefresh}
        />
      }
    >
      <div className="space-y-3">
        <EmbeddedDappSurface
          title="Live MiniApp workspace"
          subtitle="The center playarea loads the actual standalone MiniApp so users can complete the app-specific business flow instead of only reading a status summary."
          url={dappUrl}
          tone={profile.tone}
          frameTitle={`${app.name} dApp`}
          testId={`profiled-dapp-frame-${app.app_id}`}
        />
        <SecondaryInfo
          title="Activity and details"
          description="Workflow checklist, activity, metrics, and launch parameters stay available without replacing the real MiniApp surface."
          meta="secondary"
        >
          <div className="space-y-3">
            <ProfileMarketPanel
              profile={profile}
              values={values}
              network={network}
            />
            <ProfileWorkflowPanel profile={profile} />
            <ProfileModelPanel profile={profile} />
            <ProfileLaunchParamsPanel profile={profile} values={values} />
            <ActivityPanel activity={activity} />
            <MetricGrid stats={stats} />
          </div>
        </SecondaryInfo>
      </div>
    </PlayShell>
  );
}

function ProfileMarketPanel({
  profile,
  values,
  network,
}: {
  profile: PlayAreaProfile;
  values: Record<string, string>;
  network: "mainnet" | "testnet";
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
      <h3 className="m-0 flex items-center gap-2 text-sm font-black text-gray-950">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-gray-100 text-gray-700">
          {profile.icon}
        </span>
        Workflow
      </h3>
      <div className="mt-4 space-y-3">
        {profile.steps.map((step, index) => (
          <div key={step} className="flex items-center gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-100 text-xs font-black text-emerald-700">
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
      <h3 className="m-0 text-sm font-black text-gray-950">
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
            <p className="m-0 mt-1 break-words text-sm font-black text-gray-950">
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
      <h3 className="m-0 text-sm font-black text-gray-950">
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

  return (
    <PlayShell
      app={app}
      title={app.name}
      subtitle={app.description}
      tone="emerald"
      footer={
        <ChainStateStrip
          loading={loading}
          error={error}
          contractHash={contractHash}
          network={network}
          onRefresh={onRefresh}
        />
      }
    >
      <div className="space-y-3">
        <EmbeddedDappSurface
          title="Live MiniApp workspace"
          subtitle="This fallback still opens the real standalone MiniApp as the primary surface, with diagnostics kept below."
          url={dappUrl}
          tone="emerald"
          frameTitle={`${app.name} dApp`}
          testId={`generic-dapp-frame-${app.app_id}`}
        />
        <ActionBoard
          title="Primary task"
          subtitle="Use the live MiniApp above for the complete business flow; this row only summarizes the platform operation wiring."
          rows={buildGenericActionRows(app)}
          tone="emerald"
        />
        <SecondaryInfo
          title="Activity and details"
          description="Optional activity, raw metrics, and diagnostic context."
          meta="secondary"
        >
          <div className="space-y-3">
            <ActivityPanel activity={activity} />
            <MetricGrid stats={stats} />
          </div>
        </SecondaryInfo>
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
