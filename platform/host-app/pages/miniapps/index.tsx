import Head from "next/head";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { LayoutGrid, List, TrendingUp, Clock, Download, ChevronDown } from "lucide-react";
import { Layout } from "@/components/layout";
import { MiniAppGrid, MiniAppListItem, FilterSidebar } from "@/components/features/miniapp";
import type { MiniAppInfo } from "@/components/types";
import { BUILTIN_APPS } from "@/lib/builtin-apps";
import { getCardData } from "@/hooks/useCardData";
import { getAppHighlights, generateDefaultHighlights } from "@/lib/app-highlights";
import { useCollections } from "@/hooks/useCollections";
import { cn, sanitizeInput } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/react";

const categories = ["all", "gaming", "defi", "social", "nft", "governance", "utility"] as const;

type SortOption = "trending" | "users" | "transactions" | "recent";
type ViewMode = "grid" | "list";

// Sort options and filter sections are now generated inside the component using useMemo
// to support dynamic i18n translation updates

const baseApps: MiniAppInfo[] = BUILTIN_APPS.map((app) => ({
  ...app,
  source: "builtin" as const,
}));

type StatsMap = Record<string, { users?: number; transactions?: number; volume?: string }>;

export default function MiniAppsPage() {
  const router = useRouter();
  const { t } = useTranslation("host");
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
        id: "features",
        label: t("miniapps.filters.features"),
        options: [
          { value: "payments", label: t("miniapps.filters.payments") },
          { value: "randomness", label: t("miniapps.filters.randomness") },
          { value: "governance", label: t("categories.governance") },
          { value: "datafeed", label: t("miniapps.filters.datafeed") },
        ],
      },
    ],
    [t],
  );

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortOption>("trending");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [communityApps, setCommunityApps] = useState<MiniAppInfo[]>([]);
  const [apps, setApps] = useState<MiniAppInfo[]>(baseApps);
  const [statsMap, setStatsMap] = useState<StatsMap>({});
  const [displayCount, setDisplayCount] = useState(12); // Pagination: show 12 initially
  const PAGE_SIZE = 12;

  // Reset pagination when search or sort changes
  useEffect(() => {
    setDisplayCount(PAGE_SIZE);
  }, [searchQuery, sortBy]);

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
    fetch("/api/miniapp-stats")
      .then((res) => res.json())
      .then((data) => {
        const statsList = Array.isArray(data?.stats) ? data.stats : Array.isArray(data) ? data : [];
        const map: StatsMap = {};
        for (const s of statsList) {
          if (s?.app_id) {
            map[s.app_id] = {
              users: s.total_users || s.daily_active_users || 0,
              transactions: s.total_transactions || 0,
              volume: s.total_gas_used ? `${Number(s.total_gas_used).toFixed(1)} GAS` : "0 GAS",
            };
          }
        }
        setStatsMap(map);
      })
      .catch(() => setStatsMap({}));
  }, []);

  useEffect(() => {
    fetch("/api/miniapps/community")
      .then((res) => res.json())
      .then((data) => setCommunityApps(data.apps || []))
      .catch(() => setCommunityApps([]));
  }, []);

  const handleFilterChange = (sectionId: string, values: string[]) => {
    setFilters((prev) => ({ ...prev, [sectionId]: values }));
    setDisplayCount(PAGE_SIZE); // Reset pagination on filter change
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

  return (
    <Layout>
      <Head>
        <title>MiniApps - NeoHub</title>
      </Head>

      <div className="flex min-h-[calc(100vh-3.5rem)]">
        {/* Sidebar */}
        <FilterSidebar sections={filterSections} selected={filters} onChange={handleFilterChange} />

        {/* Main Content */}
        <main className="flex-1 bg-gray-50 dark:bg-gray-900">
          {/* Header */}
          <div className="sticky top-14 z-40 bg-white dark:bg-gray-950 border-b border-gray-200 dark:border-gray-800 px-6 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">{t("miniapps.title")}</h1>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {filteredAndSortedApps.length} {t("miniapps.apps")}
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Sort Dropdown */}
                <div className="relative">
                  <button
                    onClick={() => setShowSortMenu(!showSortMenu)}
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    <currentSort.icon size={14} />
                    {currentSort.label}
                    <ChevronDown size={14} />
                  </button>

                  {showSortMenu && (
                    <div className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg py-1 z-50">
                      {sortOptions.map((option) => (
                        <button
                          key={option.value}
                          onClick={() => {
                            setSortBy(option.value);
                            setShowSortMenu(false);
                          }}
                          className={cn(
                            "flex items-center gap-2 w-full px-3 py-2 text-sm text-left",
                            sortBy === option.value
                              ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
                              : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800",
                          )}
                        >
                          <option.icon size={14} />
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* View Toggle */}
                <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <button
                    onClick={() => setViewMode("list")}
                    className={cn(
                      "p-2 transition-colors",
                      viewMode === "list"
                        ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                        : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50",
                    )}
                    title="List view"
                  >
                    <List size={18} />
                  </button>
                  <button
                    onClick={() => setViewMode("grid")}
                    className={cn(
                      "p-2 transition-colors",
                      viewMode === "grid"
                        ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                        : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50",
                    )}
                    title="Card view"
                  >
                    <LayoutGrid size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Apps List/Grid */}
          <div className="p-6">
            {searchQuery && (
              <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                {t("miniapps.resultsFor")} "<span className="text-gray-900 dark:text-white">{searchQuery}</span>"
              </p>
            )}

            {viewMode === "list" ? (
              <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                {filteredAndSortedApps.slice(0, displayCount).map((app) => (
                  <MiniAppListItem key={app.app_id} app={app} />
                ))}
                {filteredAndSortedApps.length === 0 && (
                  <div className="py-12 text-center text-gray-500 dark:text-gray-400">{t("miniapps.noApps")}</div>
                )}
              </div>
            ) : (
              <MiniAppGrid apps={filteredAndSortedApps.slice(0, displayCount)} columns={3} />
            )}

            {/* Load More Button */}
            {displayCount < filteredAndSortedApps.length && (
              <div className="mt-8 text-center">
                <button
                  onClick={() => setDisplayCount((prev) => prev + PAGE_SIZE)}
                  className="px-6 py-2.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
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
