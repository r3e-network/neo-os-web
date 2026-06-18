import { useDeferredValue, useMemo, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Bell,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Info,
  QrCode,
  Search,
  ShieldCheck,
} from "lucide-react";
import type {
  MiniAppContentBlock,
  MiniAppInfo,
  MiniAppNotification,
} from "../..";
import type { OnChainActivity } from "../../types";
import type { MiniAppNavItem } from "../../../lib/miniapp-detail-helpers";
import type { ResolvedMiniAppContractDomain } from "../../../lib/miniapp-runtime";
import { buildMiniAppDetailHref } from "../../../lib/miniapp-routes";
import { DetailContentBlocks } from "./DetailContentBlocks";
import { MiniAppLogo } from "./MiniAppLogo";

const ONEGATE_QR_LOGO_SRC = "/brand/onegate-mark.svg";

export function OneGateLaunchCard({
  app,
  oneGateLaunchUrl,
  oneGateQrDataUrl,
  targetNetworkLabel,
}: {
  app: MiniAppInfo;
  oneGateLaunchUrl: string;
  oneGateQrDataUrl: string;
  targetNetworkLabel: string;
}) {
  return (
    <div
      className="mt-3 rounded-[16px] border border-gray-200 bg-gray-50/80 px-3 py-3 text-xs leading-5 text-gray-600"
      data-testid="onegate-launch-card"
    >
      <div className="mb-2 flex items-center gap-2 font-semibold text-gray-900">
        <QrCode className="h-4 w-4 text-emerald-600" aria-hidden="true" />
        OneGate QR
      </div>
      <div className="flex items-start gap-3">
        <div className="relative grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-xl border border-gray-200 bg-white p-1 shadow-sm shadow-gray-950/5">
          {oneGateQrDataUrl ? (
            <img
              src={oneGateQrDataUrl}
              alt={`${app.name} OneGate QR`}
              className="h-full w-full"
              loading="lazy"
              decoding="async"
              data-testid="onegate-launch-qr"
            />
          ) : (
            <QrCode className="h-8 w-8 text-gray-300" aria-hidden="true" />
          )}
          <img
            src={ONEGATE_QR_LOGO_SRC}
            alt="OneGate"
            className="pointer-events-none absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 rounded-full border border-gray-200 bg-white p-1.5 shadow-sm"
            loading="lazy"
            decoding="async"
            data-testid="onegate-qr-logo"
          />
        </div>
        <div className="min-w-0 text-xs leading-5 text-gray-600">
          <p className="m-0 font-semibold text-gray-700">
            {targetNetworkLabel}
          </p>
          <p className="m-0 break-words font-mono text-[11px]">{app.app_id}</p>
          <details className="mt-2">
            <summary className="cursor-pointer text-[11px] font-semibold text-emerald-700">
              Open link
            </summary>
            <a
              href={oneGateLaunchUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block break-all font-mono text-[11px] text-emerald-700 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
              data-testid="onegate-launch-url"
            >
              {oneGateLaunchUrl}
            </a>
          </details>
        </div>
      </div>
    </div>
  );
}

export function MiniAppStatusBoard({
  app,
  activities,
  activityConnected,
  activityError,
  activityLoading,
  contractDisplayValue,
  contractDomainBinding,
  contractDomainDisplayValue,
  liveNotifications,
  networkLabel,
  newsConnected,
  newsLoading,
  runtimeDisplayValue,
}: {
  app: MiniAppInfo;
  activities: OnChainActivity[];
  activityConnected: boolean;
  activityError: string | null;
  activityLoading: boolean;
  contractDisplayValue: string;
  contractDomainBinding: ResolvedMiniAppContractDomain | null;
  contractDomainDisplayValue: string | null;
  liveNotifications: MiniAppNotification[];
  networkLabel: string;
  newsConnected: boolean;
  newsLoading: boolean;
  runtimeDisplayValue: string;
}) {
  const recentActivities = activities.slice(0, 4);
  const recentNotifications = liveNotifications.slice(0, 3);
  const status = app.status || "active";

  return (
    <section
      className="overflow-hidden rounded-[24px] border border-gray-200 bg-white shadow-sm shadow-gray-950/5"
      aria-label="MiniApp status and updates"
      data-testid="miniapp-info"
    >
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1.15fr)_minmax(280px,0.85fr)]">
        <div className="min-w-0 p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            {app.detail_template?.hero?.eyebrow && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold uppercase text-emerald-700">
                {app.detail_template.hero.eyebrow}
              </span>
            )}
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase ${statusBadgeClass(status)}`}
            >
              {status}
            </span>
            <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-semibold uppercase text-gray-600">
              {app.category}
            </span>
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
              {networkLabel}
            </span>
          </div>

          <h2 className="mt-4 flex items-center gap-2 text-base font-bold text-gray-900">
            <Info className="h-4 w-4 text-emerald-600" aria-hidden="true" />
            What this MiniApp does
          </h2>
          <p className="mt-2 max-w-3xl break-words text-sm leading-6 text-gray-600">
            {app.description}
          </p>
          {app.detail_template?.hero?.disclaimer && (
            <p className="mt-2 break-words text-xs leading-5 text-gray-500">
              {app.detail_template.hero.disclaimer}
            </p>
          )}

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <InfoPill label="App ID" value={app.app_id} />
            <InfoPill label="Runtime" value={runtimeDisplayValue} />
            <InfoPill label="Contract" value={contractDisplayValue} />
            {contractDomainDisplayValue ? (
              <InfoPill
                label={`${contractDomainBinding ? formatContractDomainNetwork(contractDomainBinding.network) : ""} Domain`.trim()}
                value={contractDomainDisplayValue}
                testId="contract-domain-binding"
              />
            ) : (
              <InfoPill
                label="Domain"
                value="Not configured for this network"
              />
            )}
          </div>

          <div className="mt-4 flex items-start gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/80 px-3 py-2 text-xs leading-5 text-emerald-800">
            <ShieldCheck
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <p className="m-0">
              Events, notifications, and actions on this page are scoped to{" "}
              {networkLabel}. Testnet and mainnet records are queried
              separately.
            </p>
          </div>
        </div>

        <div className="border-t border-gray-100 bg-gray-50/70 p-4 sm:p-5 lg:border-l lg:border-t-0">
          <div className="flex items-center justify-between gap-3">
            <h2 className="m-0 flex items-center gap-2 text-sm font-bold text-gray-900">
              <Activity
                className="h-4 w-4 text-emerald-600"
                aria-hidden="true"
              />
              Activity and notices
            </h2>
            <span
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                activityConnected || newsConnected
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-gray-200 bg-white text-gray-500"
              }`}
            >
              {activityConnected || newsConnected ? "Live" : "Synced"}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {activityLoading && recentActivities.length === 0 ? (
              <StatusEmptyState label="Loading verified activity..." />
            ) : recentActivities.length > 0 ? (
              recentActivities.map((activity) => (
                <CompactActivityRow key={activity.id} activity={activity} />
              ))
            ) : (
              <StatusEmptyState label="No verified activity yet." />
            )}
            {activityError && (
              <p className="m-0 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">
                Activity feed is temporarily unavailable. The page remains
                usable.
              </p>
            )}
          </div>

          <div className="mt-5 border-t border-gray-200 pt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="m-0 flex items-center gap-2 text-xs font-bold uppercase text-gray-700">
                <Bell className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                Notices
              </h3>
              {newsLoading && (
                <span className="text-[11px] font-semibold text-gray-400">
                  Loading
                </span>
              )}
            </div>
            <div className="space-y-2">
              {recentNotifications.length > 0 ? (
                recentNotifications.map((notification) => (
                  <CompactNotificationRow
                    key={notification.id}
                    notification={notification}
                  />
                ))
              ) : (
                <StatusEmptyState label="No notices published for this MiniApp." />
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CompactActivityRow({ activity }: { activity: OnChainActivity }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-3 py-2.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 truncate text-sm font-semibold text-gray-900">
            {activity.title}
          </p>
          <p className="m-0 mt-1 truncate text-xs text-gray-500">
            {activity.description}
          </p>
        </div>
        <span className="shrink-0 text-[11px] text-gray-400">
          {formatRelativeTime(activity.timestamp)}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {activity.status && (
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${activityStatusClass(activity.status)}`}
          >
            {activity.status}
          </span>
        )}
        {activity.network && (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-500">
            {activity.network}
          </span>
        )}
        {activity.tx_hash && (
          <span className="truncate font-mono text-[11px] text-gray-500">
            {truncateMiddle(activity.tx_hash, 8, 6)}
          </span>
        )}
      </div>
    </div>
  );
}

function CompactNotificationRow({
  notification,
}: {
  notification: MiniAppNotification;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white px-3 py-2.5">
      <div className="flex items-start gap-2">
        <CheckCircle2
          className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="m-0 truncate text-sm font-semibold text-gray-900">
              {notification.title}
            </p>
            <span className="shrink-0 text-[11px] text-gray-400">
              {formatRelativeTime(notification.created_at)}
            </span>
          </div>
          <p className="m-0 mt-1 line-clamp-2 text-xs leading-5 text-gray-500">
            {notification.content}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase text-emerald-700">
              {notification.notification_type || "notice"}
            </span>
            {notification.network && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-gray-500">
                {notification.network}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusEmptyState({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-dashed border-gray-200 bg-white px-3 py-3 text-xs text-gray-500">
      <Clock3 className="h-4 w-4 text-gray-400" aria-hidden="true" />
      {label}
    </div>
  );
}

function formatPermission(key: string): string {
  return key
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function OverviewTab({
  app,
  blocks,
}: {
  app: MiniAppInfo;
  blocks: MiniAppContentBlock[];
}) {
  return (
    <div className="space-y-4">
      {blocks.length > 0 && <DetailContentBlocks blocks={blocks} />}

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <h3 className="mb-4 mt-0 text-sm font-semibold text-gray-900">
          Permissions
        </h3>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-2">
          {Object.entries(app.permissions).map(([key, value]) =>
            value ? (
              <div key={key} className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <span className="text-sm text-gray-700">
                  {formatPermission(key)}
                </span>
              </div>
            ) : null,
          )}
        </div>
      </div>

      {app.limits && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h3 className="mb-3 mt-0 text-sm font-semibold text-gray-900">
            Limits
          </h3>
          <ul className="list-none p-0 m-0">
            {app.limits.max_gas_per_tx && (
              <li className="border-b border-gray-200 py-2 text-sm text-gray-600">
                Max GAS per transaction: {app.limits.max_gas_per_tx}
              </li>
            )}
            {app.limits.daily_gas_cap_per_user && (
              <li className="border-b border-gray-200 py-2 text-sm text-gray-600">
                Daily GAS cap per user: {app.limits.daily_gas_cap_per_user}
              </li>
            )}
            {app.limits.governance_cap && (
              <li className="border-b border-gray-200 py-2 text-sm text-gray-600">
                Governance cap per user: {app.limits.governance_cap}
              </li>
            )}
          </ul>
        </div>
      )}

      {app.docs_url && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h3 className="mb-3 mt-0 text-sm font-semibold text-gray-900">
            Documentation
          </h3>
          <a
            href={app.docs_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg text-sm font-medium text-emerald-700 no-underline transition-colors hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            View Documentation
          </a>
        </div>
      )}
    </div>
  );
}

export function MiniAppListRail({
  currentAppId,
  miniapps,
}: {
  currentAppId: string;
  miniapps: MiniAppNavItem[];
}) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const categories = useMemo(
    () =>
      Array.from(new Set(miniapps.map((item) => item.category).filter(Boolean)))
        .sort()
        .slice(0, 6),
    [miniapps],
  );
  const filteredMiniapps = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    return miniapps.filter((item) => {
      const matchesCategory =
        categoryFilter === "all" || item.category === categoryFilter;
      if (!matchesCategory) return false;
      if (!normalizedQuery) return true;
      return (
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.app_id.toLowerCase().includes(normalizedQuery) ||
        item.category.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [categoryFilter, miniapps, deferredQuery]);
  const visibleMiniapps = filteredMiniapps.slice(0, 80);

  return (
    <aside
      className="hidden self-start rounded-lg border border-gray-200 bg-white p-3 shadow-sm xl:order-none xl:sticky xl:top-24 xl:block"
      aria-label="MiniApp list"
      data-testid="miniapp-list-rail"
    >
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="m-0 text-sm font-bold text-gray-900">MiniApps</h2>
          <p className="mt-1 text-xs text-gray-500">
            {filteredMiniapps.length} MiniApps
          </p>
        </div>
        <Link
          href="/miniapps"
          prefetch={false}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:border-neo/40 hover:text-neo focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
        >
          Browse
        </Link>
      </div>

      <label className="relative mb-3 block">
        <span className="sr-only">Search MiniApps</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          aria-hidden="true"
        />
        <input
          id="miniapp-detail-search"
          name="q"
          type="search"
          autoComplete="off"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search miniapps"
          className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-3 text-sm text-gray-900 outline-none transition focus:border-neo focus:bg-white focus:ring-2 focus:ring-neo/20"
        />
      </label>

      <div className="mb-3 flex gap-1 overflow-x-auto pb-1">
        {["all", ...categories].map((category) => {
          const active = categoryFilter === category;
          return (
            <button
              key={category}
              type="button"
              onClick={() => setCategoryFilter(category)}
              className={`shrink-0 cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 ${
                active
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : "border-gray-200 bg-white text-gray-700 hover:text-gray-900"
              }`}
            >
              {category}
            </button>
          );
        })}
      </div>

      <nav className="max-h-[calc(100vh-15rem)] space-y-1 overflow-y-auto pr-1">
        {visibleMiniapps.map((item) => {
          const selected = item.app_id === currentAppId;
          return (
            <Link
              key={item.app_id}
              href={buildMiniAppDetailHref(item.app_id)}
              prefetch={false}
              aria-current={selected ? "page" : undefined}
              className={`flex min-w-0 items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 ${
                selected
                  ? "border-neo/30 bg-neo/10 text-gray-900"
                  : "border-transparent text-gray-600 hover:border-gray-200 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <MiniAppLogo
                appId={item.app_id}
                category={item.category}
                entryUrl={item.entry_url}
                logoUrl={item.logo_url}
                manifest={null}
                size="sm"
                className="shrink-0"
                alt={item.name}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {item.name}
                </span>
                <span className="mt-0.5 block truncate text-[11px] capitalize text-gray-600">
                  {item.category}
                </span>
              </span>
            </Link>
          );
        })}
        {visibleMiniapps.length === 0 && (
          <p className="rounded-2xl border border-dashed border-gray-200 px-3 py-5 text-center text-xs text-gray-500">
            No MiniApps match this filter.
          </p>
        )}
      </nav>
    </aside>
  );
}

function statusBadgeClass(status: string): string {
  if (status === "active")
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (status === "beta") return "border-sky-200 bg-sky-50 text-sky-700";
  if (status === "disabled")
    return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-gray-200 bg-gray-50 text-gray-600";
}

function activityStatusClass(
  status: NonNullable<OnChainActivity["status"]>,
): string {
  if (status === "confirmed") return "bg-emerald-50 text-emerald-700";
  if (status === "failed") return "bg-red-50 text-red-700";
  return "bg-amber-50 text-amber-700";
}

function truncateMiddle(value: string, prefix = 8, suffix = 6): string {
  if (value.length <= prefix + suffix + 3) return value;
  return `${value.slice(0, prefix)}...${value.slice(-suffix)}`;
}

function formatRelativeTime(timestamp: string): string {
  const time = new Date(timestamp).getTime();
  if (!Number.isFinite(time)) return "recently";
  const diffSeconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${Math.floor(diffHours / 24)}d ago`;
}

export function formatContractDomainNetwork(network: string): string {
  return network === "neo-n3-mainnet" ? "Mainnet" : "Testnet";
}

export function formatContractDomainSource(source: string): string {
  if (source === "expected") return "expected";
  return "configured";
}

export function contractDomainBadgeClass(source: string): string {
  return source === "expected"
    ? "bg-amber-100 text-amber-700"
    : "bg-emerald-100 text-emerald-700";
}

function InfoPill({
  label,
  value,
  testId,
}: {
  label: string;
  value: string;
  testId?: string;
}) {
  return (
    <div
      className="min-w-0 rounded-2xl border border-gray-200 bg-gray-50/80 px-3 py-2.5"
      data-testid={testId}
    >
      <div className="text-[11px] font-semibold uppercase text-gray-700">
        {label}:
      </div>
      <div className="mt-1 break-all font-mono text-[12px] text-gray-700">
        {value}
      </div>
    </div>
  );
}
