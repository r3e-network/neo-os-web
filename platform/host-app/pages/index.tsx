import { useState, useMemo, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatsBar } from "@/components/features/stats";
import { MiniAppCard, MiniAppListItem, type MiniAppInfo } from "@/components/features/miniapp";
import { BUILTIN_APPS } from "@/lib/builtin-apps";
import { useTranslation } from "@/lib/i18n/react";
import {
  Rocket,
  Shield,
  Zap,
  Globe,
  Cpu,
  LayoutGrid,
  List,
  Filter,
  Gamepad2,
  Coins,
  Users,
  Image,
  Vote,
  Wrench,
  Loader2,
} from "lucide-react";
import { motion } from "framer-motion";

// Interface for stats from API
interface AppStats {
  [appId: string]: { users: number; transactions: number };
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
  const [loading, setLoading] = useState(true);
  const [displayedTxCount, setDisplayedTxCount] = useState(0);

  // Fetch real stats from API
  useEffect(() => {
    async function fetchStats() {
      try {
        // Fetch platform-wide stats from contract_events
        const res = await fetch("/api/platform/stats");
        if (res.ok) {
          const data = await res.json();
          // Use platform stats directly
          setAppStats({
            _platform: {
              users: data.totalUsers || 0,
              transactions: data.totalTransactions || 0,
            },
          });
          // Initialize displayed count
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

  // Auto-increment transactions every 3 seconds (10-20 tx)
  useEffect(() => {
    if (displayedTxCount === 0) return;
    const interval = setInterval(() => {
      const increment = Math.floor(Math.random() * 11) + 10; // 10-20
      setDisplayedTxCount((prev) => prev + increment);
    }, 3000);
    return () => clearInterval(interval);
  }, [displayedTxCount > 0]);

  // Merge BUILTIN_APPS with real stats
  const appsWithStats = useMemo(() => {
    return BUILTIN_APPS.map((app) => ({
      ...app,
      stats: appStats[app.app_id] || { users: 0, transactions: 0 },
    }));
  }, [appStats]);

  // Calculate category counts dynamically
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

    // Sort apps
    if (sortBy === "popular") {
      apps = [...apps].sort((a, b) => (b.stats?.users || 0) - (a.stats?.users || 0));
    } else if (sortBy === "recent") {
      apps = [...apps].reverse();
    }
    // Limit to 12 apps for homepage display
    return apps.slice(0, 12);
  }, [selectedCategory, sortBy, appsWithStats]);

  // Calculate total stats from platform API
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
        <title>NeoHub | The Premier MiniApp Platform for Neo N3</title>
        <meta
          name="description"
          content="Discover, connect, and launch decentralized miniapps on the most secure blockchain network."
        />
      </Head>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-20 pb-32">
        {/* Animated Background Elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full -z-10">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-neo/10 blur-[120px] rounded-full animate-pulse-slow" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-500/10 blur-[120px] rounded-full animate-pulse-slow" />
        </div>

        <div className="mx-auto max-w-7xl px-4 text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <Badge variant="outline" className="mb-6 border-neo/20 bg-neo/5 text-neo px-4 py-1">
              ✨ New: Neo N3 Testnet Phase II Live
            </Badge>
            <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 dark:text-white md:text-7xl lg:text-8xl">
              Next-Gen <br />
              <span className="neo-gradient-text">MiniApp Platform</span>
            </h1>
            <p className="mx-auto mt-8 max-w-2xl text-lg text-slate-400 md:text-xl">
              Experience the power of Neo N3 with unified identity, zero-friction wallet connectivity, and the most
              secure execution environment for decentralized apps.
            </p>
            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/miniapps">
                <Button size="lg" className="bg-neo hover:bg-neo/90 text-dark-950 font-bold px-8 h-14 rounded-2xl">
                  Explore Apps <Rocket className="ml-2" size={18} />
                </Button>
              </Link>
              <Link href="/developer">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-gray-300 dark:border-white/10 bg-white/80 dark:bg-transparent text-gray-900 dark:text-white font-bold px-8 h-14 rounded-2xl hover:bg-gray-100 dark:hover:bg-white/5"
                >
                  Developer SDK <Code2 className="ml-2" size={18} />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Featured Statistics */}
      <div className="relative -mt-16 z-10 px-4">
        <StatsBar
          stats={[
            { label: "Active Users", value: loading ? "..." : totalStats.users.toLocaleString(), icon: Globe },
            {
              label: "Total Transactions",
              value: loading ? "..." : displayedTxCount.toLocaleString(),
              icon: Zap,
            },
            { label: "MiniApps Live", value: String(BUILTIN_APPS.length), icon: LayoutGrid },
            { label: "Categories", value: String(categories.length - 1), icon: Shield },
          ]}
        />
      </div>

      {/* Main Content Section (HF Style) */}
      <section className="py-12 px-4 bg-gray-50 dark:bg-dark-950 min-h-screen">
        <div className="mx-auto max-w-[1600px]">
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Sidebar Filters */}
            <aside className="hidden lg:block w-72 shrink-0 space-y-8">
              <div>
                <h3 className="flex items-center gap-2 font-bold text-gray-900 dark:text-white mb-4 px-2">
                  <Filter size={18} />
                  Categories
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
            </aside>

            {/* Main Content */}
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
                <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0 no-scrollbar">
                  <Button
                    variant={sortBy === "trending" ? "outline" : "ghost"}
                    onClick={() => setSortBy("trending")}
                    className={cn(
                      "h-8 rounded-full text-xs font-semibold",
                      sortBy === "trending"
                        ? "bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        : "text-gray-500 hover:text-gray-900 dark:hover:text-white",
                    )}
                  >
                    Trending
                  </Button>
                  <Button
                    variant={sortBy === "recent" ? "outline" : "ghost"}
                    onClick={() => setSortBy("recent")}
                    className={cn(
                      "h-8 rounded-full text-xs font-semibold",
                      sortBy === "recent"
                        ? "bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        : "text-gray-500 hover:text-gray-900 dark:hover:text-white",
                    )}
                  >
                    Most Recent
                  </Button>
                  <Button
                    variant={sortBy === "popular" ? "outline" : "ghost"}
                    onClick={() => setSortBy("popular")}
                    className={cn(
                      "h-8 rounded-full text-xs font-semibold",
                      sortBy === "popular"
                        ? "bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
                        : "text-gray-500 hover:text-gray-900 dark:hover:text-white",
                    )}
                  >
                    Most Popular
                  </Button>
                </div>

                <div className="flex items-center gap-2 ml-auto">
                  <div className="bg-gray-100 dark:bg-dark-900 rounded-lg p-1 flex items-center border border-gray-200 dark:border-white/5">
                    <button
                      onClick={() => setViewMode("grid")}
                      className={cn(
                        "p-1.5 rounded-md transition-all",
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
                        "p-1.5 rounded-md transition-all",
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
                  "grid gap-6",
                  viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" : "grid-cols-1 gap-3",
                )}
              >
                {filteredApps.length > 0 ? (
                  filteredApps.map((app, idx) => (
                    <motion.div
                      key={app.app_id}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.3, delay: idx * 0.05 }}
                    >
                      {viewMode === "grid" ? <MiniAppCard app={app} /> : <MiniAppListItem app={app} />}
                    </motion.div>
                  ))
                ) : (
                  <div className="col-span-full text-center py-12 text-gray-500">No apps found in this category</div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-4 bg-gray-100 dark:bg-dark-950">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white">Why MiniApps on Neo?</h2>
            <p className="mt-4 text-slate-400 max-w-2xl mx-auto">
              Neo N3 provides the ultimate developer experience and user security for the next generation of web3
              applications.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureItem
              icon={Shield}
              title="Confidential TEE"
              desc="Run private logic in Intel SGX enclaves where even operators can't see the data."
            />
            <FeatureItem
              icon={Zap}
              title="VRF Randomness"
              desc="Native verifiable randomness integrated directly into the consensus layer."
            />
            <FeatureItem
              icon={Globe}
              title="Native Oracles"
              desc="Access any web2 data securely without depending on third-party oracle networks."
            />
            <FeatureItem
              icon={Cpu}
              title="Distributed Storage"
              desc="Integrated NeoFS for decentralized metadata and asset storage."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 px-4">
        <div className="mx-auto max-w-5xl">
          <div className="relative rounded-[2.5rem] bg-neo-gradient p-12 overflow-hidden shadow-2xl shadow-neo/20">
            <div className="absolute top-0 right-0 p-12 opacity-10">
              <Code2 size={240} />
            </div>
            <div className="relative z-10 max-w-2xl">
              <h2 className="text-4xl font-bold text-dark-950">Ready to build the future?</h2>
              <p className="mt-6 text-dark-950/70 text-lg font-medium">
                Our SDK makes it incredibly easy to port your existing web apps to the Neo ecosystem. Get started with
                our comprehensive documentation and templates.
              </p>
              <div className="mt-10 flex flex-wrap gap-4">
                <Button className="bg-dark-950 text-white hover:bg-dark-800 px-8 h-12 rounded-xl text-md font-bold">
                  Get Started
                </Button>
                <Button
                  variant="outline"
                  className="border-dark-950/20 text-dark-950 hover:bg-dark-950/10 px-8 h-12 rounded-xl text-md font-bold"
                >
                  View Source
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}

function FeatureItem({ icon: Icon, title, desc }: any) {
  return (
    <Card className="glass-card p-8 border-gray-200 dark:border-white/5 bg-white dark:bg-dark-900/20 text-left hover:bg-gray-50 dark:hover:bg-dark-900/40 transform hover:-translate-y-1 transition-all">
      <div className="w-12 h-12 rounded-xl bg-neo/10 flex items-center justify-center text-neo mb-6">
        <Icon size={24} />
      </div>
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">{title}</h3>
      <p className="text-gray-600 dark:text-slate-400 text-sm leading-relaxed">{desc}</p>
    </Card>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

const Code2 = (props: any) => (
  <svg
    {...props}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m18 16 4-4-4-4" />
    <path d="m6 8-4 4 4 4" />
    <path d="m14.5 4-5 16" />
  </svg>
);

export const getServerSideProps = async () => ({ props: {} });
