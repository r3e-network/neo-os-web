import { useState, useMemo, useEffect } from "react";
import Head from "next/head";
import { useRouter } from "next/router";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { StatsBar } from "@/components/features/stats";
import { MiniAppCard, MiniAppListItem } from "@/components/features/miniapp";
import { ActivityTicker } from "@/components/ActivityTicker";
import { useActivityFeed } from "@/hooks/useActivityFeed";
import { BUILTIN_APPS } from "@/lib/builtin-apps";
import { useTranslation } from "@/lib/i18n/react";
import { cn } from "@/lib/utils";
import type { MiniAppInfo } from "@/components/types";
import type { LucideIcon } from "lucide-react";
import {
  Shield,
  Zap,
  Globe,
  LayoutGrid,
  List,
  Filter,
  Gamepad2,
  Coins,
  Users,
  Image,
  Vote,
  Wrench,
} from "lucide-react";

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
import { useUser } from "@auth0/nextjs-auth0/client";
import { FeaturedHeroCarousel } from "@/components/features/discovery/FeaturedHeroCarousel";
import { ScrollReveal } from "@/components/ui/ScrollReveal";

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

export default function LandingPage() {
  const { t } = useTranslation("host");
  const { sections: recommendationSections } = useRecommendations();
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [activeFilter, setActiveFilter] = useState("trending");
  const [appStats, setAppStats] = useState<AppStats>({});
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [communityApps, setCommunityApps] = useState<MiniAppInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [displayedTxCount, setDisplayedTxCount] = useState(0);
  const [isUrlInitialized, setIsUrlInitialized] = useState(false);
  const router = useRouter();

  // Initialize state from URL on first load
  useEffect(() => {
    if (!router.isReady || isUrlInitialized) return;

    const { category, sort, view } = router.query;

    if (category && typeof category === "string") {
      setSelectedCategory(category);
    }

    if (sort) {
      setActiveFilter(sort as string);
    }

    if (view && (view === "grid" || view === "list")) {
      setViewMode(view);
    }

    setIsUrlInitialized(true);
  }, [router.isReady, isUrlInitialized, router.query]);

  // Sync state to URL
  useEffect(() => {
    if (!router.isReady || !isUrlInitialized) return;

    const newQuery: Record<string, string> = { ...(router.query as Record<string, string | string[] | undefined>) };

    if (selectedCategory !== "all") {
      newQuery.category = selectedCategory;
    } else {
      delete newQuery.category;
    }

    if (activeFilter !== "trending") {
      newQuery.sort = activeFilter;
    } else {
      delete newQuery.sort;
    }

    if (viewMode !== "grid") {
      newQuery.view = viewMode;
    } else {
      delete newQuery.view;
    }

    router.replace(
      {
        pathname: router.pathname,
        query: newQuery,
      },
      undefined,
      { shallow: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, activeFilter, viewMode, isUrlInitialized, router.isReady, router.pathname]);

  // Real-time global activity feed
  const { activities } = useActivityFeed({ maxItems: 20 });

  // Fetch real stats from API
  useEffect(() => {
    async function fetchStats() {
      try {
        // Fetch platform stats and per-app stats in parallel
        const [platformRes, cardStatsRes] = await Promise.all([
          fetch("/api/platform/stats"),
          fetch("/api/miniapps/card-stats"),
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
        console.error("Failed to fetch stats:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  useEffect(() => {
    fetch("/api/miniapps/community")
      .then((res) => res.json())
      .then((data) => setCommunityApps(data.apps || []))
      .catch(() => setCommunityApps([]));
  }, []);

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

  // Platform Mode Logic
  const { connected } = useWalletStore();
  const { user } = useUser();
  const showDashboard = connected || !!user;

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
      </Head>

      {/* Global E-Robo Water Wave Background */}
      <div className="fixed inset-0 -z-10 pointer-events-none">
        <WaterWaveBackground intensity={showDashboard ? "subtle" : "medium"} colorScheme="mixed" className="opacity-60" />
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
                <div className="space-y-1">
                  {categories.map((cat) => {
                    const Icon = cat.icon;
                    const isActive = selectedCategory === cat.id;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className={cn(
                          "w-full flex items-center justify-between px-4 py-3 text-sm font-bold uppercase transition-all cursor-pointer rounded-lg border",
                          isActive
                            ? "bg-erobo-purple/10 border-erobo-purple/30 text-erobo-purple shadow-[0_0_15px_rgba(159,157,243,0.15)]"
                            : "border-transparent text-erobo-ink-soft dark:text-white/60 hover:text-erobo-ink dark:hover:text-white hover:bg-erobo-peach/30 dark:hover:bg-white/5",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <Icon size={16} strokeWidth={2.5} />
                          {cat.label}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] px-2 py-0.5 rounded-full border",
                            isActive
                              ? "bg-erobo-purple/20 text-erobo-purple border-erobo-purple/30"
                              : "bg-white/70 dark:bg-white/5 text-erobo-ink-soft/70 dark:text-white/40 border-white/60 dark:border-white/10",
                          )}
                        >
                          {cat.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
                  {[
                    { id: "trending", label: t("miniapps.sort.trending") },
                    { id: "recent", label: t("miniapps.sort.recent") },
                    { id: "popular", label: t("miniapps.sort.popular") },
                    ...recommendationSections.map((s) => ({ id: s.id, label: s.title })),
                  ].map((filter) => (
                    <Button
                      key={filter.id}
                      variant="ghost"
                      onClick={() => setActiveFilter(filter.id)}
                      className={cn(
                        "h-auto rounded-full text-[10px] font-bold uppercase px-6 py-2 border transition-all hover:bg-erobo-peach/30 dark:hover:bg-white/5 whitespace-nowrap",
                        activeFilter === filter.id
                          ? "bg-erobo-purple/10 border-erobo-purple/30 text-erobo-purple shadow-sm dark:shadow-[0_0_15px_rgba(255,255,255,0.05)]"
                          : "border-transparent text-erobo-ink-soft/70 dark:text-white/50 hover:text-erobo-ink dark:hover:text-white",
                      )}
                    >
                      {filter.label}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <div className="bg-white/70 dark:bg-white/5 p-1 flex items-center border border-white/60 dark:border-white/10 rounded-full backdrop-blur-md">
                    <button
                      onClick={() => setViewMode("grid")}
                      className={cn(
                        "p-2 rounded-md transition-all",
                        viewMode === "grid"
                          ? "bg-white dark:bg-white/10 text-erobo-ink dark:text-white shadow-sm"
                          : "text-gray-400 dark:text-white/40 hover:text-erobo-ink dark:hover:text-white hover:bg-erobo-peach/30 dark:hover:bg-white/5",
                      )}
                    >
                      <LayoutGrid size={18} strokeWidth={2.5} />
                    </button>
                    <button
                      onClick={() => setViewMode("list")}
                      className={cn(
                        "p-2 rounded-md transition-all",
                        viewMode === "list"
                          ? "bg-white dark:bg-white/10 text-erobo-ink dark:text-white shadow-sm"
                          : "text-gray-400 dark:text-white/40 hover:text-erobo-ink dark:hover:text-white hover:bg-erobo-peach/30 dark:hover:bg-white/5",
                      )}
                    >
                      <List size={18} strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              </div>

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
                  { label: t("stats.activeUsers"), value: loading ? "..." : totalStats.users.toLocaleString(), icon: Globe },
                  {
                    label: t("stats.totalTransactions"),
                    value: loading ? "..." : displayedTxCount.toLocaleString(),
                    icon: Zap,
                  },
                  {
                    label: t("stats.stakingApr"),
                    value: loading ? "..." : platformStats?.stakingApr ? `${platformStats.stakingApr}%` : "19.5%",
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
                {/* Same sidebar and grid structure but purely for landing */}
                <aside className="hidden lg:block w-72 shrink-0 space-y-8">
                  <ScrollReveal animation="slide-right" delay={0.3}>
                    <div>
                      <h3 className="flex items-center gap-2 font-bold text-erobo-ink dark:text-white mb-4 px-2">
                        <Filter size={18} className="text-erobo-purple" />
                        {t("miniapps.sidebar.categories")}
                      </h3>
                      <div className="space-y-1">
                        {categories.map((cat) => {
                          const Icon = cat.icon;
                          const isActive = selectedCategory === cat.id;
                          return (
                            <button
                              key={cat.id}
                              onClick={() => setSelectedCategory(cat.id)}
                              className={cn(
                                "w-full flex items-center justify-between px-4 py-3 text-sm font-bold uppercase transition-all cursor-pointer rounded-lg border",
                                isActive
                                  ? "bg-erobo-purple/10 border-erobo-purple/30 text-erobo-purple shadow-[0_0_15px_rgba(159,157,243,0.15)]"
                                  : "border-transparent text-erobo-ink-soft dark:text-white/60 hover:text-erobo-ink dark:hover:text-white hover:bg-erobo-peach/30 dark:hover:bg-white/5",
                              )}
                            >
                              <span className="flex items-center gap-2">
                                <Icon size={16} strokeWidth={2.5} />
                                {cat.label}
                              </span>
                              <span
                                className={cn(
                                  "text-[10px] px-2 py-0.5 rounded-full border",
                                  isActive
                                    ? "bg-erobo-purple/20 text-erobo-purple border-erobo-purple/30"
                                    : "bg-white/70 dark:bg-white/5 text-erobo-ink-soft/70 dark:text-white/40 border-white/60 dark:border-white/10",
                                )}
                              >
                                {cat.count}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </ScrollReveal>
                </aside>

                <div className="flex-1">
                  {/* Same filters and grid logic */}
                  <ScrollReveal animation="fade-up" delay={0.4}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                      <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
                        {[
                          { id: "trending", label: t("miniapps.sort.trending") },
                          { id: "recent", label: t("miniapps.sort.recent") },
                          { id: "popular", label: t("miniapps.sort.popular") },
                        ].map((filter) => (
                          <Button
                            key={filter.id}
                            variant="ghost"
                            onClick={() => setActiveFilter(filter.id)}
                            className={cn(
                              "h-auto rounded-full text-[10px] font-bold uppercase px-6 py-2 border transition-all hover:bg-erobo-peach/30 dark:hover:bg-white/5 whitespace-nowrap",
                              activeFilter === filter.id
                                ? "bg-erobo-purple/10 border-erobo-purple/30 text-erobo-purple shadow-sm dark:shadow-[0_0_15px_rgba(255,255,255,0.05)]"
                                : "border-transparent text-erobo-ink-soft/70 dark:text-white/50 hover:text-erobo-ink dark:hover:text-white",
                            )}
                          >
                            {filter.label}
                          </Button>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 ml-auto">
                        {/* View Toggles */}
                        <div className="bg-white/70 dark:bg-white/5 p-1 flex items-center border border-white/60 dark:border-white/10 rounded-full backdrop-blur-md">
                          <button onClick={() => setViewMode("grid")} className={cn("p-2 rounded-md transition-all", viewMode === "grid" ? "bg-white dark:bg-white/10 text-erobo-ink dark:text-white shadow-sm" : "hover:text-erobo-ink text-gray-400 dark:text-white/40")}>
                            <LayoutGrid size={18} strokeWidth={2.5} />
                          </button>
                          <button onClick={() => setViewMode("list")} className={cn("p-2 rounded-md transition-all", viewMode === "list" ? "bg-white dark:bg-white/10 text-erobo-ink dark:text-white shadow-sm" : "hover:text-erobo-ink text-gray-400 dark:text-white/40")}>
                            <List size={18} strokeWidth={2.5} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </ScrollReveal>

                  <div className={cn("grid gap-8", viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3" : "grid-cols-1 gap-4")}>
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

export const getServerSideProps = async () => ({ props: {} });
