import { useState, useMemo, useEffect } from "react";
import Head from "next/head";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { StatsBar } from "@/components/features/stats";
import { MiniAppCard, MiniAppListItem } from "@/components/features/miniapp";
import { NewsSection } from "@/components/features/news";
import { BUILTIN_APPS } from "@/lib/builtin-apps";
import { useTranslation } from "@/lib/i18n/react";
import { cn } from "@/lib/utils";
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
import { motion } from "framer-motion";
import { HeroSection } from "@/components/features/landing/HeroSection";
import { ArchitectureSection } from "@/components/features/landing/ArchitectureSection";
import { ServicesGrid } from "@/components/features/landing/ServicesGrid";
import { SecurityFeatures } from "@/components/features/landing/SecurityFeatures";
import { CTABuilding } from "@/components/features/landing/CTABuilding";

// Interface for stats from API
interface AppStats {
  [appId: string]: { users: number; transactions: number };
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
const CATEGORY_ICONS: Record<string, any> = {
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
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState<"trending" | "recent" | "popular">("trending");
  const [appStats, setAppStats] = useState<AppStats>({});
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayedTxCount, setDisplayedTxCount] = useState(0);

  // Fetch real stats from API
  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/platform/stats");
        if (res.ok) {
          const data: PlatformStats = await res.json();
          setPlatformStats(data);
          setAppStats({
            _platform: {
              users: data.totalUsers || 0,
              transactions: data.totalTransactions || 0,
            },
          });
          setDisplayedTxCount(data.totalTransactions || 0);
        }
      } catch (err) {
        console.error("Failed to fetch stats:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const appsWithStats = useMemo(() => {
    return BUILTIN_APPS.map((app) => ({
      ...app,
      stats: appStats[app.app_id] || { users: 0, transactions: 0 },
    }));
  }, [appStats]);

  const categories = useMemo(() => {
    const counts: Record<string, number> = { all: BUILTIN_APPS.length };
    BUILTIN_APPS.forEach((app) => {
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
  }, [t]);

  const filteredApps = useMemo(() => {
    let apps =
      selectedCategory === "all" ? appsWithStats : appsWithStats.filter((app) => app.category === selectedCategory);
    if (sortBy === "popular") {
      apps = [...apps].sort((a, b) => (b.stats?.users || 0) - (a.stats?.users || 0));
    } else if (sortBy === "recent") {
      apps = [...apps].reverse();
    }
    return apps.slice(0, 12);
  }, [selectedCategory, sortBy, appsWithStats]);

  const totalStats = useMemo(() => {
    const platformStats = appStats._platform;
    return {
      users: platformStats?.users || 0,
      transactions: platformStats?.transactions || 0,
    };
  }, [appStats]);

  return (
    <Layout>
      <Head>
        <title>NeoHub - The Premier MiniApp Ecosystem on Neo N3</title>
        <meta
          name="description"
          content="Discover and use secure, high-performance decentralized MiniApps. Protected by hardware-grade TEE security."
        />
      </Head>

      {/* 1. Hero Section */}
      <HeroSection />

      {/* 2. Statistics Bar */}
      <div className="relative -mt-16 z-20 px-4">
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
      </div>

      {/* 3. Architecture Deep Dive */}
      <ArchitectureSection />

      {/* 4. MiniApp Explorer Grid */}
      <section id="explore" className="py-24 px-4 bg-gray-50 dark:bg-dark-950/20 min-h-screen">
        <div className="mx-auto max-w-[1600px]">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold text-gray-900 dark:text-white mb-4">{t("explore.title")}</h2>
            <p className="text-slate-400 max-w-2xl mx-auto">{t("explore.subtitle")}</p>
          </div>

          <div className="flex flex-col lg:flex-row gap-8">
            <aside className="hidden lg:block w-72 shrink-0 space-y-8">
              <div>
                <h3 className="flex items-center gap-2 font-bold text-gray-900 dark:text-white mb-4 px-2">
                  <Filter size={18} />
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
                          "w-full flex items-center justify-between px-3 py-2 text-sm rounded-lg cursor-pointer transition-all",
                          isActive
                            ? "bg-neo/10 text-neo font-medium"
                            : "text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-white/5",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          <Icon size={16} />
                          {cat.label}
                        </span>
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full",
                            isActive ? "bg-neo/20 text-neo" : "bg-gray-200 dark:bg-white/10 text-gray-500",
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
                <NewsSection />
              </div>
            </aside>

            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
                <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
                  {["trending", "recent", "popular"].map((sort) => (
                    <Button
                      key={sort}
                      variant={sortBy === sort ? "outline" : "ghost"}
                      onClick={() => setSortBy(sort as any)}
                      className={cn(
                        "h-9 rounded-full text-xs font-semibold px-4",
                        sortBy === sort
                          ? "bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 shadow-sm"
                          : "text-gray-500 hover:text-gray-900 dark:hover:text-white",
                      )}
                    >
                      {t(`miniapps.sort.${sort}`)}
                    </Button>
                  ))}
                </div>
                <div className="flex items-center gap-2 ml-auto">
                  <div className="bg-gray-100 dark:bg-dark-900 rounded-xl p-1 flex items-center border border-gray-200 dark:border-white/5 shadow-inner">
                    <button
                      onClick={() => setViewMode("grid")}
                      className={cn(
                        "p-2 rounded-lg transition-all",
                        viewMode === "grid"
                          ? "bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm"
                          : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300",
                      )}
                    >
                      <LayoutGrid size={18} />
                    </button>
                    <button
                      onClick={() => setViewMode("list")}
                      className={cn(
                        "p-2 rounded-lg transition-all",
                        viewMode === "list"
                          ? "bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm"
                          : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300",
                      )}
                    >
                      <List size={18} />
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
                    <motion.div
                      key={app.app_id}
                      initial={{ opacity: 0, y: 15 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.4, delay: idx * 0.04 }}
                    >
                      {viewMode === "grid" ? <MiniAppCard app={app} /> : <MiniAppListItem app={app} />}
                    </motion.div>
                  ))
                ) : (
                  <div className="col-span-full text-center py-20 text-gray-500">{t("miniapps.noApps")}</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Services Grid */}
      <ServicesGrid />

      {/* 6. Security Features */}
      <SecurityFeatures />

      {/* 7. Final Call to Action */}
      <CTABuilding />
    </Layout>
  );
}

export const getServerSideProps = async () => ({ props: {} });
