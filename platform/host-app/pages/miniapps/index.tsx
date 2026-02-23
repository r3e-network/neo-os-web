import Head from "next/head";
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/router";
import { LayoutGrid, List, TrendingUp, Clock, Download, ChevronDown } from "lucide-react";
import { Layout } from "@/components/layout";
import { MiniAppGrid, MiniAppListItem, FilterSidebar, type MiniAppInfo } from "@/components/features/miniapp";
import { cn, sanitizeInput } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type SortOption = "trending" | "users" | "transactions" | "recent";
type ViewMode = "grid" | "list";

const sortOptions: { value: SortOption; label: string; icon: typeof TrendingUp }[] = [
  { value: "trending", label: "Trending", icon: TrendingUp },
  { value: "users", label: "Most Users", icon: Download },
  { value: "transactions", label: "Most Active", icon: TrendingUp },
  { value: "recent", label: "Recently Added", icon: Clock },
];

const filterSections = [
  {
    id: "category",
    label: "Category",
    options: [
      { value: "gaming", label: "Gaming" },
      { value: "defi", label: "DeFi" },
      { value: "social", label: "Social" },
      { value: "nft", label: "NFT" },
      { value: "governance", label: "Governance" },
      { value: "utility", label: "Utility" },
      { value: "data", label: "Data" },
      { value: "other", label: "Other" },
    ],
  },
  {
    id: "features",
    label: "Features",
    options: [
      { value: "payments", label: "Payments" },
      { value: "randomness", label: "Randomness" },
      { value: "governance", label: "Governance" },
      { value: "datafeed", label: "Data Feed" },
    ],
  },
];

type StatsMap = Record<string, { users?: number; transactions?: number; volume?: string }>;

export default function MiniAppsPage() {
  const router = useRouter();
  const rawSearchQuery = (router.query.q as string) || "";
  const searchQuery = sanitizeInput(rawSearchQuery);

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortOption>("trending");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [communityApps, setCommunityApps] = useState<MiniAppInfo[]>([]);
  const [apps, setApps] = useState<MiniAppInfo[]>([]);
  const [statsMap, setStatsMap] = useState<StatsMap>({});
  const [fetchError, setFetchError] = useState(false);
  const [loading, setLoading] = useState(true);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/miniapps/catalog", { signal: AbortSignal.timeout(30000) }).then((r) => r.json()).catch(() => null),
      fetch("/api/miniapp-stats", { signal: AbortSignal.timeout(30000) }).then((r) => r.json()).catch(() => null),
      fetch("/api/miniapps/community", { signal: AbortSignal.timeout(30000) }).then((r) => r.json()).catch(() => null),
    ]).then(([catalogData, statsData, communityData]) => {
      if (!catalogData && !communityData) setFetchError(true);
      const list = Array.isArray(catalogData?.apps) ? catalogData.apps : [];
      setApps(list);

      const statsList = Array.isArray(statsData?.stats) ? statsData.stats : Array.isArray(statsData) ? statsData : [];
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

      setCommunityApps(communityData?.apps || []);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!showSortMenu) return;

    const handleMouseDown = (event: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(event.target as Node)) {
        setShowSortMenu(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowSortMenu(false);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [showSortMenu]);

  const handleFilterChange = (sectionId: string, values: string[]) => {
    setFilters((prev) => ({ ...prev, [sectionId]: values }));
  };

  const filteredAndSortedApps = useMemo(() => {
    const appsWithStats = apps.map((app) => ({
      ...app,
      stats: statsMap[app.app_id] || app.stats,
    }));

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

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "users":
          return (b.stats?.users || 0) - (a.stats?.users || 0);
        case "transactions":
          return (b.stats?.transactions || 0) - (a.stats?.transactions || 0);
        case "recent":
          return 0; // Would need created_at field
        case "trending":
        default:
          const aScore = (a.stats?.users || 0) + (a.stats?.transactions || 0);
          const bScore = (b.stats?.users || 0) + (b.stats?.transactions || 0);
          return bScore - aScore;
      }
    });

    return result;
  }, [apps, communityApps, statsMap, searchQuery, filters, sortBy]);

  const currentSort = sortOptions.find((s) => s.value === sortBy) || sortOptions[0];

  return (
    <Layout>
      <Head>
        <title>MiniApps - R3E Network</title>
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
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">MiniApps</h1>
                <span className="text-sm text-gray-500 dark:text-gray-400">{filteredAndSortedApps.length} apps</span>
              </div>

              <div className="flex items-center gap-3">
                {/* Sort Dropdown */}
                <div ref={sortRef} className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSortMenu(!showSortMenu)}
                    aria-haspopup="listbox"
                    aria-expanded={showSortMenu}
                    aria-label="Sort options"
                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
                  >
                    <currentSort.icon size={14} />
                    {currentSort.label}
                    <ChevronDown size={14} />
                  </button>

                  {showSortMenu && (
                    <div
                      role="listbox"
                      className="absolute right-0 mt-1 w-40 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl py-1 z-50"
                    >
                      {sortOptions.map((option) => (
                        <button
                          type="button"
                          key={option.value}
                          role="option"
                          aria-selected={sortBy === option.value}
                          onClick={() => {
                            setSortBy(option.value);
                            setShowSortMenu(false);
                          }}
                          className={cn(
                            "flex items-center gap-2 w-full px-3 py-2 text-sm text-left transition-colors cursor-pointer",
                            sortBy === option.value
                              ? "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20"
                              : "text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800",
                          )}
                        >
                          <option.icon size={14} aria-hidden="true" />
                          {option.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* View Toggle */}
                <div className="flex items-center border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    aria-pressed={viewMode === "list"}
                    className={cn(
                      "p-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50",
                      viewMode === "list"
                        ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                        : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50",
                    )}
                    aria-label="List view"
                  >
                    <List size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("grid")}
                    aria-pressed={viewMode === "grid"}
                    className={cn(
                      "p-2 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50",
                      viewMode === "grid"
                        ? "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white"
                        : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50",
                    )}
                    aria-label="Grid view"
                  >
                    <LayoutGrid size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Apps List/Grid */}
          <div className="p-6">
            {fetchError && (
              <p role="alert" className="mb-4 text-sm text-red-600 dark:text-red-400">
                Failed to load apps. Please try again later.
              </p>
            )}
            {searchQuery && (
              <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
                Results for "<span className="text-gray-900 dark:text-white">{searchQuery}</span>"
              </p>
            )}

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 p-4 space-y-3">
                    <Skeleton className="h-40 w-full rounded-lg" />
                    <Skeleton className="h-5 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>
            ) : viewMode === "list" ? (
              <ul className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                {filteredAndSortedApps.map((app) => (
                  <li key={app.app_id}>
                    <MiniAppListItem app={app} />
                  </li>
                ))}
                {filteredAndSortedApps.length === 0 && (
                  <li className="py-12 text-center text-gray-500 dark:text-gray-400">No MiniApps found</li>
                )}
              </ul>
            ) : (
              <MiniAppGrid apps={filteredAndSortedApps} columns={3} />
            )}
          </div>
        </main>
      </div>
    </Layout>
  );
}
