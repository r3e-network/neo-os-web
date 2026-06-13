import { useEffect, useState } from "react";

import type { MiniAppInfo, MiniAppLaunchContext } from "@/components/types";
import { getLaunchParam } from "@/lib/miniapp-launch-params";
import { resolveMiniAppSlug } from "@/lib/miniapp-media";

export type PlayMetric = { label: string; value: string; accent?: boolean };

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
  const slug = resolveMiniAppSlug(app.app_id, app.dapp_url || app.entry_url);
  const base =
    app.dapp_url ||
    (app.entry_url && app.entry_url.startsWith("/")
      ? app.entry_url
      : `/miniapps/${slug}/index.html`);
  const params = new URLSearchParams();
  params.set("network", network);
  // "embed" tells the standalone dApp shell to render in minimal mode
  // (no internal sidebar/tabs/stats) since the platform iframe already
  // provides the surrounding chrome — see MiniAppRoot.standaloneDappMode.
  params.set("source", "embed");
  if (launchContext?.operation)
    params.set("operation", launchContext.operation);
  if (launchContext?.tab) params.set("tab", launchContext.tab);
  for (const [key, value] of Object.entries(launchContext?.params || {})) {
    if (!params.has(key)) params.set(key, value);
  }
  const joiner = base.includes("?") ? "&" : "?";
  return `${base}${joiner}${params.toString()}`;
}

export function networkFromEmbeddedUrl(
  url: string,
  fallback: "mainnet" | "testnet" = "testnet",
) {
  try {
    const parsed = new URL(url, "http://localhost");
    const raw = (parsed.searchParams.get("network") || "").toLowerCase();
    if (raw.includes("mainnet")) return "mainnet";
    if (raw.includes("testnet")) return "testnet";
  } catch {
    // Keep the explicit fallback.
  }
  return fallback;
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
    ring: "focus-visible:ring-neo/40",
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
