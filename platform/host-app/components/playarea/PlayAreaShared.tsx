import React, { useEffect, useRef, useState } from "react";
import {
  ArrowRightLeft,
  ChevronDown,
  Radio,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";

import { useI18n } from "@/lib/i18n/react";
import type { MiniAppInfo, MiniAppLaunchContext } from "@/components/types";

// playArea.* translations with English fallbacks: renders localized copy under
// the provider and keeps default/test renders (no provider, t() echoes keys)
// on the English literals these components shipped with.
function usePlayAreaT() {
  const { t } = useI18n();
  return (key: string, fallback: string) => {
    const fullKey = `playArea.${key}`;
    const translated = t(fullKey, "host");
    return translated === fullKey ? fallback : translated;
  };
}
// Url/format/tone helpers were moved into ./shared-helpers; the
// security-critical wallet-bridge pieces were moved into ./bridge. Both are
// re-exported below so every existing importer + test keeps the same surface.
import {
  networkFromEmbeddedUrl,
  shortHash,
  toneStyle,
  type PlayMetric,
  type PlayTone,
} from "./shared-helpers";
import {
  useEmbeddedCredentialBridge,
  useEmbeddedStorageBridge,
  useEmbeddedWalletBridge,
} from "./bridge";

export {
  buildEmbeddedDappUrl,
  clampNumber,
  formatGas,
  getMetric,
  parseGas,
  parseNumericMetric,
  shortHash,
  statsMapFromStats,
  toneStyle,
  useLaunchChoiceState,
  useLaunchParamState,
} from "./shared-helpers";
export type { PlayMetric, PlayTone } from "./shared-helpers";

export {
  HOST_WALLET_BRIDGE_RESULT,
  HOST_WALLET_BRIDGE_ERROR,
  HOST_WALLET_BRIDGE_STATE,
  HOST_WALLET_BRIDGE_PROTOCOL_VERSION,
  HOST_WALLET_BRIDGE_COMPATIBLE_PROTOCOL_VERSIONS,
  isCompatibleBridgeProtocolVersion,
  buildEmbeddedWalletBridgeResultDetail,
  useEmbeddedWalletBridge,
} from "./bridge";
export type {
  EmbeddedWalletBridgeResultDetail,
  EmbeddedWalletBridgeErrorDetail,
} from "./bridge";

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

const EMBEDDED_DAPP_SETTLE_MS = 800;
// If the embedded dApp iframe never fires onLoad (network error, bad
// entry_url), surface a recovery state instead of spinning forever.
const EMBEDDED_DAPP_LOAD_TIMEOUT_MS = 15_000;
// Detail-page broadcast asking mounted playareas to re-read chain state now
// (e.g. right after a submitted transaction confirms) instead of waiting for
// the next 15s poll. ChainStateStrip subscribes and calls its onRefresh.
export const HOST_PLAYFIELD_REFRESH = "neo-miniapp-host:playfield-refresh";
const EMBEDDED_DAPP_RESIZE_MESSAGE = "neo-miniapp:resize";

export function PlayShell({
  app,
  title,
  subtitle,
  tone = "emerald",
  immersive = false,
  children,
  side,
  footer,
}: {
  app: MiniAppInfo;
  title: string;
  subtitle: string;
  tone?: PlayTone;
  immersive?: boolean;
  children: React.ReactNode;
  side?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const tp = usePlayAreaT();
  const styles = toneStyle(tone);

  void styles;
  return (
    <div className="focus-play-shell bg-white">
      {!immersive && (
        <div className="border-b border-gray-100 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">
                Focus workspace
              </p>
              <h2 className="m-0 truncate text-xl font-semibold tracking-normal text-gray-900 sm:text-2xl">
                {title}
              </h2>
              <p className="m-0 mt-1 max-w-3xl text-sm leading-6 text-gray-600">
                {subtitle}
              </p>
            </div>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
              {app.name}
            </span>
          </div>
        </div>
      )}
      <div className="p-0 sm:p-1">
        <div className="min-w-0">{children}</div>
        {side && (
          <div className="mt-3 px-2 sm:px-3">
            <SecondaryInfo
              title={tp("contextDiagnostics", "Context and diagnostics")}
              description={tp("contextDescription", "Receipts, raw readings, and technical context stay tucked away until needed.")}
            >
              <div className="min-w-0 space-y-3">{side}</div>
            </SecondaryInfo>
          </div>
        )}
      </div>
      {footer && (
        <div className="border-t border-gray-100 bg-gray-50/80 px-3 py-1.5 text-xs sm:px-4">
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
      className="group rounded-lg border border-gray-200/80 bg-white/60 shadow-sm shadow-gray-950/5"
      open={defaultOpen}
    >
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/30">
        <span className="min-w-0">
          <span className="block truncate text-xs font-semibold text-gray-800">
            {title}
          </span>
          {description && (
            <span className="mt-1 hidden text-xs leading-5 text-gray-600 group-open:block">
              {description}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {meta && (
            <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] font-medium text-gray-600">
              {meta}
            </span>
          )}
          <ChevronDown
            className="h-4 w-4 text-gray-600 transition-transform group-open:rotate-180"
            aria-hidden="true"
          />
        </span>
      </summary>
      <div className="border-t border-gray-200 px-3 py-3">{children}</div>
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
  // Let the detail page push an immediate chain re-read (e.g. once a submitted
  // transaction confirms) instead of waiting for the playfield's 15s poll.
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const tp = usePlayAreaT();
  useEffect(() => {
    const handleHostRefresh = () => onRefreshRef.current();
    window.addEventListener(HOST_PLAYFIELD_REFRESH, handleHostRefresh);
    return () =>
      window.removeEventListener(HOST_PLAYFIELD_REFRESH, handleHostRefresh);
  }, []);
  return (
    <div className="space-y-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2 text-gray-700">
          <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2.5 py-1 font-semibold">
            <Radio className="h-3.5 w-3.5 text-emerald-600" />
            {loading ? tp("syncing", "Syncing") : error ? tp("cachedState", "Cached state") : tp("liveState", "Live state")}
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
          {tp("refresh", "Refresh")}
        </button>
      </div>
      <details
        className="group rounded-xl border border-gray-200 bg-white/70"
        data-testid="chain-technical-details"
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2 text-[11px] font-bold uppercase tracking-wide text-gray-700 marker:content-none">
          {tp("technicalDetails", "Technical chain details")}
          <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-gray-200 px-2.5 py-2">
          <span className="block truncate font-mono text-gray-600">
            {tp("contractLabel", "Contract")}: {shortHash(contractHash)}
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
  const tp = usePlayAreaT();
  if (!stats.length) return null;
  return (
    <SecondaryInfo
      title={tp("additionalMetrics", "Additional metrics")}
      description={tp("metricsDescription", "Raw app counters and diagnostic readings.")}
      meta={`${stats.length} ${tp("itemsSuffix", "items")}`}
    >
      <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(120px,1fr))]">
        {stats.slice(0, 8).map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-sm shadow-gray-950/5"
          >
            <p className="m-0 text-[10px] font-bold uppercase tracking-wide text-gray-600">
              {item.label}
            </p>
            <p
              className={`m-0 mt-1 truncate text-sm font-semibold sm:text-base ${item.accent ? "text-emerald-600" : "text-gray-900"}`}
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
  const tp = usePlayAreaT();
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm shadow-gray-950/5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="m-0 text-sm font-bold text-gray-900">
          {activity?.title || tp("recentActivity", "Recent activity")}
        </h3>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-700">
          {activity?.rows.length || 0} {tp("itemsSuffix", "items")}
        </span>
      </div>
      {activity?.rows.length ? (
        <div className="space-y-2">
          {activity.rows.slice(0, 4).map((row, index) => (
            <div
              key={`${row.primary}:${index}`}
              className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2"
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
  const className = `group flex w-full flex-col items-stretch justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition sm:flex-row sm:items-center sm:gap-3 sm:py-3 ${
    active ? styles.active : "border-gray-200 bg-white text-gray-900"
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
          <span className="block break-words text-[13px] font-semibold sm:text-sm">
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
            <span className="block text-[13px] font-semibold tabular-nums text-gray-900 sm:text-sm">
              {value}
            </span>
          )}
          {valueLabel && (
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-gray-600">
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
    <section className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm shadow-gray-950/5 sm:p-3.5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="m-0 text-sm font-semibold text-gray-900">{title}</h3>
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
  // title/subtitle are intentionally accepted but no longer rendered as a
  // header block — the actual dApp iframe IS the focal content. A small
  // pop-out link still appears for users who want a full-window view.
  title,
  subtitle,
  url,
  tone = "emerald",
  frameTitle,
  testId,
  appId = testId.replace(/^native-dapp-frame-/, ""),
  network = networkFromEmbeddedUrl(url),
  // Default to a viewport-driven height with a sensible minimum so the
  // dApp's core UI fits above the fold on common screen sizes without
  // collapsing to nothing on short windows. The Polymarket-style compact
  // chrome (navbar 64px + sticky detail header ~48px + small footer ~32px
  // + outer padding ~28px ≈ 172px) leaves the rest for the dApp.
  heightClass = "min-h-[580px] h-[calc(100vh-172px)]",
}: {
  title: string;
  subtitle: string;
  url: string;
  tone?: PlayTone;
  frameTitle: string;
  testId: string;
  appId?: string;
  network?: "mainnet" | "testnet";
  heightClass?: string;
}) {
  void title;
  void subtitle;
  void tone;
  const tp = usePlayAreaT();
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [showLoading, setShowLoading] = useState(true);
  const [loadTimedOut, setLoadTimedOut] = useState(false);
  const [frameAttempt, setFrameAttempt] = useState(0);
  const [embeddedHeight, setEmbeddedHeight] = useState<number | null>(null);
  const loadingTitle = frameTitle.replace(/\s+dApp$/i, "");
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEmbeddedWalletBridge({ appId, iframeRef, network });
  useEmbeddedStorageBridge({ appId, iframeRef });
  // Audit fix C-4 follow-up: the first-party Automation Copilot receives the
  // host gateway credential over this appId-gated bridge instead of the
  // removed allow-same-origin storage read. No-op for every other miniapp.
  useEmbeddedCredentialBridge({ appId, iframeRef });

  useEffect(() => {
    setFrameLoaded(false);
    setShowLoading(true);
    setLoadTimedOut(false);
    setEmbeddedHeight(null);
  }, [url, frameAttempt]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const data = event.data as
        | { type?: unknown; height?: unknown }
        | null
        | undefined;
      if (!data || data.type !== EMBEDDED_DAPP_RESIZE_MESSAGE) return;
      const nextHeight = Number(data.height);
      if (!Number.isFinite(nextHeight) || nextHeight <= 0) return;
      setEmbeddedHeight(Math.max(420, Math.min(2600, Math.ceil(nextHeight))));
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  useEffect(() => {
    if (!frameLoaded) return undefined;
    const timeout = window.setTimeout(
      () => setShowLoading(false),
      EMBEDDED_DAPP_SETTLE_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [frameLoaded]);

  // Load-failure watchdog: if onLoad never fires, swap the branded spinner for
  // a recovery card with Retry and an always-reachable pop-out escape hatch.
  useEffect(() => {
    if (frameLoaded) return undefined;
    const timeout = window.setTimeout(
      () => setLoadTimedOut(true),
      EMBEDDED_DAPP_LOAD_TIMEOUT_MS,
    );
    return () => window.clearTimeout(timeout);
  }, [frameLoaded, url, frameAttempt]);

  const retryFrameLoad = () => setFrameAttempt((attempt) => attempt + 1);
  const showLoadFailure = showLoading && loadTimedOut && !frameLoaded;
  // Audit fix C-4: every miniapp iframe keeps the opaque-origin sandbox —
  // allow-same-origin combined with allow-scripts would let a compromised
  // bundle reach window.parent and the host's session storage. First-party
  // apps that need a host credential (e.g. Automation Copilot's gateway
  // client) must receive it through the host<->miniapp postMessage bridge,
  // never via same-origin storage access.

  return (
    <section className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm shadow-gray-950/5">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        aria-label={tp("openInNewWindow", "Open dApp in a new window")}
        title={tp("openInNewWindow", "Open in a new window")}
        className="m-2 mb-0 ml-auto flex h-8 w-8 items-center justify-center rounded-md border border-gray-200 bg-white/95 p-0 text-[11px] font-semibold text-gray-600 opacity-100 shadow-sm backdrop-blur transition hover:text-gray-900 focus:opacity-100 sm:absolute sm:right-2 sm:top-2 sm:z-10 sm:m-0 sm:inline-flex sm:h-auto sm:w-auto sm:gap-1 sm:px-2 sm:py-1 sm:opacity-0 sm:group-hover:opacity-100"
      >
        <ArrowRightLeft className="h-3 w-3" aria-hidden="true" />
        <span className="hidden sm:inline">{tp("newWindow", "New window")}</span>
      </a>
      {/* Miniapps run inside a sandbox with an opaque origin (audit fix C-4).
          First-party credential needs — the Automation Copilot's signed host
          gateway session — flow through the appId-gated credential bridge. */}
      <iframe
        key={`${url}#${frameAttempt}`}
        ref={iframeRef}
        title={frameTitle}
        src={url}
        data-testid={testId}
        data-wallet-bridge="neo-miniapp-host"
        className={`block ${heightClass} w-full border-0 bg-white transition-opacity duration-300 ${showLoading ? "opacity-0" : "opacity-100"}`}
        style={embeddedHeight ? { height: `${embeddedHeight}px` } : undefined}
        loading="eager"
        onLoad={() => setFrameLoaded(true)}
        referrerPolicy="no-referrer-when-downgrade"
        /* The sandbox intentionally creates an opaque origin. A wildcard
           container policy is therefore required for the trusted goose game's
           opt-in motion gesture; named/src origins cannot match opaque origins.
           Other MiniApps receive no sensor delegation. */
        allow={appId === "miniapp-zhuada-e" ? "accelerometer *; gyroscope *" : undefined}
        /* Every MiniApp keeps the opaque origin — no app is granted
           allow-same-origin (audit fix C-4). Automation Copilot's signed-in
           host session is delivered by useEmbeddedCredentialBridge, keyed to
           its canonical app id and never inherited by profiles or catalog
           apps. */
        sandbox="allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
      />
      {showLoadFailure ? (
        <div
          className="absolute inset-0 grid place-items-center bg-[#faf9f7] px-6 text-center"
          data-testid={`${testId}-load-error`}
          aria-live="polite"
        >
          <div className="w-full max-w-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-white shadow-md shadow-gray-950/10 ring-1 ring-gray-200">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-amber-500 text-white shadow-inner">
                <Radio className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>
            <p className="m-0 mt-5 text-base font-semibold text-gray-900">
              Still loading {loadingTitle}…
            </p>
            <p className="m-0 mt-2 text-sm leading-6 text-gray-600">
              The embedded MiniApp has not responded yet. Retry, or open it in
              a new window.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={retryFrameLoad}
                className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md border border-emerald-700 bg-emerald-700 px-3.5 py-1.5 text-sm font-bold text-white transition hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
                data-testid={`${testId}-retry`}
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                Retry
              </button>
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3.5 py-1.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
              >
                <ArrowRightLeft className="h-3.5 w-3.5" aria-hidden="true" />
                Open in new window
              </a>
            </div>
          </div>
        </div>
      ) : showLoading ? (
        <div
          className="absolute inset-0 grid place-items-center bg-[#faf9f7] px-6 text-center"
          data-testid={`${testId}-loading`}
          aria-live="polite"
        >
          <div className="w-full max-w-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-xl bg-white shadow-md shadow-gray-950/10 ring-1 ring-gray-200">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gray-950 text-white shadow-inner">
                <Radio className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>
            <p className="m-0 mt-5 text-base font-semibold text-gray-900">
              Loading {loadingTitle}
            </p>
            <div
              className="mx-auto mt-4 grid h-2 max-w-44 grid-cols-3 gap-1.5"
              aria-hidden="true"
            >
              <span className="rounded-full bg-emerald-400" />
              <span className="rounded-full bg-sky-400" />
              <span className="rounded-full bg-orange-300" />
            </div>
          </div>
        </div>
      ) : null}
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
      <h3 className="m-0 flex items-center gap-2 text-sm font-semibold text-gray-900">
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
      <p className="m-0 mt-1 break-words text-sm font-semibold text-gray-900">
        {value}
      </p>
    </div>
  );
}

export function BridgeStatusPanel() {
  const steps = ["Lock", "Relay", "Prove", "Release"];
  return (
    <div className="rounded-lg border border-sky-100 bg-white/85 p-4">
      <h3 className="m-0 text-sm font-semibold text-gray-900">Operation status</h3>
      <div className="mt-4 space-y-3">
        {steps.map((step, index) => (
          <div key={step} className="flex items-center gap-3">
            <span
              className={`grid h-7 w-7 place-items-center rounded-full text-xs font-semibold ${index === 0 ? "bg-sky-600 text-white" : "bg-gray-100 text-gray-500"}`}
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
  const tp = usePlayAreaT();
  return (
    <div className="rounded-lg border border-gray-200 bg-slate-950 p-4 text-white">
      <h3 className="m-0 flex items-center gap-2 text-sm font-semibold">
        <ShieldCheck className="h-4 w-4 text-neo" />
        {tp("resultVerifier", "Result verifier")}
      </h3>
      <p className="mt-2 text-xs leading-5 text-slate-300">
        {tp("modeLabel", "Mode")}: <span className="font-bold text-white">{mode}</span>
      </p>
      <pre className="mt-3 max-h-56 overflow-auto rounded-lg bg-black/30 p-3 text-[11px] leading-5 text-emerald-200">
        {result}
      </pre>
    </div>
  );
}
