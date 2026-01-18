import Head from "next/head";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useRouter } from "next/router";
import { LayoutGrid, List, TrendingUp, Clock, Download, ChevronDown, Rocket } from "lucide-react";
import { Layout } from "@/components/layout";
import { MiniAppGrid, MiniAppListItem, FilterSidebar } from "@/components/features/miniapp";
import { FeaturedHeroCarousel, type FeaturedApp } from "@/components/features/discovery/FeaturedHeroCarousel";
import type { MiniAppInfo } from "@/components/types";
import { BUILTIN_APPS } from "@/lib/builtin-apps";
import { getCardData } from "@/hooks/useCardData";
import { getAppHighlights, generateDefaultHighlights } from "@/lib/app-highlights";
import { useCollections } from "@/hooks/useCollections";
import { cn, sanitizeInput } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/react";
import { WaterWaveBackground } from "@/components/ui/WaterWaveBackground";
import { getChainRegistry } from "@/lib/chains/registry";
import { PREDEFINED_TAGS, APP_TAGS } from "@/components/features/tags";
import { getLocalizedField } from "@neo/shared/i18n";

const categories = ["all", "gaming", "defi", "social", "nft", "governance", "utility"] as const;

type SortOption = "trending" | "users" | "transactions" | "recent";
type ViewMode = "grid" | "list";

// Sort options and filter sections are now generated inside the component using useMemo
// to support dynamic i18n translation updates

const baseApps: MiniAppInfo[] = BUILTIN_APPS.map((app) => ({
  ...app,
  source: "builtin" as const,
}));

type StatsMap = Record<string, { users?: number; transactions?: number; volume?: string; views?: number }>;

export default function MiniAppsPage() {
  const router = useRouter();
  const { t, locale } = useTranslation("host");
  const rawSearchQuery = (router.query.q as string) || "";
  const searchQuery = sanitizeInput(rawSearchQuery);

  // Dynamic sort options with i18n support
  const sortOptions = useMemo(
    () => [
      { value: "trending" as SortOption, label: t("miniapps.sort.trending"), icon: TrendingUp },
      { value: "users" as SortOption, label: t("miniapps.sort.users"), icon: Download },
      { value: "transactions" as SortOption, label: t("miniapps.sort.transactions"), icon: TrendingUp },
      { value: "recent" as SortOption, label: t("miniapps.sort.recent"), icon: Clock },
    ],
    [t],
  );

  // Dynamic filter sections with i18n support
  const filterSections = useMemo(
    () => [
      {
        id: "category",
        label: t("miniapps.filters.category"),
        options: [
          { value: "gaming", label: t("categories.gaming") },
          { value: "defi", label: t("categories.defi") },
          { value: "social", label: t("categories.social") },
          { value: "nft", label: t("categories.nft") },
          { value: "governance", label: t("categories.governance") },
          { value: "utility", label: t("categories.utility") },
        ],
      },
      {
        id: "chains",
        label: t("miniapps.filters.chains"),
        options: getChainRegistry()
          .getActiveChains()
          .map((chain) => ({
            value: chain.id,
            label: chain.name,
          })),
      },
      {
        id: "features",
        label: t("miniapps.filters.features"),
        options: [
          { value: "payments", label: t("miniapps.filters.payments") },
          { value: "rng", label: t("miniapps.filters.randomness") },
          { value: "governance", label: t("categories.governance") },
          { value: "datafeed", label: t("miniapps.filters.datafeed") },
        ],
      },
      {
        id: "tags",
        label: t("miniapps.filters.tags"),
        options: PREDEFINED_TAGS.map((tag) => ({
          value: tag.id,
          label: getLocalizedField(tag, "name", locale),
        })),
      },
    ],
    [t, locale],
  );

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortOption>("trending");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [communityApps, setCommunityApps] = useState<MiniAppInfo[]>([]);
  const [apps, setApps] = useState<MiniAppInfo[]>(baseApps);
  const [statsMap, setStatsMap] = useState<StatsMap>({});
  const [displayCount, setDisplayCount] = useState(12); // Pagination: show 12 initially
  const [isUrlInitialized, setIsUrlInitialized] = useState(false);
  const [isDataReady, setIsDataReady] = useState(false);
  const PAGE_SIZE = 12;
  const scrollRestoredRef = useRef(false);

  // Initialize state from URL on first load
  useEffect(() => {
    if (!router.isReady || isUrlInitialized) return;

    const { category, features, chains, tags, tag, sort, view } = router.query;

    const newFilters: Record<string, string[]> = {};
    if (category) {
      newFilters.category = Array.isArray(category) ? category : [category];
    }
    if (features) {
      newFilters.features = Array.isArray(features) ? features : [features];
    }
    if (chains) {
      newFilters.chains = Array.isArray(chains) ? chains : [chains];
    }
    // Handle both 'tags' (multiple) and 'tag' (single from detail page)
    if (tags) {
      newFilters.tags = Array.isArray(tags) ? tags : [tags];
    } else if (tag) {
      newFilters.tags = Array.isArray(tag) ? tag : [tag];
    }

    if (Object.keys(newFilters).length > 0) {
      setFilters(newFilters);
    }

    const sortValue = Array.isArray(sort) ? sort[0] : sort;
    if (
      sortValue &&
      (sortValue === "trending" || sortValue === "users" || sortValue === "transactions" || sortValue === "recent")
    ) {
      setSortBy(sortValue as SortOption);
    }

    const viewValue = Array.isArray(view) ? view[0] : view;
    if (viewValue && (viewValue === "grid" || viewValue === "list")) {
      setViewMode(viewValue as ViewMode);
    }

    setIsUrlInitialized(true);
  }, [router.isReady, isUrlInitialized, router.query]);

  // Sync state to URL when filters, sortBy, or viewMode change
  useEffect(() => {
    if (!router.isReady || !isUrlInitialized) return;

    const newQuery: Record<string, string | string[] | undefined> = { ...router.query };

    // Update filters
    if (filters.category?.length) {
      newQuery.category = filters.category;
    } else {
      delete newQuery.category;
    }

    if (filters.features?.length) {
      newQuery.features = filters.features;
    } else {
      delete newQuery.features;
    }

    if (filters.chains?.length) {
      newQuery.chains = filters.chains;
    } else {
      delete newQuery.chains;
    }

    if (filters.tags?.length) {
      newQuery.tags = filters.tags;
    } else {
      delete newQuery.tags;
    }
    // Remove single 'tag' param if present (converted to 'tags')
    delete newQuery.tag;

    // Update sort
    if (sortBy !== "trending") {
      newQuery.sort = sortBy;
    } else {
      delete newQuery.sort;
    }

    // Update view
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
      { shallow: true, scroll: false },
    );
  }, [filters, sortBy, viewMode, isUrlInitialized, router.isReady, router.pathname]);

  // Reset pagination only when search changes
  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [searchQuery]);

  // Restore pagination state on mount to support scroll restoration
  useEffect(() => {
    const savedCount = sessionStorage.getItem("miniapps-display-count");
    if (savedCount) {
      const count = parseInt(savedCount, 10);
      if (count > PAGE_SIZE) {
        setDisplayCount(count);
      }
    }
  }, []);

  // Persist pagination state
  useEffect(() => {
    sessionStorage.setItem("miniapps-display-count", displayCount.toString());
  }, [displayCount]);

  // Save scroll position before navigation
  useEffect(() => {
    const handleBeforeUnload = () => {
      sessionStorage.setItem("miniapps-scroll-position", window.scrollY.toString());
    };

    // Save on route change
    router.events.on("routeChangeStart", handleBeforeUnload);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      router.events.off("routeChangeStart", handleBeforeUnload);
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [router.events]);

  // Restore scroll position after data is ready
  useEffect(() => {
    if (!isDataReady || scrollRestoredRef.current) return;

    const savedPosition = sessionStorage.getItem("miniapps-scroll-position");
    if (savedPosition) {
      const position = parseInt(savedPosition, 10);
      if (position > 0) {
        // Use requestAnimationFrame to ensure DOM is ready
        requestAnimationFrame(() => {
          window.scrollTo(0, position);
          scrollRestoredRef.current = true;
        });
      }
    }
    scrollRestoredRef.current = true;
  }, [isDataReady]);

  useEffect(() => {
    setApps(
      baseApps.map((app) => ({
        ...app,
        cardData: getCardData(app.app_id),
        highlights: getAppHighlights(app.app_id),
      })),
    );
  }, []);

  useEffect(() => {
    // Try to restore cached stats first
    const cachedStats = sessionStorage.getItem("miniapps-stats-cache");
    if (cachedStats) {
      try {
        const parsed = JSON.parse(cachedStats);
        if (parsed && typeof parsed === "object") {
          setStatsMap(parsed);
          setIsDataReady(true);
        }
      } catch {
        // Ignore parse errors
      }
    }

    // Fetch fresh stats from card-stats API (same as homepage)
    fetch("/api/miniapps/card-stats")
      .then((res) => res.json())
      .then((data) => {
        const statsObj = data?.stats || {};
        const map: StatsMap = {};
        for (const [appId, s] of Object.entries(statsObj)) {
          const stat = s as { users?: number; transactions?: number; views?: number };
          map[appId] = {
            users: stat.users || 0,
            transactions: stat.transactions || 0,
            views: stat.views || 0,
          };
        }
        setStatsMap(map);
        setIsDataReady(true);
        // Cache stats for navigation
        sessionStorage.setItem("miniapps-stats-cache", JSON.stringify(map));
      })
      .catch(() => {
        setStatsMap({});
        setIsDataReady(true);
      });
  }, []);

  useEffect(() => {
    fetch("/api/miniapps/community")
      .then((res) => res.json())
      .then((data) => setCommunityApps(data.apps || []))
      .catch(() => setCommunityApps([]));
  }, []);

  const handleFilterChange = (sectionId: string, values: string[]) => {
    setFilters((prev) => ({ ...prev, [sectionId]: values }));
  };

  const { collectionsSet } = useCollections();

  const filteredAndSortedApps = useMemo(() => {
    const appsWithStats = apps.map((app) => {
      const stats = statsMap[app.app_id] || app.stats;
      return {
        ...app,
        stats,
        // Use configured highlights or generate from stats as fallback
        highlights: app.highlights || generateDefaultHighlights(stats),
      };
    });

    let result = [...appsWithStats, ...communityApps];

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (app) =>
          app.name.toLowerCase().includes(q) ||
          app.description.toLowerCase().includes(q) ||
          app.category.toLowerCase().includes(q),
      );
    }

    // Category filter
    if (filters.category?.length) {
      result = result.filter((app) => filters.category.includes(app.category));
    }

    // Features filter
    if (filters.features?.length) {
      result = result.filter((app) => {
        const appFeatures = app.features || [];
        return filters.features.some((f: string) => appFeatures.includes(f));
      });
    }

    // Chains filter
    if (filters.chains?.length) {
      result = result.filter((app) => {
        const appChains = app.supportedChains || [];
        // Apps must explicitly declare supported chains
        if (appChains.length === 0) return false;
        return filters.chains.some((c: string) => appChains.includes(c));
      });
    }

    // Tags filter - match apps that have any of the selected tags
    if (filters.tags?.length) {
      result = result.filter((app) => {
        const appTags = APP_TAGS[app.app_id] || [];
        if (appTags.length === 0) return false;
        return filters.tags.some((t: string) => appTags.includes(t));
      });
    }

    // Sort
    result.sort((a, b) => {
      // Collected apps always come first
      const aCollected = collectionsSet.has(a.app_id) ? 1 : 0;
      const bCollected = collectionsSet.has(b.app_id) ? 1 : 0;
      if (aCollected !== bCollected) return bCollected - aCollected;

      switch (sortBy) {
        case "users":
          return (b.stats?.users || 0) - (a.stats?.users || 0);
        case "transactions":
          return (b.stats?.transactions || 0) - (a.stats?.transactions || 0);
        case "recent":
          const aDate = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bDate = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bDate - aDate;
        case "trending":
        default:
          const aScore = (a.stats?.users || 0) + (a.stats?.transactions || 0);
          const bScore = (b.stats?.users || 0) + (b.stats?.transactions || 0);
          return bScore - aScore;
      }
    });

    return result;
  }, [apps, communityApps, statsMap, searchQuery, filters, sortBy, collectionsSet]);

  const currentSort = sortOptions.find((s) => s.value === sortBy) || sortOptions[0];

  // Generate featured apps from top trending apps (Steam-style hero carousel)
  const featuredApps = useMemo((): FeaturedApp[] => {
    // Select top 5 apps by trending score for the featured carousel
    const topApps = [...apps]
      .map((app) => {
        const stats = statsMap[app.app_id] || app.stats;
        return { ...app, stats };
      })
      .sort((a, b) => {
        const aScore = (a.stats?.users || 0) + (a.stats?.transactions || 0);
        const bScore = (b.stats?.users || 0) + (b.stats?.transactions || 0);
        return bScore - aScore;
      })
      .slice(0, 5);

    return topApps.map((app, index) => ({
      app_id: app.app_id,
      name: app.name,
      name_zh: app.name_zh,
      description: app.description,
      description_zh: app.description_zh,
      category: app.category as FeaturedApp["category"],
      icon: app.icon,
      banner: app.banner,
      supportedChains: app.supportedChains,
      stats: {
        users: app.stats?.users || 0,
        transactions: app.stats?.transactions || 0,
        rating: 4.5 + Math.random() * 0.5, // Placeholder rating
        reviews: Math.floor(Math.random() * 500) + 50,
      },
      featured: {
        tagline: app.tagline,
        tagline_zh: app.tagline_zh,
        highlight: index === 0 ? "trending" : index === 1 ? "popular" : index < 3 ? "new" : undefined,
      },
    }));
  }, [apps, statsMap]);

  return (
    <Layout>
      <Head>
        <title>MiniApps - NeoHub</title>
      </Head>

      <div className="flex min-h-[calc(100vh-3.5rem)] bg-transparent relative">
        {/* E-Robo Water Wave Background */}
        <WaterWaveBackground intensity="medium" colorScheme="mixed" className="opacity-70 z-0" />

        {/* Sidebar */}
        <FilterSidebar sections={filterSections} selected={filters} onChange={handleFilterChange} />

        {/* Main Content */}
        <main className="flex-1 w-0 relative z-10">
          {/* Header */}
          <div className="sticky top-16 z-40 bg-white/70 dark:bg-[#0b0c16]/90 backdrop-blur-xl border-b border-white/60 dark:border-erobo-purple/10 px-8 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-erobo-purple/10 flex items-center justify-center">
                <Rocket size={24} className="text-erobo-purple" strokeWidth={2} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-erobo-ink dark:text-white">{t("miniapps.title")}</h1>
                <span className="text-sm text-erobo-ink-soft/70 dark:text-gray-400">
                  {filteredAndSortedApps.length} {t("miniapps.apps")}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Sort Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowSortMenu(!showSortMenu)}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-erobo-ink-soft dark:text-gray-300 border border-white/60 dark:border-white/10 bg-white/70 dark:bg-white/5 rounded-full hover:bg-erobo-peach/30 dark:hover:bg-white/10 transition-all"
                >
                  <currentSort.icon size={16} strokeWidth={2} />
                  {currentSort.label}
                  <ChevronDown
                    size={16}
                    strokeWidth={2}
                    className={cn("transition-transform text-gray-400", showSortMenu && "rotate-180")}
                  />
                </button>

                {showSortMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white/90 dark:bg-[#0b0c16] border border-white/60 dark:border-erobo-purple/20 rounded-2xl shadow-lg py-1 z-50">
                    {sortOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => {
                          setSortBy(option.value);
                          setShowSortMenu(false);
                        }}
                        className={cn(
                          "flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors text-left",
                          sortBy === option.value
                            ? "bg-erobo-purple/10 text-erobo-purple"
                            : "text-erobo-ink-soft dark:text-gray-400 hover:bg-erobo-peach/30 dark:hover:bg-white/5 hover:text-erobo-ink dark:hover:text-white",
                        )}
                      >
                        <option.icon size={16} strokeWidth={2} />
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* View Toggle */}
              <div className="flex items-center border border-white/60 dark:border-erobo-purple/20 rounded-full bg-white/70 dark:bg-white/5 overflow-hidden">
                <button
                  onClick={() => setViewMode("list")}
                  className={cn(
                    "p-2 transition-all",
                    viewMode === "list"
                      ? "bg-erobo-purple/10 text-erobo-purple"
                      : "text-gray-400 hover:text-erobo-ink dark:hover:text-white hover:bg-erobo-peach/30 dark:hover:bg-white/10",
                  )}
                  title="List view"
                >
                  <List size={18} strokeWidth={2} />
                </button>
                <button
                  onClick={() => setViewMode("grid")}
                  className={cn(
                    "p-2 transition-all",
                    viewMode === "grid"
                      ? "bg-erobo-purple/10 text-erobo-purple"
                      : "text-gray-400 hover:text-erobo-ink dark:hover:text-white hover:bg-erobo-peach/30 dark:hover:bg-white/10",
                  )}
                  title="Card view"
                >
                  <LayoutGrid size={18} strokeWidth={2} />
                </button>
              </div>
            </div>
          </div>

          {/* Apps List/Grid */}
          <div className="p-8">
            {/* Steam-style Featured Hero Carousel - only show when not searching */}
            {!searchQuery && featuredApps.length > 0 && (
              <div className="mb-10">
                <FeaturedHeroCarousel apps={featuredApps} autoPlayInterval={6000} />
              </div>
            )}

            {searchQuery && (
              <p className="mb-6 text-base text-erobo-ink-soft/70 dark:text-gray-400">
                {t("miniapps.resultsFor")} "
                <span className="text-erobo-ink dark:text-white font-medium bg-erobo-peach/40 px-1.5 py-0.5 rounded-full">
                  {searchQuery}
                </span>
                "
              </p>
            )}

            {viewMode === "list" ? (
              <div className="space-y-3">
                {filteredAndSortedApps.slice(0, displayCount).map((app) => (
                  <MiniAppListItem key={app.app_id} app={app} />
                ))}
                {filteredAndSortedApps.length === 0 && (
                  <div className="py-16 text-center text-erobo-ink-soft/70 dark:text-gray-400 text-base">
                    {t("miniapps.noApps")}
                  </div>
                )}
              </div>
            ) : (
              <MiniAppGrid key={locale} apps={filteredAndSortedApps.slice(0, displayCount)} columns={3} />
            )}

            {/* Load More Button */}
            {displayCount < filteredAndSortedApps.length && (
              <div className="mt-12 text-center">
                <button
                  onClick={() => setDisplayCount((prev) => prev + PAGE_SIZE)}
                  className="px-6 py-2.5 text-sm font-medium text-erobo-ink-soft dark:text-gray-300 bg-white/70 dark:bg-white/5 border border-white/60 dark:border-erobo-purple/20 rounded-full hover:bg-erobo-peach/30 dark:hover:bg-white/10 hover:border-erobo-purple/40 hover:shadow-[0_0_20px_rgba(159,157,243,0.2)] transition-all"
                >
                  {t("miniapps.loadMore")} ({filteredAndSortedApps.length - displayCount} {t("miniapps.remaining")})
                </button>
              </div>
            )}
          </div>
        </main>
      </div>
    </Layout>
  );
}

export const getServerSideProps = async () => ({ props: {} });
