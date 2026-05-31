import Head from "next/head";
import type { GetStaticProps } from "next";
import {
  useDeferredValue,
  useState,
  useEffect,
  useRef,
  useMemo,
} from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  ArrowUpRight,
  Boxes,
  Radio,
  Search,
  Sparkles,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { Layout } from "@/components/layout";
import { MiniAppLogo } from "@/components/features/miniapp/MiniAppLogo";
import type { MiniAppInfo } from "@/components/types";
import { loadMiniAppDefinitions } from "@/lib/miniapp-definitions";
import {
  compactMiniAppManifestForCatalog,
  getMiniAppCatalogAvailability,
} from "@/lib/miniapp-catalog-view";
import {
  getAvailabilityLabel,
  getCategoryLabel,
  getLocalizedMiniAppCategoryLabel,
  getLocalizedMiniAppDescription,
  getLocalizedMiniAppName,
  getNetworkLabel,
} from "@/lib/i18n/miniapp-display";
import { interpolate, type Locale } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/react";
import { sortMiniApps } from "@/lib/miniapp-showcase";
import { getRpcNetwork } from "@/lib/rpc-helpers";
import { BRAND } from "@/lib/brand";

/* ── Color accents per flagship ──────────────────────────────────────── */

const flagshipAccents: Record<string, { gradient: string; text: string }> = {
  "miniapp-last-survivor": {
    gradient: "from-red-500 to-rose-600",
    text: "text-red-600",
  },
  "miniapp-fogplay": {
    gradient: "from-indigo-500 to-purple-600",
    text: "text-indigo-600",
  },
  "miniapp-gasbox": {
    gradient: "from-amber-400 to-orange-500",
    text: "text-amber-600",
  },
  "miniapp-redenvelope": {
    gradient: "from-red-400 to-pink-500",
    text: "text-red-500",
  },
  "miniapp-dailycheckin": {
    gradient: "from-emerald-400 to-teal-500",
    text: "text-emerald-600",
  },
  "miniapp-self-loan": {
    gradient: "from-blue-500 to-cyan-500",
    text: "text-blue-600",
  },
  "miniapp-profitanchor": {
    gradient: "from-emerald-500 to-lime-500",
    text: "text-emerald-600",
  },
  "miniapp-trustanchor": {
    gradient: "from-slate-600 to-teal-500",
    text: "text-teal-600",
  },
  "miniapp-neo-pay": {
    gradient: "from-green-400 to-emerald-500",
    text: "text-green-600",
  },
};
const defaultAccent = {
  gradient: "from-gray-400 to-gray-500",
  text: "text-gray-600",
};

type PageNetwork = "mainnet" | "testnet";
type StatusFilter = "all" | "live" | "tool" | "other-network" | "pending";

function normalizePageNetwork(value: unknown): PageNetwork | null {
  const raw = Array.isArray(value) ? value[0] : value;
  const text = String(raw ?? "").trim().toLowerCase();
  if (text === "mainnet" || text === "neo-n3-mainnet") return "mainnet";
  if (text === "testnet" || text === "neo-n3-testnet") return "testnet";
  return null;
}

function resolvePageNetwork(
  asPath: string | undefined,
  queryNetwork: string | string[] | undefined,
): PageNetwork {
  const fromQuery = normalizePageNetwork(queryNetwork);
  if (fromQuery) return fromQuery;

  const safePath = String(asPath ?? "");
  const queryString = safePath.includes("?") ? safePath.split("?")[1] : "";
  const fromPath = normalizePageNetwork(
    new URLSearchParams(queryString).get("network"),
  );
  return fromPath ?? getRpcNetwork();
}

function getStatusFilterKey(app: MiniAppInfo, targetNetwork: string): string {
  const availability = getMiniAppCatalogAvailability(app, targetNetwork);
  return availability.tone === "unsupported"
    ? "other-network"
    : availability.tone;
}

/* ── Flagship card ───────────────────────────────────────────────────── */

function MiniAppListingCard({
  app,
  targetNetwork,
  locale,
  t,
}: {
  app: MiniAppInfo;
  targetNetwork: string;
  locale: Locale;
  t: (key: string, ns?: "common" | "host" | "admin" | "miniapp") => string;
}) {
  const accent = flagshipAccents[app.app_id] || defaultAccent;
  const availability = getMiniAppCatalogAvailability(app, targetNetwork);
  const appName = getLocalizedMiniAppName(app, locale);
  const appDescription = getLocalizedMiniAppDescription(app, locale);
  const categoryLabel = getLocalizedMiniAppCategoryLabel(app, locale, t);
  const availabilityLabel = getAvailabilityLabel(
    availability.tone,
    availability.label,
    t,
  );
  const networkLabel = getNetworkLabel(targetNetwork as PageNetwork, t);
  const shortId = app.app_id.replace(/^miniapp-/, "");
  const statusClass =
    availability.tone === "live"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : availability.tone === "pending"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : availability.tone === "unsupported"
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : "border-gray-200 bg-gray-50 text-gray-600";
  const statusDotClass =
    availability.tone === "live"
      ? "bg-emerald-500"
      : availability.tone === "pending"
        ? "bg-amber-500"
        : availability.tone === "unsupported"
          ? "bg-sky-500"
          : "bg-gray-400";

  return (
    <Link
      href={`/miniapps/${encodeURIComponent(app.app_id)}?network=${targetNetwork}`}
      className="group relative flex min-w-0 items-center gap-3 overflow-hidden rounded-lg border border-gray-200 bg-white p-3 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-neo/40 hover:shadow-md sm:gap-4 sm:p-4"
      data-testid="miniapp-market-row"
    >
      <div
        className={`absolute bottom-3 left-0 top-3 w-1 rounded-r-full bg-gradient-to-b ${accent.gradient}`}
        aria-hidden="true"
      />

      <div className="ml-2 flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-50 p-1.5 shadow-sm shadow-gray-950/5 sm:h-16 sm:w-16">
        <MiniAppLogo
          appId={app.app_id}
          category={app.category}
          entryUrl={app.entry_url}
          logoUrl={app.logo_url}
          manifest={app.manifest || null}
          alt={app.name}
          size="lg"
          className="h-full w-full rounded-full"
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${statusClass}`}
          >
            <span className="relative flex h-1.5 w-1.5">
              {availability.tone === "live" && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-40" />
              )}
              <span
                className={`relative inline-flex h-1.5 w-1.5 rounded-full ${statusDotClass}`}
              />
            </span>
            {availabilityLabel}
          </span>
          <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-500">
            {categoryLabel}
          </span>
        </div>

        <h3 className="m-0 mt-2 truncate text-lg font-black text-gray-950 transition-colors group-hover:text-emerald-700 sm:text-xl">
          {appName}
        </h3>

        <p className="mt-1 line-clamp-2 text-sm leading-6 text-gray-500">
          {appDescription}
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-semibold text-gray-400">
          <span>{shortId}</span>
          <span aria-hidden="true">/</span>
          <span>{networkLabel}</span>
        </div>
      </div>

      <div className="hidden min-w-[150px] flex-col items-end gap-2 sm:flex">
        <span className="text-xs font-bold uppercase text-gray-400">
          {getCategoryLabel(app.category, t)}
        </span>
        <span
          className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 transition-colors group-hover:bg-emerald-600 group-hover:border-emerald-600 group-hover:text-white"
          data-testid="miniapp-row-open"
        >
          {t("catalog.openApp", "host")}
          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
      </div>
      <ArrowUpRight
        className="h-5 w-5 shrink-0 text-gray-400 transition-colors group-hover:text-emerald-600 sm:hidden"
        aria-hidden="true"
      />
    </Link>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────── */

type MiniAppsPageProps = {
  initialApps?: MiniAppInfo[];
};

const EMPTY_INITIAL_APPS: MiniAppInfo[] = [];

function toSerializablePermissions(
  value: MiniAppInfo["permissions"] | null | undefined,
): MiniAppInfo["permissions"] {
  return JSON.parse(JSON.stringify(value ?? {})) as MiniAppInfo["permissions"];
}

function serializeMiniApps(apps: MiniAppInfo[]): MiniAppInfo[] {
  return apps.map((app) => ({
    app_id: app.app_id,
    name: app.name,
    name_en: app.name_en ?? null,
    name_zh: app.name_zh ?? null,
    name_ja: app.name_ja ?? null,
    name_ko: app.name_ko ?? null,
    description: app.description,
    description_en: app.description_en ?? null,
    description_zh: app.description_zh ?? null,
    description_ja: app.description_ja ?? null,
    description_ko: app.description_ko ?? null,
    icon: app.icon,
    category_name: app.category_name ?? null,
    category_name_zh: app.category_name_zh ?? null,
    category_name_ja: app.category_name_ja ?? null,
    category_name_ko: app.category_name_ko ?? null,
    logo_url: app.logo_url ?? null,
    banner_url: app.banner_url ?? null,
    category: app.category,
    entry_url: app.entry_url,
    contract_hash: app.contract_hash ?? null,
    status: app.status ?? null,
    source: app.source ?? "miniapp",
    permissions: toSerializablePermissions(app.permissions),
    manifest: compactMiniAppManifestForCatalog(app.manifest),
  }));
}

export const getStaticProps: GetStaticProps<MiniAppsPageProps> = async () => {
  const definitions = await loadMiniAppDefinitions();
  const initialApps = sortMiniApps(
    definitions.filter((app) => app.status !== "disabled"),
    "featured",
  );

  return {
    props: {
      initialApps: serializeMiniApps(initialApps),
    },
    revalidate: 60,
  };
};

export default function MiniAppsPage({
  initialApps = EMPTY_INITIAL_APPS,
}: MiniAppsPageProps = {}) {
  const router = useRouter();
  const { locale, t } = useI18n();
  const sortedInitialApps = useMemo(
    () => sortMiniApps(initialApps, "featured"),
    [initialApps],
  );
  const hasInitialApps = sortedInitialApps.length > 0;
  const [allApps, setAllApps] = useState<MiniAppInfo[]>(sortedInitialApps);
  const [loading, setLoading] = useState(!hasInitialApps);
  const [fetchError, setFetchError] = useState(false);
  const mountedRef = useRef(true);
  const [targetNetwork, setTargetNetwork] = useState<PageNetwork>(() =>
    getRpcNetwork(),
  );

  useEffect(() => {
    setTargetNetwork(resolvePageNetwork(router.asPath, router.query.network));
  }, [router.asPath, router.query.network]);

  useEffect(() => {
    mountedRef.current = true;
    if (!hasInitialApps) setLoading(true);
    setFetchError(false);
    fetch("/api/miniapps/catalog?scope=all", {
      signal: AbortSignal.timeout(10_000),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Catalog request failed: ${r.status}`);
        return r.json();
      })
      .then((data) => {
        if (!mountedRef.current) return;
        if (!data) {
          if (!hasInitialApps) setFetchError(true);
          return;
        }
        const nextApps = Array.isArray(data.apps)
          ? sortMiniApps(data.apps as MiniAppInfo[], "featured")
          : [];
        if (nextApps.length > 0 || !hasInitialApps) setAllApps(nextApps);
        setFetchError(false);
      })
      .catch(() => {
        if (mountedRef.current && !hasInitialApps) {
          setFetchError(true);
        }
      })
      .finally(() => {
        if (mountedRef.current) setLoading(false);
      });
    return () => {
      mountedRef.current = false;
    };
  }, [hasInitialApps, targetNetwork]);

  useEffect(() => {
    if (!hasInitialApps) return;
    setAllApps((current) => (current.length > 0 ? current : sortedInitialApps));
  }, [hasInitialApps, sortedInitialApps]);

  const listedApps = useMemo(
    () =>
      sortMiniApps(
        allApps.filter((a) => a.status !== "disabled"),
        "featured",
      ),
    [allApps],
  );
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    const routeQuery = typeof router.query.q === "string" ? router.query.q : "";
    setQuery(routeQuery);
  }, [router.query.q]);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(listedApps.map((app) => app.category).filter(Boolean)),
      ).sort(),
    [listedApps],
  );
  const filteredApps = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    return listedApps.filter((app) => {
      const statusLabel = getStatusFilterKey(app, targetNetwork);
      const matchesStatus =
        statusFilter === "all" || statusFilter === statusLabel;
      const matchesCategory =
        categoryFilter === "all" || app.category === categoryFilter;
      const localizedName = getLocalizedMiniAppName(app, locale);
      const localizedDescription = getLocalizedMiniAppDescription(app, locale);
      const localizedCategory = getLocalizedMiniAppCategoryLabel(app, locale, t);
      const matchesQuery =
        !normalizedQuery ||
        [
          app.name,
          localizedName,
          app.app_id,
          app.description,
          localizedDescription,
          app.category,
          localizedCategory,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(normalizedQuery),
          );
      return matchesStatus && matchesCategory && matchesQuery;
    });
  }, [
    categoryFilter,
    listedApps,
    deferredQuery,
    statusFilter,
    targetNetwork,
    locale,
    t,
  ]);

  const hero = filteredApps[0];
  const networkLabel = getNetworkLabel(targetNetwork, t);
  const statusCounts = useMemo(
    () =>
      listedApps.reduce(
        (counts, app) => {
          const key = getStatusFilterKey(app, targetNetwork) as StatusFilter;
          counts[key] = (counts[key] ?? 0) + 1;
          return counts;
        },
        {
          all: listedApps.length,
          live: 0,
          tool: 0,
          "other-network": 0,
          pending: 0,
        } satisfies Record<StatusFilter, number>,
      ),
    [listedApps, targetNetwork],
  );

  const quickFilters = [
    {
      value: "live" as StatusFilter,
      label: t("catalog.filters.live", "host"),
      count: statusCounts.live,
      icon: TrendingUp,
      iconClassName: "bg-[#DEF5E9] text-[#35B878]",
      cardClassName: "hover:border-emerald-200",
    },
    {
      value: "tool" as StatusFilter,
      label: t("catalog.filters.tool", "host"),
      count: statusCounts.tool,
      icon: Wrench,
      iconClassName: "bg-[#DFF0FF] text-[#4C9DE8]",
      cardClassName: "hover:border-sky-200",
    },
    {
      value: "pending" as StatusFilter,
      label: t("catalog.filters.pending", "host"),
      count: statusCounts.pending,
      icon: Sparkles,
      iconClassName: "bg-[#FFEBE4] text-[#FF8C5A]",
      cardClassName: "hover:border-orange-200",
    },
  ];

  return (
    <Layout>
      <Head>
        <title>{`${t("catalog.pageTitle", "host")} - ${BRAND.productName}`}</title>
        <meta name="description" content={BRAND.description} />
      </Head>

      <div
        className="min-h-screen bg-[#f7f8fb] pt-20"
        data-testid="miniapps-market-shell"
      >
        {/* ── Hero ──────────────────────────────────────────────────── */}
        <section className="px-4 py-6 sm:px-6 sm:py-8">
          <div className="mx-auto max-w-6xl">
            <div className="p-0">
              <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:items-stretch">
                <div className="flex min-w-0 flex-col">
                  <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-40" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    <span className="text-xs font-bold uppercase text-emerald-700">
                      {networkLabel}
                    </span>
                  </div>
                  <h1 className="m-0 text-3xl font-extrabold leading-tight tracking-tight text-gray-950 sm:text-4xl">
                    {t("hero.title", "host")}
                  </h1>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-gray-600">
                    {t("catalog.description", "host")}
                  </p>

                  <label
                    className="relative mt-6 block max-w-2xl"
                    data-testid="miniapps-market-search"
                  >
                    <span className="sr-only">
                      {t("catalog.searchLabel", "host")}
                    </span>
                    <Search
                      className="pointer-events-none absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
                      aria-hidden="true"
                    />
                    <input
                      id="miniapps-search"
                      name="q"
                      type="search"
                      autoComplete="off"
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder={t("catalog.searchPlaceholder", "host")}
                      className="h-14 w-full rounded-xl border border-gray-200 bg-white pl-14 pr-5 text-base font-semibold text-gray-900 shadow-sm outline-none transition placeholder:font-medium placeholder:text-gray-400 focus:border-neo/60 focus:ring-4 focus:ring-neo/10"
                    />
                  </label>

                  <div
                    className="mt-5 grid grid-cols-3 gap-2 sm:gap-3"
                    data-testid="miniapps-quick-filters"
                  >
                    {quickFilters.map((item) => {
                      const Icon = item.icon;
                      const active = statusFilter === item.value;
                      return (
                        <button
                          key={item.value}
                          type="button"
                          onClick={() => setStatusFilter(item.value)}
                          className={`group flex min-h-24 min-w-0 flex-col items-center justify-center rounded-xl border bg-white p-2 text-center shadow-sm transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 sm:min-h-28 sm:p-4 ${item.cardClassName} ${
                            active
                              ? "border-gray-950 text-gray-950"
                              : "border-gray-200 text-gray-700 hover:-translate-y-0.5"
                          }`}
                        >
                          <span
                            className={`grid h-14 w-14 place-items-center rounded-full ${item.iconClassName}`}
                          >
                            <Icon className="h-6 w-6" aria-hidden="true" />
                          </span>
                          <span className="mt-3 text-sm font-black">
                            {item.label}
                          </span>
                          <span className="mt-1 text-xs font-semibold text-gray-400">
                            {item.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <aside
                  className="flex min-h-[260px] flex-col justify-between rounded-3xl border border-gray-200 bg-gradient-to-br from-emerald-50 via-white to-violet-50 p-5 text-gray-900 shadow-sm sm:min-h-[340px]"
                  data-testid="miniapps-lead-preview"
                >
                  {hero ? (
                    <>
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase text-emerald-700">
                            {getAvailabilityLabel(
                              getMiniAppCatalogAvailability(hero, targetNetwork)
                                .tone,
                              getMiniAppCatalogAvailability(hero, targetNetwork)
                                .label,
                              t,
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setStatusFilter("all")}
                            className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-bold uppercase text-gray-500 transition-colors hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
                          >
                            {t("catalog.filters.all", "host")}
                          </button>
                        </div>
                        <div className="mt-6 flex items-center gap-4 sm:mt-9">
                          <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl border border-gray-200 bg-white p-2 shadow-sm sm:h-20 sm:w-20">
                            <MiniAppLogo
                              appId={hero.app_id}
                              category={hero.category}
                              entryUrl={hero.entry_url}
                              logoUrl={hero.logo_url}
                              manifest={hero.manifest || null}
                              alt={getLocalizedMiniAppName(hero, locale)}
                              size="lg"
                              className="h-full w-full rounded-xl"
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="m-0 text-xs font-bold uppercase tracking-wide text-gray-500">
                              {getLocalizedMiniAppCategoryLabel(hero, locale, t)}
                            </p>
                            <h2 className="m-0 mt-1 truncate text-2xl font-extrabold text-gray-900 sm:text-3xl">
                              {getLocalizedMiniAppName(hero, locale)}
                            </h2>
                          </div>
                        </div>
                        <p className="mt-4 line-clamp-2 text-sm leading-6 text-gray-600 sm:mt-5 sm:line-clamp-3 sm:text-base">
                          {getLocalizedMiniAppDescription(hero, locale)}
                        </p>
                      </div>
                      <Link
                        href={`/miniapps/${hero.app_id}?network=${targetNetwork}`}
                        className="mt-4 inline-flex h-12 items-center justify-center rounded-xl bg-emerald-700 px-5 text-sm font-bold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 sm:mt-6 sm:h-14"
                      >
                        {t("catalog.openApp", "host")}
                        <ArrowUpRight
                          className="ml-2 h-4 w-4"
                          aria-hidden="true"
                        />
                      </Link>
                    </>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center text-center">
                      <Boxes className="h-12 w-12 text-gray-300" />
                      <p className="mt-3 text-sm font-semibold text-gray-500">
                        {t("catalog.empty", "host")}
                      </p>
                    </div>
                  )}
                </aside>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                {[
                  ["all", t("catalog.filters.all", "host")],
                  ["live", t("catalog.filters.live", "host")],
                  ["tool", t("catalog.filters.tool", "host")],
                  ["other-network", t("catalog.filters.otherNetwork", "host")],
                  ["pending", t("catalog.filters.pending", "host")],
                ].map(([value, label]) => {
                  const active = statusFilter === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setStatusFilter(value as StatusFilter)}
                      className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 ${
                        active
                          ? "border-emerald-600 bg-emerald-600 text-white"
                          : "border-gray-200 bg-white text-gray-500 hover:text-gray-900"
                      }`}
                    >
                      {label}
                      <span className="ml-1 text-[10px] opacity-70">
                        {statusCounts[value as StatusFilter] ?? 0}
                      </span>
                    </button>
                  );
                })}
                <span className="ml-auto hidden items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-xs font-bold text-gray-500 sm:inline-flex">
                  <Radio className="h-3.5 w-3.5 text-emerald-500" />
                  {interpolate(t("catalog.shownCount", "host"), {
                    shown: filteredApps.length,
                    total: listedApps.length,
                  })}
                </span>
              </div>
            </div>
          </div>
        </section>

        {fetchError && (
          <div className="mx-auto max-w-5xl px-4 pt-8 sm:px-6">
            <p
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
            >
              {t("catalog.fetchError", "host")}
            </p>
          </div>
        )}

        {/* ── MiniApps ──────────────────────────────────────────────── */}
        <section className="px-4 pb-10 pt-2 sm:px-6 sm:pb-12">
          <div className="mx-auto max-w-6xl">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="m-0 text-base font-bold text-gray-900">
                  {t("catalog.title", "host")}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {interpolate(t("catalog.shownCount", "host"), {
                    shown: filteredApps.length,
                    total: listedApps.length,
                  })}
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 pb-1 sm:justify-end">
                {["all", ...categories].map((category) => {
                  const active = categoryFilter === category;
                  return (
                    <button
                      key={category}
                      type="button"
                      onClick={() => setCategoryFilter(category)}
                      className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 ${
                        active
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-gray-200 bg-white text-gray-500 hover:text-gray-800"
                      }`}
                    >
                      {category === "all"
                        ? t("categories.all", "host")
                        : getCategoryLabel(category, t)}
                    </button>
                  );
                })}
              </div>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 gap-3">
                {Array.from({ length: 9 }, (_, i) => (
                  <div
                    key={i}
                    className="h-24 rounded-lg border border-gray-200 bg-white"
                  >
                    <div className="h-full animate-pulse rounded-lg bg-gray-50" />
                  </div>
                ))}
              </div>
            ) : (
              <div
                className="grid grid-cols-1 gap-3"
                data-testid="miniapps-market-list"
              >
                {filteredApps.length > 0 ? (
                  filteredApps.map((app) => (
                    <MiniAppListingCard
                      key={app.app_id}
                      app={app}
                      targetNetwork={targetNetwork}
                      locale={locale}
                      t={t}
                    />
                  ))
                ) : (
                  <div className="col-span-full rounded-xl border border-dashed border-gray-300 bg-white px-4 py-10 text-center text-sm text-gray-500">
                    {t("catalog.empty", "host")}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </div>
    </Layout>
  );
}
