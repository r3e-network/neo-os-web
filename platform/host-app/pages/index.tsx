import Head from "next/head";
import type { GetStaticProps } from "next";
import Link from "next/link";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { MiniAppLogo } from "@/components/features/miniapp/MiniAppLogo";
import type { MiniAppInfo } from "@/components/types";
import {
  partitionMiniApps,
  buildCategoryCounts,
  filterMiniAppsByCategory,
  sortMiniApps,
} from "@/lib/miniapp-showcase";
import { loadMiniAppDefinitions } from "@/lib/miniapp-definitions";
import {
  compactMiniAppManifestForCatalog,
  getMiniAppCatalogAvailability,
} from "@/lib/miniapp-catalog-view";
import {
  getAvailabilityLabel,
  getCategoryLabel,
  getLocalizedMiniAppDescription,
  getLocalizedMiniAppName,
  getNetworkLabel,
} from "@/lib/i18n/miniapp-display";
import { interpolate, type Locale } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/react";
import { getRpcNetwork } from "@/lib/rpc-helpers";
import { BRAND } from "@/lib/brand";
import {
  Rocket,
  Shield,
  Zap,
  Globe,
  Cpu,
  LayoutGrid,
  Filter,
  Gamepad2,
  Coins,
  Users,
  Image as ImageIcon,
  Vote,
  Wrench,
  Code2,
  ChevronRight,
  ArrowUpRight,
  CheckCircle2,
  Layers3,
  Search,
} from "lucide-react";

// Category definitions with icons
const CATEGORY_ICONS: Record<
  string,
  ComponentType<{ size?: number | string; className?: string }>
> = {
  all: LayoutGrid,
  gaming: Gamepad2,
  defi: Coins,
  social: Users,
  nft: ImageIcon,
  governance: Vote,
  utility: Wrench,
};

export type LandingPageProps = {
  initialApps?: MiniAppInfo[];
};

const EMPTY_INITIAL_APPS: MiniAppInfo[] = [];

function toSerializableRecord(
  value: Record<string, unknown> | null | undefined,
): Record<string, unknown> | null {
  if (!value) return null;
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
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
    permissions: toSerializableRecord(
      app.permissions ?? {},
    ) as MiniAppInfo["permissions"],
    manifest: compactMiniAppManifestForCatalog(app.manifest),
  }));
}

export const getStaticProps: GetStaticProps<LandingPageProps> = async () => {
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

export default function LandingPage({
  initialApps = EMPTY_INITIAL_APPS,
}: LandingPageProps = {}) {
  const { locale, t } = useI18n();
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState<"featured" | "recent" | "name">(
    "featured",
  );
  const [catalogLoading, setCatalogLoading] = useState(initialApps.length === 0);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [catalogApps, setCatalogApps] = useState<MiniAppInfo[]>(() => {
    return sortMiniApps(initialApps, "featured");
  });
  const [featuredApps, setFeaturedApps] = useState<MiniAppInfo[]>(() => {
    const partitions = partitionMiniApps(initialApps);
    return partitions.flagship;
  });
  const [toolApps, setToolApps] = useState<MiniAppInfo[]>(() => {
    const partitions = partitionMiniApps(initialApps);
    return partitions.tools;
  });
  const targetNetwork = getRpcNetwork();
  const networkLabel = getNetworkLabel(targetNetwork, t);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/miniapps/catalog?scope=all", {
          signal: AbortSignal.timeout(10_000),
        });
        if (!active) return;
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        const allApps = Array.isArray(data?.apps)
          ? sortMiniApps(data.apps as MiniAppInfo[], "featured")
          : [];
        const partitions = partitionMiniApps(allApps as MiniAppInfo[]);
        setCatalogApps(allApps);
        setFeaturedApps(partitions.flagship);
        setToolApps(partitions.tools);
      } catch (err) {
        logger.error("Failed to fetch miniapp catalog:", err);
      } finally {
        if (active) setCatalogLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [targetNetwork]);

  const categories = useMemo(() => {
    const counts = buildCategoryCounts(catalogApps);
    return [
      {
        id: "all",
        label: t("home.categories.all", "host"),
        icon: CATEGORY_ICONS.all,
        count: counts.all,
      },
      {
        id: "gaming",
        label: getCategoryLabel("gaming", t),
        icon: CATEGORY_ICONS.gaming,
        count: counts.gaming || 0,
      },
      {
        id: "defi",
        label: getCategoryLabel("defi", t),
        icon: CATEGORY_ICONS.defi,
        count: counts.defi || 0,
      },
      {
        id: "social",
        label: getCategoryLabel("social", t),
        icon: CATEGORY_ICONS.social,
        count: counts.social || 0,
      },
      {
        id: "nft",
        label: getCategoryLabel("nft", t),
        icon: CATEGORY_ICONS.nft,
        count: counts.nft || 0,
      },
      {
        id: "governance",
        label: getCategoryLabel("governance", t),
        icon: CATEGORY_ICONS.governance,
        count: counts.governance || 0,
      },
      {
        id: "utility",
        label: getCategoryLabel("utility", t),
        icon: CATEGORY_ICONS.utility,
        count: counts.utility || 0,
      },
    ];
  }, [catalogApps, t]);

  const filteredApps = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();
    const filtered = filterMiniAppsByCategory(catalogApps, selectedCategory);
    return sortMiniApps(
      normalizedQuery
        ? filtered.filter((app) =>
            [
              app.name,
              getLocalizedMiniAppName(app, locale),
              app.app_id,
              app.description,
              getLocalizedMiniAppDescription(app, locale),
              app.category,
              getCategoryLabel(String(app.category), t),
            ]
              .filter(Boolean)
              .some((value) =>
                String(value).toLowerCase().includes(normalizedQuery),
              ),
          )
        : filtered,
      sortBy,
    );
  }, [selectedCategory, sortBy, catalogApps, deferredQuery, locale, t]);

  const featuredList =
    featuredApps.length > 0
      ? featuredApps
      : partitionMiniApps(initialApps).flagship;
  const platformStats = [
    {
      label: t("home.stats.enabledApps", "host"),
      value: String(catalogApps.length || initialApps.length),
    },
    {
      label: t("home.stats.featured", "host"),
      value: String(featuredList.length),
    },
    {
      label: t("home.stats.operatorTools", "host"),
      value: String(toolApps.length),
    },
  ];

  return (
    <Layout>
      <Head>
        <title>{BRAND.title}</title>
        <meta
          name="description"
          content={BRAND.description}
        />
      </Head>

      <section className="border-b border-gray-200 bg-[#f6f8fb] px-4 pb-10 pt-28 sm:px-6">
        <div className="mx-auto grid max-w-[1500px] gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase text-gray-500">
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-emerald-700">
                {networkLabel}
              </span>
              <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1">
                {t("home.badges.nep21Ready", "host")}
              </span>
              <span className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1">
                {t("home.badges.onegateExport", "host")}
              </span>
            </div>

            <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)] lg:items-end">
              <div>
                <h1 className="m-0 max-w-4xl text-4xl font-black leading-tight text-gray-950 sm:text-5xl lg:text-6xl">
                  {t("home.hero.title", "host")}
                </h1>
                <p className="mt-5 max-w-3xl text-base leading-7 text-gray-600 sm:text-lg">
                  {t("home.hero.body", "host")}
                </p>
                <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                  <Link href="/miniapps">
                    <Button className="h-12 rounded-lg bg-gray-950 px-5 text-sm font-bold text-white hover:bg-gray-800">
                      {t("home.hero.catalogCta", "host")}
                      <Rocket className="ml-2 h-4 w-4" aria-hidden="true" />
                    </Button>
                  </Link>
                  <Link href="/developer">
                    <Button
                      variant="outline"
                      className="h-12 rounded-lg border-gray-200 bg-white px-5 text-sm font-bold text-gray-900 hover:bg-gray-50"
                    >
                      {t("home.hero.developerCta", "host")}
                      <Code2 className="ml-2 h-4 w-4" aria-hidden="true" />
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="grid gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="m-0 text-xs font-semibold uppercase text-gray-400">
                      {t("home.status.title", "host")}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">
                      {t("home.status.subtitle", "host")}
                    </p>
                  </div>
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                    <Layers3 className="h-5 w-5" aria-hidden="true" />
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {platformStats.map((item) => (
                    <div
                      key={item.label}
                      className="rounded-lg border border-gray-200 bg-white p-3"
                    >
                      <p className="m-0 truncate text-[11px] font-semibold text-gray-400">
                        {item.label}
                      </p>
                      <p className="m-0 mt-1 truncate text-lg font-black text-gray-900">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="grid gap-2 text-sm text-gray-600">
                  {[
                    t("home.status.itemNetwork", "host"),
                    t("home.status.itemConsole", "host"),
                    t("home.status.itemPlayArea", "host"),
                  ].map((item) => (
                    <div key={item} className="flex items-center gap-2">
                      <CheckCircle2
                        className="h-4 w-4 text-emerald-600"
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <aside
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
            data-testid="homepage-featured-apps"
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="m-0 text-xs font-semibold uppercase text-gray-400">
                  {t("home.featured.eyebrow", "host")}
                </p>
                <h2 className="m-0 mt-1 text-lg font-bold text-gray-900">
                  {t("home.featured.title", "host")}
                </h2>
              </div>
              <Link
                href="/miniapps"
                className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700 hover:border-emerald-300 hover:text-emerald-700"
              >
                {t("actions.viewAll")}
              </Link>
            </div>
            <div className="space-y-2">
              {featuredList.map((app) => (
                <HomeMiniAppRow
                  key={app.app_id}
                  app={app}
                  targetNetwork={targetNetwork}
                  locale={locale}
                  t={t}
                />
              ))}
              {catalogLoading && featuredList.length === 0 && (
                <div className="space-y-2">
                  {Array.from({ length: 9 }, (_, index) => (
                    <div
                      key={index}
                      className="h-16 animate-pulse rounded-xl bg-gray-100"
                    />
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </section>

      {/* Main Content Section */}
      <section className="bg-[#f6f8fb] px-4 py-10 sm:px-6">
        <div className="mx-auto max-w-[1600px]">
          <div className="mb-6 grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_420px]">
            <div>
              <h2 className="m-0 text-2xl font-black text-gray-900">
                {t("catalog.title", "host")}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
                {t("home.catalog.description", "host")}
              </p>
            </div>
            <label className="relative block self-end">
              <span className="sr-only">
                {t("catalog.searchLabel", "host")}
              </span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("home.catalog.searchPlaceholder", "host")}
                className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm text-gray-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100"
              />
            </label>
          </div>

          <div
            className="flex flex-col gap-6 lg:flex-row"
            data-testid="homepage-catalog"
          >
            {/* Sidebar Filters */}
            <aside className="hidden w-72 shrink-0 space-y-8 lg:block">
              <div className="sticky top-24">
                <h2 className="flex items-center gap-3 font-extrabold text-xl text-gray-900 mb-6 px-2">
                  <Filter size={20} aria-hidden="true" className="text-neo" />
                  {t("home.catalog.ecosystems", "host")}
                </h2>
                <div className="space-y-2">
                  {categories.map((cat) => {
                    const Icon = cat.icon;
                    const isActive = selectedCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCategory(cat.id)}
                        className={cn(
                          "w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo",
                          isActive
                            ? "bg-neo/15 text-neo font-bold shadow-[inset_0_0_20px_rgba(0,229,153,0.1)]"
                            : "text-gray-600 hover:bg-white/50 hover:text-gray-900",
                        )}
                      >
                        <span className="flex items-center gap-3 text-sm">
                          <Icon
                            size={18}
                            className={isActive ? "text-neo" : ""}
                            aria-hidden="true"
                          />
                          {cat.label}
                        </span>
                        <span
                          className={cn(
                            "text-xs px-2.5 py-1 rounded-full font-semibold",
                            isActive
                              ? "bg-neo/20 text-neo"
                              : "bg-gray-200/50 text-gray-500",
                          )}
                        >
                          {cat.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </aside>

            {/* Main Content */}
            <div className="flex-1">
              <div className="mb-6 flex flex-col justify-between gap-4 rounded-xl border border-gray-200 bg-white p-2 shadow-sm sm:flex-row sm:items-center">
                <div className="flex items-center gap-2 overflow-x-auto p-1 no-scrollbar w-full sm:w-auto">
                  {(["featured", "recent", "name"] as const).map((opt) => (
                    <Button
                      key={opt}
                      variant="ghost"
                      onClick={() => setSortBy(opt)}
                      className={cn(
                        "h-10 rounded-xl text-sm font-bold px-6 capitalize transition-all",
                        sortBy === opt
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-500 hover:text-gray-900 hover:bg-gray-100",
                      )}
                    >
                      {t(`home.sort.${opt}`, "host")}
                    </Button>
                  ))}
                </div>

                <div className="px-3 text-sm font-semibold text-gray-500">
                  {interpolate(t("home.catalog.shownCount", "host"), {
                    shown: filteredApps.length,
                  })}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {catalogLoading ? (
                  Array.from({ length: 6 }, (_, index) => (
                    <div
                      key={index}
                      className="h-28 animate-pulse rounded-xl border border-gray-200 bg-white"
                    >
                    </div>
                  ))
                ) : filteredApps.length > 0 ? (
                  filteredApps.map((app) => (
                    <HomeMiniAppRow
                      key={app.app_id}
                      app={app}
                      targetNetwork={targetNetwork}
                      locale={locale}
                      t={t}
                      spacious
                    />
                  ))
                ) : (
                  <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white py-16 text-gray-500">
                    <LayoutGrid className="mb-4 h-12 w-12 text-gray-300" />
                    <p className="text-xl font-semibold">
                      {t("home.catalog.emptyTitle", "host")}
                    </p>
                    <p className="text-sm mt-2">
                      {t("home.catalog.emptyBody", "host")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Account & Oracle Tools */}
      <section className="bg-white px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-[1500px]">
          <div className="mb-6 flex items-end justify-between gap-6">
            <div>
              <h2 className="m-0 text-2xl font-black text-gray-900 md:text-3xl">
                {t("home.tools.title", "host")}
              </h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
                {t("home.tools.description", "host")}
              </p>
            </div>
            <Link href="/miniapps">
              <Button
                variant="outline"
                className="rounded-full border-gray-200"
              >
                {t("home.tools.browse", "host")}
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {catalogLoading ? (
              Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
              ))
            ) : toolApps && toolApps.length > 0 ? (
              toolApps.map((app) => (
                <HomeMiniAppRow
                  key={app.app_id}
                  app={app}
                  targetNetwork={targetNetwork}
                  locale={locale}
                  t={t}
                  spacious
                />
              ))
            ) : (
              <div className="col-span-full flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 py-12 text-gray-500">
                <Wrench className="w-12 h-12 mb-3 text-gray-300" />
                <p className="text-base font-semibold">
                  {t("home.tools.emptyTitle", "host")}
                </p>
                <p className="text-sm mt-1">
                  {t("home.tools.emptyBody", "host")}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="bg-[#f6f8fb] px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-[1500px]">
          <div className="mb-8">
            <h2 className="m-0 text-2xl font-black text-gray-900 md:text-3xl">
              {t("home.capabilities.title", "host")}
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
              {t("home.capabilities.description", "host")}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <FeatureItem
              icon={Shield}
              title={t("home.capabilities.teeTitle", "host")}
              desc={t("home.capabilities.teeDesc", "host")}
            />
            <FeatureItem
              icon={Zap}
              title={t("home.capabilities.vrfTitle", "host")}
              desc={t("home.capabilities.vrfDesc", "host")}
            />
            <FeatureItem
              icon={Globe}
              title={t("home.capabilities.oracleTitle", "host")}
              desc={t("home.capabilities.oracleDesc", "host")}
            />
            <FeatureItem
              icon={Cpu}
              title={t("home.capabilities.storageTitle", "host")}
              desc={t("home.capabilities.storageDesc", "host")}
            />
          </div>
        </div>
      </section>

      {/* Hero CTA Section */}
      <section className="bg-white px-4 py-16 sm:px-6">
        <div className="mx-auto flex max-w-[1500px] flex-col gap-5 rounded-2xl border border-gray-200 bg-gray-950 p-6 text-white shadow-sm md:flex-row md:items-center md:justify-between md:p-8">
          <div>
            <h2 className="m-0 text-2xl font-black md:text-3xl">
              {t("home.cta.title", "host")}
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-300">
              {t("home.cta.body", "host")}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/developer">
              <Button className="h-12 rounded-lg bg-neo px-5 text-sm font-bold text-gray-950 hover:bg-neo/90">
                {t("home.cta.start", "host")}
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href="/docs">
              <Button
                variant="outline"
                className="h-12 rounded-lg border-white/20 bg-transparent px-5 text-sm font-bold text-white hover:bg-white/10"
              >
                {t("home.cta.docs", "host")}
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}

function HomeMiniAppRow({
  app,
  spacious = false,
  targetNetwork,
  locale,
  t,
}: {
  app: MiniAppInfo;
  spacious?: boolean;
  targetNetwork: string;
  locale: Locale;
  t: (key: string, ns?: "common" | "host" | "admin" | "miniapp") => string;
}) {
  const availability = getMiniAppCatalogAvailability(app, targetNetwork);
  const appName = getLocalizedMiniAppName(app, locale);
  const appDescription = getLocalizedMiniAppDescription(app, locale);
  const availabilityLabel = getAvailabilityLabel(
    availability.tone,
    availability.label,
    t,
  );
  const statusClass =
    availability.tone === "live"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : availability.tone === "pending"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : availability.tone === "unsupported"
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : "border-gray-200 bg-gray-50 text-gray-500";
  return (
    <Link
      href={`/miniapps/${app.app_id}`}
      className={cn(
        "group flex min-w-0 items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 text-left transition-all hover:border-emerald-300 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
        spacious && "p-4",
      )}
    >
      <MiniAppLogo
        appId={app.app_id}
        category={app.category}
        entryUrl={app.entry_url}
        logoUrl={app.logo_url}
        manifest={app.manifest || null}
        size={spacious ? "lg" : "md"}
        className="shrink-0"
        alt={appName}
      />
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-bold text-gray-900">
            {appName}
          </span>
          <span
            className={cn(
              "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase",
              statusClass,
            )}
          >
            {availabilityLabel}
          </span>
        </span>
        <span className="mt-1 line-clamp-2 text-xs leading-5 text-gray-500">
          {appDescription}
        </span>
      </span>
      <ArrowUpRight
        className="h-4 w-4 shrink-0 text-gray-400 transition-colors group-hover:text-emerald-600"
        aria-hidden="true"
      />
    </Link>
  );
}

function FeatureItem({
  icon: Icon,
  title,
  desc,
}: {
  icon: ComponentType<{ size?: number | string; className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <Card className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 text-left shadow-sm transition-all hover:border-emerald-300 hover:shadow-md">
      <div className="relative z-10 mb-5 flex h-11 w-11 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 text-gray-900 transition-colors group-hover:border-emerald-200 group-hover:bg-emerald-50 group-hover:text-emerald-700">
        <Icon size={26} aria-hidden="true" />
      </div>
      <h3 className="relative z-10 mb-3 text-lg font-bold text-gray-900">
        {title}
      </h3>
      <p className="relative z-10 text-sm font-medium leading-6 text-gray-600">
        {desc}
      </p>
    </Card>
  );
}
