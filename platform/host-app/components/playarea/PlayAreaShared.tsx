import React, { useEffect, useState } from "react";
import {
  ArrowRightLeft,
  ChevronDown,
  Radio,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

import type { MiniAppInfo, MiniAppLaunchContext } from "@/components/types";
import { getLaunchParam } from "@/lib/miniapp-launch-params";

export type PlayMetric = { label: string; value: string; accent?: boolean };
export type ActivityRow = {
  icon: string;
  primary: string;
  secondary?: string;
  amount?: string;
  accent?: boolean;
};
export type PlayActivity = {
  title: string;
  rows: ActivityRow[];
  emptyText?: string;
};

export type PlayAreaRegistryProps = {
  app: MiniAppInfo;
  stats: PlayMetric[];
  statsMap: Record<string, string>;
  activity: PlayActivity | null;
  loading: boolean;
  error: string | null;
  contractHash: string | null;
  network: "mainnet" | "testnet";
  launchContext?: MiniAppLaunchContext | null;
  onRefresh: () => void;
};

export type PlayAreaComponent = (props: PlayAreaRegistryProps) => JSX.Element;
export type NativePlayAreaKind = "custom" | "oracle" | "profiled";

export type PlayTone =
  | "emerald"
  | "violet"
  | "amber"
  | "rose"
  | "sky"
  | "slate";

export function getMetric(
  stats: Record<string, string>,
  label: string,
  fallback = "0",
) {
  return stats[label] || fallback;
}

export function buildEmbeddedDappUrl(
  app: MiniAppInfo,
  network: "mainnet" | "testnet",
  launchContext?: MiniAppLaunchContext | null,
) {
  const slug = app.app_id.replace(/^miniapp-/, "");
  const base =
    app.dapp_url ||
    (app.entry_url && app.entry_url.startsWith("/")
      ? app.entry_url
      : `/miniapps/${slug}/index.html`);
  const params = new URLSearchParams();
  params.set("network", network);
  params.set("source", "platform");
  if (launchContext?.operation)
    params.set("operation", launchContext.operation);
  if (launchContext?.tab) params.set("tab", launchContext.tab);
  for (const [key, value] of Object.entries(launchContext?.params || {})) {
    if (!params.has(key)) params.set(key, value);
  }
  const joiner = base.includes("?") ? "&" : "?";
  return `${base}${joiner}${params.toString()}`;
}

export function statsMapFromStats(stats: PlayMetric[]): Record<string, string> {
  return Object.fromEntries(stats.map((item) => [item.label, item.value]));
}

export function parseGas(value: string): number {
  const match = String(value || "").match(/[\d.]+/);
  return match ? Number(match[0]) : 0;
}

export function parseNumericMetric(value: string): number {
  const match = String(value || "").match(/-?\d+(\.\d+)?/);
  const parsed = match ? Number(match[0]) : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function formatGas(value: number) {
  if (!Number.isFinite(value)) return "0.00 GAS";
  return `${value.toFixed(value >= 10 ? 1 : 2)} GAS`;
}

export function useLaunchParamState(
  launchContext: MiniAppLaunchContext | null | undefined,
  keys: string | string[],
  fallback = "",
) {
  const initial = getLaunchParam(launchContext, keys, fallback);
  const [value, setValue] = useState(initial);

  useEffect(() => {
    setValue(initial);
  }, [initial, launchContext?.signature]);

  return [value, setValue] as const;
}

export function useLaunchChoiceState<T extends string>(
  launchContext: MiniAppLaunchContext | null | undefined,
  keys: string | string[],
  options: readonly T[],
  fallback: T,
) {
  const raw = getLaunchParam(launchContext, keys, fallback);
  const initial = options.includes(raw as T) ? (raw as T) : fallback;
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    setValue(initial);
  }, [initial, launchContext?.signature]);

  return [value, setValue] as const;
}

export function shortHash(value?: string | null) {
  if (!value) return "shared runtime";
  if (value.length <= 14) return value;
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

const TONE_STYLES: Record<
  PlayTone,
  {
    accent: string;
    soft: string;
    active: string;
    text: string;
    ring: string;
  }
> = {
  emerald: {
    accent: "bg-emerald-500",
    soft: "bg-emerald-50",
    active: "border-emerald-500 bg-emerald-50 text-emerald-950",
    text: "text-emerald-700",
    ring: "focus-visible:ring-emerald-400/40",
  },
  violet: {
    accent: "bg-violet-500",
    soft: "bg-violet-50",
    active: "border-violet-500 bg-violet-50 text-violet-950",
    text: "text-violet-700",
    ring: "focus-visible:ring-violet-400/40",
  },
  amber: {
    accent: "bg-amber-500",
    soft: "bg-amber-50",
    active: "border-amber-500 bg-amber-50 text-amber-950",
    text: "text-amber-700",
    ring: "focus-visible:ring-amber-400/40",
  },
  rose: {
    accent: "bg-rose-500",
    soft: "bg-rose-50",
    active: "border-rose-500 bg-rose-50 text-rose-950",
    text: "text-rose-700",
    ring: "focus-visible:ring-rose-400/40",
  },
  sky: {
    accent: "bg-sky-500",
    soft: "bg-sky-50",
    active: "border-sky-500 bg-sky-50 text-sky-950",
    text: "text-sky-700",
    ring: "focus-visible:ring-sky-400/40",
  },
  slate: {
    accent: "bg-slate-800",
    soft: "bg-slate-50",
    active: "border-slate-700 bg-slate-50 text-slate-950",
    text: "text-slate-700",
    ring: "focus-visible:ring-slate-400/40",
  },
};

export function toneStyle(tone: PlayTone = "emerald") {
  return TONE_STYLES[tone];
}

export function PlayShell({
  app,
  title,
  subtitle,
  tone = "emerald",
  children,
  side,
  footer,
}: {
  app: MiniAppInfo;
  title: string;
  subtitle: string;
  tone?: PlayTone;
  children: React.ReactNode;
  side?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const styles = toneStyle(tone);

  return (
    <div className="bg-white">
      <div className="hidden border-b border-gray-100 bg-white px-4 py-3 sm:block sm:px-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex min-w-0 flex-wrap items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${styles.accent}`} />
              <span className="truncate text-xs font-black uppercase tracking-wide text-gray-700">
                {app.name}
              </span>
              <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-gray-700">
                Native dApp
              </span>
            </div>
            <h2 className="m-0 text-base font-black tracking-tight text-gray-950 sm:text-lg">
              {title}
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-5 text-gray-600">
              {subtitle}
            </p>
          </div>
        </div>
      </div>
      <div className="p-3 sm:p-4">
        <div className="min-w-0 space-y-3">{children}</div>
        {side && (
          <div className="mt-3">
            <SecondaryInfo
              title="Activity and details"
              description="Recent events, raw readings, and diagnostic context are available when needed."
            >
              <div className="min-w-0 space-y-3">{side}</div>
            </SecondaryInfo>
          </div>
        )}
      </div>
      {footer && (
        <div className="border-t border-gray-100 bg-gray-50/80 px-4 py-2.5 sm:px-5">
          {footer}
        </div>
      )}
    </div>
  );
}

export function SecondaryInfo({
  title,
  description,
  meta,
  defaultOpen = false,
  children,
}: {
  title: string;
  description?: string;
  meta?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details
      className="group rounded-[18px] border border-gray-200 bg-gray-50/70 shadow-sm shadow-gray-950/5"
      open={defaultOpen}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-3 marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/30">
        <span className="min-w-0">
          <span className="block truncate text-sm font-black text-gray-900">
            {title}
          </span>
          {description && (
            <span className="mt-0.5 block text-xs leading-5 text-gray-700">
              {description}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {meta && (
            <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-gray-700">
              {meta}
            </span>
          )}
          <ChevronDown
            className="h-4 w-4 text-gray-600 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </span>
      </summary>
      <div className="border-t border-gray-200 px-3.5 py-3">{children}</div>
    </details>
  );
}

export function ChainStateStrip({
  loading,
  error,
  contractHash,
  network,
  onRefresh,
}: Pick<
  PlayAreaRegistryProps,
  "loading" | "error" | "contractHash" | "network" | "onRefresh"
>) {
  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-gray-700">
          <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 font-semibold">
            <Radio className="h-3.5 w-3.5 text-emerald-600" />
            {loading ? "Syncing" : error ? "Cached state" : "Live state"}
          </span>
          <span className="font-semibold uppercase text-gray-600">
            {network}
          </span>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 font-semibold text-gray-600 transition hover:bg-gray-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>
      <details
        className="group rounded-xl border border-gray-200 bg-white/70"
        data-testid="chain-technical-details"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-[11px] font-bold uppercase tracking-wide text-gray-700 marker:content-none">
          Technical chain details
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-gray-200 px-2.5 py-2">
          <span className="block truncate font-mono text-gray-600">
            Contract: {shortHash(contractHash)}
          </span>
          {error && (
            <span className="mt-1 block text-[11px] font-semibold text-amber-700">
              {error}
            </span>
          )}
        </div>
      </details>
    </div>
  );
}

export function MetricGrid({ stats }: { stats: PlayMetric[] }) {
  if (!stats.length) return null;
  return (
    <SecondaryInfo
      title="Additional metrics"
      description="Raw app counters and diagnostic readings."
      meta={`${stats.length} items`}
    >
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(120px,1fr))]">
        {stats.slice(0, 8).map((item) => (
          <div
            key={item.label}
            className="rounded-2xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm shadow-gray-950/5"
          >
            <p className="m-0 text-[10px] font-bold uppercase tracking-wide text-gray-600">
              {item.label}
            </p>
            <p
              className={`m-0 mt-1 truncate text-sm font-black sm:text-base ${item.accent ? "text-emerald-600" : "text-gray-950"}`}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </SecondaryInfo>
  );
}

export function ActivityPanel({ activity }: { activity: PlayActivity | null }) {
  return (
    <div className="rounded-[18px] border border-gray-200 bg-white p-3 shadow-sm shadow-gray-950/5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="m-0 text-sm font-bold text-gray-900">
          {activity?.title || "Recent activity"}
        </h3>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-700">
          {activity?.rows.length || 0} items
        </span>
      </div>
      {activity?.rows.length ? (
        <div className="space-y-2">
          {activity.rows.slice(0, 4).map((row, index) => (
            <div
              key={`${row.primary}:${index}`}
              className="rounded-2xl border border-gray-100 bg-gray-50 px-3 py-2"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="m-0 truncate text-sm font-semibold text-gray-900">
                    {row.primary}
                  </p>
                  {row.secondary && (
                    <p className="m-0 mt-0.5 truncate text-xs text-gray-700">
                      {row.secondary}
                    </p>
                  )}
                </div>
                {row.amount && (
                  <span className="shrink-0 text-xs font-bold text-emerald-700">
                    {row.amount}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="m-0 text-sm leading-6 text-gray-700">
          {activity?.emptyText ||
            "No live on-chain events are available for this miniapp yet."}
        </p>
      )}
    </div>
  );
}

export function ActionRow({
  label,
  detail,
  value,
  valueLabel,
  tone = "emerald",
  active,
  icon,
}: {
  label: string;
  detail?: string;
  value?: string;
  valueLabel?: string;
  tone?: PlayTone;
  active?: boolean;
  icon?: React.ReactNode;
}) {
  const styles = toneStyle(tone);
  const className = `group flex w-full flex-col items-stretch justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition sm:flex-row sm:items-center sm:gap-3 sm:rounded-2xl sm:py-3 ${
    active ? styles.active : "border-gray-200 bg-white text-gray-950"
  }`;
  const content = (
    <>
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <span
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg sm:h-9 sm:w-9 sm:rounded-xl ${active ? "bg-white/75" : styles.soft} ${styles.text}`}
          >
            {icon}
          </span>
        )}
        <span className="min-w-0">
          <span className="block break-words text-[13px] font-black sm:text-sm">
            {label}
          </span>
          {detail && (
            <span className="mt-0.5 block break-words text-[11px] font-semibold leading-4 text-gray-700 sm:text-xs sm:leading-5">
              {detail}
            </span>
          )}
        </span>
      </div>
      {(value || valueLabel) && (
        <span className="shrink-0 pl-12 text-left sm:pl-0 sm:text-right">
          {value && (
            <span className="block text-[13px] font-black tabular-nums text-gray-950 sm:text-sm">
              {value}
            </span>
          )}
          {valueLabel && (
            <span className="block text-[10px] font-black uppercase tracking-wide text-gray-600">
              {valueLabel}
            </span>
          )}
        </span>
      )}
    </>
  );

  return <div className={className}>{content}</div>;
}

export function ActionBoard({
  title,
  subtitle,
  rows,
  tone = "emerald",
}: {
  title: string;
  subtitle?: string;
  rows: Array<{
    label: string;
    detail?: string;
    value?: string;
    valueLabel?: string;
    active?: boolean;
    icon?: React.ReactNode;
  }>;
  tone?: PlayTone;
}) {
  const styles = toneStyle(tone);
  return (
    <section className="rounded-[16px] border border-gray-200 bg-white p-3 shadow-sm shadow-gray-950/5 sm:rounded-[20px] sm:p-3.5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 text-sm font-black text-gray-950">{title}</h3>
          {subtitle && (
            <p className="m-0 mt-1 text-xs leading-5 text-gray-700">
              {subtitle}
            </p>
          )}
        </div>
        <span className={`mt-1 h-2.5 w-2.5 rounded-full ${styles.accent}`} />
      </div>
      <div className="space-y-2">
        {rows.slice(0, 6).map((row) => (
          <ActionRow
            key={`${row.label}:${row.detail || row.value || ""}`}
            {...row}
            tone={tone}
          />
        ))}
      </div>
    </section>
  );
}

export function EmbeddedDappSurface({
  title,
  subtitle,
  url,
  tone = "emerald",
  frameTitle,
  testId,
  heightClass = "h-[620px]",
}: {
  title: string;
  subtitle: string;
  url: string;
  tone?: PlayTone;
  frameTitle: string;
  testId: string;
  heightClass?: string;
}) {
  const styles = toneStyle(tone);

  return (
    <section className="overflow-hidden rounded-[18px] border border-gray-200 bg-white shadow-sm shadow-gray-950/5">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 bg-gray-50/80 px-3.5 py-3">
        <div className="min-w-0">
          <div className="mb-1.5 flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${styles.accent}`} />
            <span className="text-[10px] font-black uppercase tracking-wide text-gray-700">
              Live dApp
            </span>
          </div>
          <h3 className="m-0 text-sm font-black text-gray-950">{title}</h3>
          <p className="m-0 mt-1 max-w-3xl text-xs leading-5 text-gray-600">
            {subtitle}
          </p>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className={`inline-flex shrink-0 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-black transition hover:bg-gray-50 ${styles.text}`}
        >
          Open full dApp
          <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      </div>
      <iframe
        title={frameTitle}
        src={url}
        data-testid={testId}
        className={`block ${heightClass} w-full border-0 bg-white`}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </section>
  );
}

export function ToolCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-w-0 space-y-3 rounded-lg border border-gray-200 bg-white/85 p-4">
      <h3 className="m-0 flex items-center gap-2 text-sm font-black text-gray-950">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-50 text-emerald-700">
          {icon}
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

export function PreviewStat({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white/80 px-3 py-2">
      <p className="m-0 text-[10px] font-bold uppercase tracking-wide text-gray-600">
        {label}
      </p>
      <p className="m-0 mt-1 break-words text-sm font-black text-gray-950">
        {value}
      </p>
    </div>
  );
}

export function BridgeStatusPanel() {
  const steps = ["Lock", "Relay", "Prove", "Release"];
  return (
    <div className="rounded-lg border border-sky-100 bg-white/85 p-4">
      <h3 className="m-0 text-sm font-black text-gray-950">Operation status</h3>
      <div className="mt-4 space-y-3">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center gap-3">
            <span
              className={`grid h-7 w-7 place-items-center rounded-full text-xs font-black ${index === 0 ? "bg-sky-600 text-white" : "bg-gray-100 text-gray-500"}`}
            >
              {index + 1}
            </span>
            <span className="text-sm font-semibold text-gray-700">{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OracleStatusPanel({
  mode,
  result,
}: {
  mode: string;
  result: string;
}) {
  return (
    <div className="rounded-lg border border-gray-200 bg-slate-950 p-4 text-white">
      <h3 className="m-0 flex items-center gap-2 text-sm font-black">
        <ShieldCheck className="h-4 w-4 text-neo" />
        Result verifier
      </h3>
      <p className="mt-2 text-xs leading-5 text-slate-300">
        Mode: <span className="font-bold text-white">{mode}</span>
      </p>
      <pre className="mt-3 max-h-56 overflow-auto rounded-lg bg-black/30 p-3 text-[11px] leading-5 text-emerald-200">
        {result}
      </pre>
    </div>
  );
}
