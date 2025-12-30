import Head from "next/head";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { LayoutGrid, List, TrendingUp, Clock, Download, ChevronDown } from "lucide-react";
import { Layout } from "@/components/layout";
import { MiniAppGrid, MiniAppListItem, FilterSidebar, type MiniAppInfo } from "@/components/features/miniapp";
import { BUILTIN_APPS } from "@/lib/builtin-apps";
import { getCardData } from "@/hooks/useCardData";
import { cn, sanitizeInput } from "@/lib/utils";

const categories = ["all", "gaming", "defi", "social", "nft", "governance", "utility"] as const;

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

const baseApps: MiniAppInfo[] = BUILTIN_APPS.map((app) => ({
  ...app,
  source: "builtin" as const,
}));

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
  const [apps, setApps] = useState<MiniAppInfo[]>(baseApps);
  const [statsMap, setStatsMap] = useState<StatsMap>({});

  useEffect(() => {
    setApps(baseApps.map((app) => ({ ...app, cardData: getCardData(app.app_id) })));
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
                <h1 className="text-lg font-semibold text-gray-900 dark:text-white">MiniApps</h1>
                <span className="text-sm text-gray-500 dark:text-gray-400">{filteredAndSortedApps.length} apps</span>
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
                Results for "<span className="text-gray-900 dark:text-white">{searchQuery}</span>"
              </p>
            )}

            {viewMode === "list" ? (
              <div className="bg-white dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 overflow-hidden">
                {filteredAndSortedApps.map((app) => (
                  <MiniAppListItem key={app.app_id} app={app} />
                ))}
                {filteredAndSortedApps.length === 0 && (
                  <div className="py-12 text-center text-gray-500 dark:text-gray-400">No MiniApps found</div>
                )}
              </div>
            ) : (
              <MiniAppGrid apps={filteredAndSortedApps} columns={3} />
            )}
          </div>
        </main>
      </div>
    </Layout>
  );
}

export const getServerSideProps = async () => ({ props: {} });
