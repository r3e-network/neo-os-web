import { useState, useMemo, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import type { GetStaticProps, InferGetStaticPropsType } from "next";
import { Layout } from "@/components/layout";
import { StatsBar } from "@/components/features/stats";
import { MiniAppCard, MiniAppListItem, CategorySidebar, FilterBar } from "@/components/features/miniapp";
import { ActivityTicker } from "@/components/ActivityTicker";
import { useActivityFeed } from "@/hooks/useActivityFeed";
import { BUILTIN_APPS } from "@/lib/builtin-apps";
import { useTranslation } from "@/lib/i18n/react";
import { cn } from "@/lib/utils";
import type { MiniAppInfo } from "@/components/types";
import type { LucideIcon } from "lucide-react";
import { Shield, Zap, Globe, LayoutGrid, Filter, Gamepad2, Coins, Users, Image, Vote, Wrench } from "lucide-react";

import { HeroSection } from "@/components/features/landing/HeroSection";
import { ArchitectureSection } from "@/components/features/landing/ArchitectureSection";
import { ServicesGrid } from "@/components/features/landing/ServicesGrid";
import { NNTNewsFeed } from "@/components/features/news";
import { SecurityFeatures } from "@/components/features/landing/SecurityFeatures";
import { CTABuilding } from "@/components/features/landing/CTABuilding";
import { WaterWaveBackground } from "@/components/ui/WaterWaveBackground";
import { DiscoveryCarousel } from "@/components/features/discovery";
import { useRecommendations } from "@/components/features/recommendations";
import { useWalletStore } from "@/lib/wallet/store";
import { FeaturedHeroCarousel } from "@/components/features/discovery/FeaturedHeroCarousel";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

const VALID_SORT_VALUES = ["trending", "recent", "popular"] as const;

// Interface for stats from API
interface AppStats {
  [appId: string]: { users: number; transactions: number; views: number; rating?: number };
}

interface PlatformStats {
  totalUsers: number;
  totalTransactions: number;
  totalVolume: string;
  totalGasBurned: string;
  stakingApr: string;
  activeApps: number;
}

// Category definitions with icons
const CATEGORY_ICONS: Record<string, LucideIcon> = {
  all: LayoutGrid,
  gaming: Gamepad2,
  defi: Coins,
  social: Users,
  nft: Image,
  governance: Vote,
  utility: Wrench,
};

/** Props provided by getStaticProps for ISR */
interface LandingPageProps {
  initialPlatformStats: PlatformStats | null;
  initialAppStats: AppStats;
  initialCommunityApps: MiniAppInfo[];
}

export default function LandingPage({
  initialPlatformStats,
  initialAppStats,
  initialCommunityApps,
}: InferGetStaticPropsType<typeof getStaticProps>) {
  const { t } = useTranslation("host");
  const { sections: recommendationSections } = useRecommendations();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activeFilter, setActiveFilter] = useState("trending");
  const [appStats, setAppStats] = useState<AppStats>(initialAppStats ?? {});
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(initialPlatformStats ?? null);
  const [communityApps, setCommunityApps] = useState<MiniAppInfo[]>(initialCommunityApps ?? []);
  const hasInitialData = Boolean(initialPlatformStats || initialCommunityApps?.length);
  const [loading, setLoading] = useState(!hasInitialData);
  const [displayedTxCount, setDisplayedTxCount] = useState(initialPlatformStats?.totalTransactions ?? 0);
  const [isUrlInitialized, setIsUrlInitialized] = useState(false);
  const router = useRouter();

  // Initialize state from URL on first load
  useEffect(() => {
    if (!router.isReady || isUrlInitialized) return;

    const { category, sort, view } = router.query;

    if (category && typeof category === "string") {
      setSelectedCategory(category);
    }

    if (sort && typeof sort === "string" && (VALID_SORT_VALUES as readonly string[]).includes(sort)) {
      setActiveFilter(sort);
    }

    if (view && (view === "grid" || view === "list")) {
      setViewMode(view);
    }

    setIsUrlInitialized(true);
  }, [router.isReady, isUrlInitialized, router.query]);

  // Sync state to URL
  useEffect(() => {
    if (!router.isReady || !isUrlInitialized) return;

    const newQuery: Record<string, string | string[] | undefined> = {};

    if (selectedCategory !== "all") {
      newQuery.category = selectedCategory;
    }

    if (activeFilter !== "trending") {
      newQuery.sort = activeFilter;
    }

    if (viewMode !== "grid") {
      newQuery.view = viewMode;
    }

    router.replace(
      {
        pathname: router.pathname,
        query: newQuery,
      },
      undefined,
      { shallow: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- omit router.replace to avoid infinite re-render loop
  }, [selectedCategory, activeFilter, viewMode, isUrlInitialized, router.isReady, router.pathname]);

  // Real-time global activity feed
  const { activities } = useActivityFeed({ maxItems: 20 });

  // Fetch real stats from API (skip if SSG data already provided)
  useEffect(() => {
    if (hasInitialData) return;
    const controller = new AbortController();
    async function fetchStats() {
      try {
        const [platformRes, cardStatsRes] = await Promise.all([
          fetch("/api/platform/stats", { signal: controller.signal }),
          fetch("/api/miniapps/card-stats", { signal: controller.signal }),
        ]);

        if (platformRes.ok) {
          const data: PlatformStats = await platformRes.json();
          setPlatformStats(data);
          setDisplayedTxCount(data.totalTransactions || 0);
        }

        if (cardStatsRes.ok) {
          const { stats } = await cardStatsRes.json();
          setAppStats(stats || {});
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        // Silently handled — UI loading state covers this
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
    return () => controller.abort();
  }, [hasInitialData]);

  useEffect(() => {
    if (hasInitialData) return;
    const controller = new AbortController();
    fetch("/api/miniapps/community", { signal: controller.signal })
      .then((res) => res.json())
      .then((data) => setCommunityApps(data.apps || []))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setCommunityApps([]);
      });
    return () => controller.abort();
  }, [hasInitialData]);

  const appsWithStats = useMemo(() => {
    const byId = new Map<string, MiniAppInfo>();
    BUILTIN_APPS.forEach((app) => byId.set(app.app_id, app));
    communityApps.forEach((app) => {
      if (!byId.has(app.app_id)) {
        byId.set(app.app_id, app);
      }
    });
    return Array.from(byId.values()).map((app) => ({
      ...app,
      stats: appStats[app.app_id] || app.stats || { users: 0, transactions: 0, views: 0 },
    }));
  }, [appStats, communityApps]);

  const categories = useMemo(() => {
    const counts: Record<string, number> = { all: appsWithStats.length };
    appsWithStats.forEach((app) => {
      counts[app.category] = (counts[app.category] || 0) + 1;
    });
    return [
      { id: "all", label: t("categories.all"), icon: CATEGORY_ICONS.all, count: counts.all },
      { id: "gaming", label: t("categories.gaming"), icon: CATEGORY_ICONS.gaming, count: counts.gaming || 0 },
      { id: "defi", label: t("categories.defi"), icon: CATEGORY_ICONS.defi, count: counts.defi || 0 },
      { id: "social", label: t("categories.social"), icon: CATEGORY_ICONS.social, count: counts.social || 0 },
      { id: "nft", label: t("categories.nft"), icon: CATEGORY_ICONS.nft, count: counts.nft || 0 },
      {
        id: "governance",
        label: t("categories.governance"),
        icon: CATEGORY_ICONS.governance,
        count: counts.governance || 0,
      },
      { id: "utility", label: t("categories.utility"), icon: CATEGORY_ICONS.utility, count: counts.utility || 0 },
    ];
  }, [appsWithStats, t]);

  const filteredApps = useMemo(() => {
    // Check if activeFilter matches a recommendation section
    const recommendation = recommendationSections.find((s) => s.id === activeFilter);
    if (recommendation) {
      return (recommendation.apps || []) as MiniAppInfo[]; // Cast to bypass strict category type check
    }

    let apps =
      selectedCategory === "all" ? appsWithStats : appsWithStats.filter((app) => app.category === selectedCategory);

    if (activeFilter === "popular") {
      apps = [...apps].sort((a, b) => (b.stats?.users || 0) - (a.stats?.users || 0));
    } else if (activeFilter === "recent") {
      apps = [...apps].reverse();
    }
    // "trending" is default order (usually curated or simple list)

    return apps.slice(0, 12);
  }, [selectedCategory, activeFilter, appsWithStats, recommendationSections]);

  const totalStats = useMemo(() => {
    return {
      users: platformStats?.totalUsers || 0,
      transactions: platformStats?.totalTransactions || 0,
    };
  }, [platformStats]);

  // Platform Mode Logic - wallet only
  const { connected } = useWalletStore();
  const showDashboard = connected;

  // Filter apps for Featured Carousel (e.g., promoted or high rating)
  const featuredApps = useMemo(() => {
    return appsWithStats
      .filter((app) => app.stats?.rating && app.stats.rating >= 4.5)
      .slice(0, 5)
      .map((app) => ({
        ...app,
        banner: undefined, // Add banner here if available in MiniAppInfo
        featured: {
          highlight: "promoted" as const,
          tagline: (() => {
            const key = `apps.${app.app_id}.tagline`;
            const translated = t(key);
            return translated === key ? `${app.description.slice(0, 50)}...` : translated;
          })(),
        },
      }));
  }, [appsWithStats, t]);

  return (
    <Layout>
      <Head>
        <title>NeoHub - The Neo N3 MiniApp Ecosystem | Powered by Neo</title>
        <meta
          name="description"
          content="Discover and use secure, high-performance decentralized MiniApps on Neo N3. Powered by Neo, protected by hardware-grade TEE security."
        />
        <meta property="og:title" content="NeoHub - The Neo N3 MiniApp Ecosystem" />
        <meta
          property="og:description"
          content="Discover and use secure, high-performance decentralized MiniApps on Neo N3. Powered by Neo, protected by hardware-grade TEE security."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://miniapp.neo.org" />
        <meta property="og:image" content="https://miniapp.neo.org/og-image.png" />
        <meta property="og:site_name" content="NeoHub" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="NeoHub - The Neo N3 MiniApp Ecosystem" />
        <meta
          name="twitter:description"
          content="Discover and use secure, high-performance decentralized MiniApps on Neo N3. Powered by Neo, protected by hardware-grade TEE security."
        />
        <meta name="twitter:image" content="https://miniapp.neo.org/og-image.png" />
      </Head>

      {/* Global E-Robo Water Wave Background */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <WaterWaveBackground
          intensity={showDashboard ? "subtle" : "medium"}
          colorScheme="mixed"
          className="opacity-60"
        />
      </div>

      {showDashboard ? (
        // DASHBOARD MODE
        <div className="pt-8 px-4 pb-20 max-w-[1600px] mx-auto min-h-screen">
          {/* Featured Hero Carousel */}
          <div className="mb-12">
            <FeaturedHeroCarousel apps={featuredApps} />
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            <aside className="hidden lg:block w-72 shrink-0 space-y-8 h-fit sticky top-24">
              <div>
                <h3 className="flex items-center gap-2 font-bold text-erobo-ink dark:text-white mb-4 px-2">
                  <Filter size={18} className="text-erobo-purple" />
                  {t("miniapps.sidebar.categories")}
                </h3>
                <CategorySidebar
                  categories={categories}
                  selectedCategory={selectedCategory}
                  onSelectCategory={setSelectedCategory}
                />
              </div>

              <div>
                <h3 className="flex items-center gap-2 font-bold text-erobo-ink dark:text-white mb-4 px-2">
                  <Zap size={18} className="text-erobo-pink" />
                  {t("activity.live")}
                </h3>
                <ActivityTicker activities={activities} title={t("activity.global")} height={400} />
              </div>

              <div className="mt-6">
                <NNTNewsFeed limit={5} />
              </div>
            </aside>

            <div className="flex-1">
              <FilterBar
                filters={[
                  { id: "trending", label: t("miniapps.sort.trending") },
                  { id: "recent", label: t("miniapps.sort.recent") },
                  { id: "popular", label: t("miniapps.sort.popular") },
                  ...recommendationSections.map((s) => ({ id: s.id, label: s.title })),
                ]}
                activeFilter={activeFilter}
                onFilterChange={setActiveFilter}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
              />

              <div
                className={cn(
                  "grid gap-8",
                  viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1 gap-4",
                )}
              >
                {filteredApps.length > 0 ? (
                  filteredApps.map((app, idx) => (
                    <ScrollReveal
                      key={app.app_id}
                      animation="scale-in"
                      delay={idx * 0.05}
                      duration={0.3}
                      className="h-full"
                    >
                      {viewMode === "grid" ? <MiniAppCard app={app} /> : <MiniAppListItem app={app} />}
                    </ScrollReveal>
                  ))
                ) : (
                  <div className="col-span-full text-center py-20 text-erobo-ink-soft/70 dark:text-white/40">
                    {t("miniapps.noApps")}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // LANDING PAGE MODE
        <>
          {/* 1. Hero Section */}
          <HeroSection />

          {/* 2. Statistics Bar */}
          <div className="relative -mt-16 z-20 px-4">
            <ScrollReveal animation="fade-up" delay={0.2} offset={-50}>
              <StatsBar
                stats={[
                  {
                    label: t("stats.activeUsers"),
                    value: loading ? "..." : totalStats.users.toLocaleString(),
                    icon: Globe,
                  },
                  {
                    label: t("stats.totalTransactions"),
                    value: loading ? "..." : displayedTxCount.toLocaleString(),
                    icon: Zap,
                  },
                  {
                    label: t("stats.stakingApr"),
                    value: loading ? "..." : platformStats?.stakingApr ? `${platformStats.stakingApr}%` : "\u2014",
                    icon: Coins,
                  },
                  {
                    label: t("stats.gasBurned"),
                    value: loading
                      ? "..."
                      : platformStats?.totalGasBurned
                        ? `${parseFloat(platformStats.totalGasBurned).toFixed(2)}`
                        : "0",
                    icon: Shield,
                  },
                ]}
              />
            </ScrollReveal>
          </div>

          {/* 3. Architecture Deep Dive */}
          <ScrollReveal animation="fade-up" threshold={0.1}>
            <ArchitectureSection />
          </ScrollReveal>

          {/* 4. MiniApp Explorer Grid (Reused Logic) */}
          <section id="explore" className="py-24 px-4 bg-transparent min-h-screen relative overflow-hidden">
            {/* Background Gradients */}
            <div className="absolute top-0 left-1/4 w-96 h-96 bg-erobo-purple/10 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-erobo-peach/20 rounded-full blur-3xl pointer-events-none" />

            <div className="mx-auto max-w-[1600px] relative z-10">
              <ScrollReveal animation="fade-down">
                <div className="text-center mb-16">
                  <h2 className="text-4xl font-bold text-erobo-ink dark:text-white mb-4 tracking-tight">
                    {t("explore.title")}
                  </h2>
                  <p className="text-erobo-ink-soft/70 dark:text-white/60 max-w-2xl mx-auto">{t("explore.subtitle")}</p>
                </div>
              </ScrollReveal>

              {/* Discovery Carousel */}
              <ScrollReveal animation="scale-in" delay={0.2}>
                <div className="mb-12">
                  <DiscoveryCarousel apps={BUILTIN_APPS} />
                </div>
              </ScrollReveal>

              <div className="flex flex-col lg:flex-row gap-8">
                <aside className="hidden lg:block w-72 shrink-0 space-y-8">
                  <ScrollReveal animation="slide-right" delay={0.3}>
                    <div>
                      <h3 className="flex items-center gap-2 font-bold text-erobo-ink dark:text-white mb-4 px-2">
                        <Filter size={18} className="text-erobo-purple" />
                        {t("miniapps.sidebar.categories")}
                      </h3>
                      <CategorySidebar
                        categories={categories}
                        selectedCategory={selectedCategory}
                        onSelectCategory={setSelectedCategory}
                      />
                    </div>
                  </ScrollReveal>
                </aside>

                <div className="flex-1">
                  <ScrollReveal animation="fade-up" delay={0.4}>
                    <FilterBar
                      filters={[
                        { id: "trending", label: t("miniapps.sort.trending") },
                        { id: "recent", label: t("miniapps.sort.recent") },
                        { id: "popular", label: t("miniapps.sort.popular") },
                      ]}
                      activeFilter={activeFilter}
                      onFilterChange={setActiveFilter}
                      viewMode={viewMode}
                      onViewModeChange={setViewMode}
                    />
                  </ScrollReveal>

                  <div
                    className={cn(
                      "grid gap-8",
                      viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1 gap-4",
                    )}
                  >
                    {filteredApps.slice(0, 9).map((app, idx) => (
                      <ScrollReveal key={app.app_id} animation="scale-in" delay={idx * 0.05}>
                        {viewMode === "grid" ? <MiniAppCard app={app} /> : <MiniAppListItem app={app} />}
                      </ScrollReveal>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 5. Services Grid */}
          <ScrollReveal animation="fade-up" threshold={0.2}>
            <ServicesGrid />
          </ScrollReveal>

          {/* 6. Security Features */}
          <ScrollReveal animation="fade-up" threshold={0.2}>
            <SecurityFeatures />
          </ScrollReveal>

          {/* 7. Final Call to Action */}
          <ScrollReveal animation="scale-in" threshold={0.5}>
            <CTABuilding />
          </ScrollReveal>
        </>
      )}
    </Layout>
  );
}

/** Server-side helper: fetch platform stats directly from Supabase */
async function fetchPlatformStats(
  sbClient: import("@supabase/supabase-js").SupabaseClient,
  miniappsData: Record<string, unknown>,
  getNeoBurgerStats: (chainId: import("@/lib/chains/types").ChainId) => Promise<{ apr: string }>,
): Promise<PlatformStats> {
  function getTotalAppsCount(): number {
    let count = 0;
    for (const category of Object.values(miniappsData)) {
      if (Array.isArray(category)) count += category.length;
    }
    return count;
  }

  const { data: chainData } = await sbClient
    .from("platform_stats_by_chain")
    .select("total_users, total_transactions, total_volume_gas, total_gas_burned, active_apps")
    .limit(1)
    .single();

  const { data: platformData } = chainData
    ? { data: chainData }
    : await sbClient
        .from("platform_stats")
        .select("total_users, total_transactions, total_volume_gas, total_gas_burned, active_apps")
        .eq("id", 1)
        .single();

  let stakingApr = "0";
  try {
    const nbStats = await getNeoBurgerStats("neo-n3-mainnet");
    stakingApr = nbStats.apr;
  } catch {
    // NeoBurger unavailable at build time is acceptable
  }

  if (platformData) {
    return {
      totalUsers: platformData.total_users || 0,
      totalTransactions: platformData.total_transactions || 0,
      totalVolume: platformData.total_volume_gas || "0",
      totalGasBurned: platformData.total_gas_burned || "0",
      stakingApr,
      activeApps: getTotalAppsCount(),
    };
  }

  const { data: aggData } = await sbClient.from("miniapp_stats").select("*");
  if (!aggData?.length) {
    return {
      totalUsers: 0,
      totalTransactions: 0,
      totalVolume: "0",
      totalGasBurned: "0",
      stakingApr,
      activeApps: getTotalAppsCount(),
    };
  }

  const totals = aggData.reduce(
    (acc, row) => ({
      users: acc.users + (row.total_unique_users || 0),
      txs: acc.txs + (row.total_transactions || 0),
      volume: acc.volume + parseFloat(row.total_volume_gas || "0"),
      gasBurned: acc.gasBurned + parseFloat(row.total_gas_used || row.total_volume_gas || "0"),
    }),
    { users: 0, txs: 0, volume: 0, gasBurned: 0 },
  );

  return {
    totalUsers: totals.users,
    totalTransactions: totals.txs,
    totalVolume: totals.volume.toFixed(2),
    totalGasBurned: totals.gasBurned.toFixed(2),
    stakingApr,
    activeApps: getTotalAppsCount(),
  };
}

/** Server-side helper: fetch per-app card stats from Supabase */
async function fetchCardStats(sbClient: import("@supabase/supabase-js").SupabaseClient): Promise<AppStats> {
  const { data, error } = await sbClient
    .from("miniapp_stats_summary")
    .select("app_id, total_unique_users, total_transactions, view_count");

  if (error || !data) return {};

  const stats: AppStats = {};
  for (const row of data) {
    if (!stats[row.app_id]) {
      stats[row.app_id] = { users: 0, transactions: 0, views: 0 };
    }
    stats[row.app_id].users += row.total_unique_users || 0;
    stats[row.app_id].transactions += row.total_transactions || 0;
    stats[row.app_id].views += row.view_count || 0;
  }
  return stats;
}

/**
 * ISR: Revalidate every 5 minutes.
 * Fetches platform stats, card stats, and community apps server-side
 * so the landing page renders with real data on first paint.
 */
export const getStaticProps: GetStaticProps<LandingPageProps> = async () => {
  const { supabase: sbClient, isSupabaseConfigured } = await import("@/lib/supabase");
  const { fetchCommunityApps } = await import("@/lib/community-apps");
  const { getNeoBurgerStats } = await import("@/lib/neoburger");
  const miniappsData = (await import("@/data/miniapps.json")).default;

  const defaults: LandingPageProps = {
    initialPlatformStats: null,
    initialAppStats: {},
    initialCommunityApps: [],
  };

  if (!isSupabaseConfigured) {
    return { props: defaults, revalidate: 300 };
  }

  const [platformResult, cardStatsResult, communityResult] = await Promise.allSettled([
    fetchPlatformStats(sbClient, miniappsData, getNeoBurgerStats),
    fetchCardStats(sbClient),
    fetchCommunityApps({ status: "active" }),
  ]);

  return {
    props: {
      initialPlatformStats: platformResult.status === "fulfilled" ? platformResult.value : null,
      initialAppStats: cardStatsResult.status === "fulfilled" ? cardStatsResult.value : {},
      initialCommunityApps: communityResult.status === "fulfilled" ? communityResult.value : [],
    },
    revalidate: 300,
  };
};
