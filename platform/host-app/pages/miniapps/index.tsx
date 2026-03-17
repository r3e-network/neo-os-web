import Head from "next/head";
import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/router";
import { LayoutGrid, List, Clock, ChevronDown, Star, ArrowDownAZ } from "lucide-react";
import { Layout } from "@/components/layout";
import { MiniAppGrid, MiniAppListItem, FilterSidebar, type MiniAppInfo } from "@/components/features/miniapp";
import { cn, sanitizeInput } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

type SortOption = "featured" | "name" | "recent";
type ViewMode = "grid" | "list";

const sortOptions: { value: SortOption; label: string; icon: typeof Star }[] = [
  { value: "featured", label: "Featured", icon: Star },
  { value: "name", label: "A to Z", icon: ArrowDownAZ },
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

export default function MiniAppsPage() {
  const router = useRouter();
  const rawSearchQuery = (router.query.q as string) || "";
  const searchQuery = sanitizeInput(rawSearchQuery);

  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [sortBy, setSortBy] = useState<SortOption>("featured");
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [communityApps, setCommunityApps] = useState<MiniAppInfo[]>([]);
  const [apps, setApps] = useState<MiniAppInfo[]>([]);
  const [fetchError, setFetchError] = useState(false);
  const [loading, setLoading] = useState(true);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/miniapps/catalog", { signal: AbortSignal.timeout(30000) }).then((r) => r.json()).catch(() => null),
      fetch("/api/miniapps/community", { signal: AbortSignal.timeout(30000) }).then((r) => r.json()).catch(() => null),
    ]).then(([catalogData, communityData]) => {
      if (!catalogData && !communityData) setFetchError(true);
      const list = Array.isArray(catalogData?.apps) ? catalogData.apps : [];
      setApps(list);
      const communityList = Array.isArray(communityData?.apps) ? communityData.apps : [];
      setCommunityApps(communityList);
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
    let result = [...apps, ...communityApps];

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
        case "name":
          return a.name.localeCompare(b.name);
        case "recent":
          return 0; // Would need created_at field
        case "featured":
        default:
          return 0;
      }
    });

    return result;
  }, [apps, communityApps, searchQuery, filters, sortBy]);

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
        <main className="flex-1 bg-transparent relative">
          <div className="absolute inset-0 bg-gradient-to-br from-black/5 to-transparent dark:from-white/0 dark:to-transparent pointer-events-none -z-10" />
          {/* Header */}
          <div className="sticky top-16 z-40 bg-white/80 dark:bg-[#05050A]/80 backdrop-blur-2xl border-b border-gray-200/50 dark:border-white/10 px-6 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white border border-gray-200/80 dark:border-white/10 rounded-xl bg-white/50 dark:bg-white/5 backdrop-blur-md hover:bg-gray-100 dark:hover:bg-white/10 hover:border-neo/40 transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo"
                  >
                    <currentSort.icon size={16} className="text-neo" />
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
                <div className="flex items-center border border-gray-200/80 dark:border-white/10 rounded-xl overflow-hidden bg-white/50 dark:bg-white/5 backdrop-blur-md p-1">
                  <button
                    type="button"
                    onClick={() => setViewMode("list")}
                    aria-pressed={viewMode === "list"}
                    className={cn(
                      "p-1.5 rounded-lg transition-all cursor-pointer focus-visible:outline-none",
                      viewMode === "list"
                        ? "bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm"
                        : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5",
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
                      "p-1.5 rounded-lg transition-all cursor-pointer focus-visible:outline-none",
                      viewMode === "grid"
                        ? "bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm"
                        : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5",
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
                  <div key={i} className="glass-card rounded-3xl p-6 space-y-4">
                    <Skeleton className="h-40 w-full rounded-2xl bg-gray-200/50 dark:bg-white/5 animate-pulse" />
                    <Skeleton className="h-6 w-3/4 rounded-lg bg-gray-200/50 dark:bg-white/5 animate-pulse" />
                    <Skeleton className="h-4 w-1/2 rounded-lg bg-gray-200/50 dark:bg-white/5 animate-pulse" />
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
