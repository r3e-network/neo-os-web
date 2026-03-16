import { useState, useMemo, useEffect } from "react";
import Head from "next/head";
import Link from "next/link";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/Button";
import { logger } from "@/lib/logger";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import { StatsBar } from "@/components/features/stats";
import { MiniAppCard, MiniAppListItem } from "@/components/features/miniapp";
import type { MiniAppInfo } from "@/components/types";
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
  Image as ImageIcon,
  Vote,
  Wrench,
  Code2,
  ChevronRight,
} from "lucide-react";
import { motion, useScroll, useTransform } from "framer-motion";

// Interface for stats from API
interface AppStats {
  [appId: string]: { users: number; transactions: number };
}

// Category definitions with icons
const CATEGORY_ICONS: Record<string, React.ComponentType<{ size?: number | string; className?: string }>> = {
  all: LayoutGrid,
  gaming: Gamepad2,
  defi: Coins,
  social: Users,
  nft: ImageIcon,
  governance: Vote,
  utility: Wrench,
};

export default function LandingPage() {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sortBy, setSortBy] = useState<"trending" | "recent" | "popular">("trending");
  const [appStats, setAppStats] = useState<AppStats>({});
  const [loading, setLoading] = useState(true);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogApps, setCatalogApps] = useState<MiniAppInfo[]>([]);
  const [displayedTxCount, setDisplayedTxCount] = useState(0);

  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 1000], [0, 200]);
  const y2 = useTransform(scrollY, [0, 1000], [0, -200]);

  // Fetch real stats from API
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/platform/stats", { signal: AbortSignal.timeout(30000) });
        if (!active) return;
        if (res.ok) {
          const data = await res.json();
          if (!active) return;
          setAppStats({
            _platform: {
              users: data.totalUsers || 0,
              transactions: data.totalTransactions || 0,
            },
          });
          setDisplayedTxCount(data.totalTransactions || 0);
        }
      } catch (err) {
        logger.error("Failed to fetch stats:", err);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/miniapps/catalog", { signal: AbortSignal.timeout(30000) });
        if (!active) return;
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        const apps = Array.isArray(data?.apps) ? data.apps : [];
        setCatalogApps(apps);
      } catch (err) {
        logger.error("Failed to fetch miniapp catalog:", err);
      } finally {
        if (active) setCatalogLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // Auto-increment transactions
  const hasTxCount = displayedTxCount > 0;
  useEffect(() => {
    if (!hasTxCount) return;
    const interval = setInterval(() => {
      const increment = Math.floor(Math.random() * 11) + 10;
      setDisplayedTxCount((prev) => prev + increment);
    }, 3000);
    return () => clearInterval(interval);
  }, [hasTxCount]);

  const appsWithStats = useMemo(() => {
    return catalogApps.map((app) => ({
      ...app,
      stats: appStats[app.app_id] || { users: 0, transactions: 0 },
    }));
  }, [appStats, catalogApps]);

  const categories = useMemo(() => {
    const counts: Record<string, number> = { all: catalogApps.length };
    catalogApps.forEach((app) => {
      counts[app.category] = (counts[app.category] || 0) + 1;
    });
    return [
      { id: "all", label: "All Apps", icon: CATEGORY_ICONS.all, count: counts.all },
      { id: "gaming", label: "Gaming", icon: CATEGORY_ICONS.gaming, count: counts.gaming || 0 },
      { id: "defi", label: "DeFi", icon: CATEGORY_ICONS.defi, count: counts.defi || 0 },
      { id: "social", label: "Social", icon: CATEGORY_ICONS.social, count: counts.social || 0 },
      { id: "nft", label: "NFT", icon: CATEGORY_ICONS.nft, count: counts.nft || 0 },
      { id: "governance", label: "Governance", icon: CATEGORY_ICONS.governance, count: counts.governance || 0 },
      { id: "utility", label: "Utility", icon: CATEGORY_ICONS.utility, count: counts.utility || 0 },
    ];
  }, [catalogApps]);

  const filteredApps = useMemo(() => {
    let apps = selectedCategory === "all" ? appsWithStats : appsWithStats.filter((app) => app.category === selectedCategory);
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
        <title>R3E Network | The Premier MiniApp Platform for Neo N3</title>
        <meta name="description" content="Discover, connect, and launch decentralized miniapps on the most secure blockchain network." />
      </Head>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-32 pb-40">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neo/10 via-background to-background dark:from-[#00E599]/10 dark:via-[#05050A] dark:to-[#05050A] -z-20" />
        
        {/* Abstract 3D Orbs/Glows */}
        <motion.div style={{ y: y1 }} className="absolute top-[10%] left-[5%] w-[400px] h-[400px] bg-neo/20 blur-[150px] rounded-full mix-blend-screen pointer-events-none" />
        <motion.div style={{ y: y2 }} className="absolute bottom-[20%] right-[5%] w-[500px] h-[500px] bg-[#7000FF]/20 blur-[150px] rounded-full mix-blend-screen pointer-events-none" />
        <div className="absolute top-[40%] left-[45%] w-[300px] h-[300px] bg-[#00D4FF]/15 blur-[120px] rounded-full pointer-events-none" />

        <div className="mx-auto max-w-7xl px-4 text-center relative z-10">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 30 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <Badge variant="outline" className="mb-8 border-neo/30 bg-white/50 dark:bg-black/30 backdrop-blur-md text-neo px-5 py-1.5 text-sm font-medium shadow-[0_0_15px_rgba(0,229,153,0.15)] neo-glow cursor-default">
              ✨ Welcome to the Intelligent Edge
            </Badge>
            <h1 className="text-5xl sm:text-6xl md:text-8xl font-black tracking-tighter text-gray-900 dark:text-white leading-[1.1]">
              The Operating System <br />
              <span className="neo-gradient-text drop-shadow-sm">For Web3</span>
            </h1>
            <p className="mx-auto mt-8 max-w-3xl text-lg sm:text-xl text-gray-600 dark:text-gray-300 font-medium leading-relaxed">
              Experience the power of Neo N3 with unified identity, zero-friction wallet connectivity, and the most
              secure execution environment for decentralized apps.
            </p>
            
            <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-5">
              <Link href="/miniapps" className="group">
                <Button size="lg" className="animated-gradient-bg text-dark-950 font-bold px-10 h-16 rounded-full text-lg shadow-[0_0_40px_rgba(0,229,153,0.4)] hover:shadow-[0_0_60px_rgba(0,229,153,0.6)] transition-all duration-300 border-none group-hover:scale-105">
                  Explore Ecosystem <Rocket className="ml-3 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" size={20} aria-hidden="true" />
                </Button>
              </Link>
              <Link href="/developer" className="group">
                <Button
                  size="lg"
                  variant="outline"
                  className="glass-panel text-gray-900 dark:text-white hover:text-neo dark:hover:text-neo font-bold px-10 h-16 rounded-full text-lg hover:bg-white/90 dark:hover:bg-white/10 transition-all duration-300 group-hover:scale-105 border-gray-200/50 dark:border-white/10"
                >
                  Start Building <Code2 className="ml-3 group-hover:rotate-12 transition-transform" width={20} height={20} aria-hidden="true" />
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Featured Statistics */}
      <div className="relative -mt-24 z-20 px-4 mb-20 max-w-7xl mx-auto">
        <StatsBar
          stats={[
            { label: "Active Users", value: loading ? "..." : totalStats.users.toLocaleString(), icon: Globe },
            { label: "Total Transactions", value: loading ? "..." : displayedTxCount.toLocaleString(), icon: Zap },
            { label: "MiniApps Live", value: catalogLoading ? "..." : String(catalogApps.length), icon: LayoutGrid },
            { label: "Categories", value: String(categories.length - 1), icon: Shield },
          ]}
        />
      </div>

      {/* Main Content Section */}
      <section className="py-16 px-4 bg-transparent min-h-screen relative z-10">
        <div className="mx-auto max-w-[1600px]">
          <div className="flex flex-col lg:flex-row gap-10">
            {/* Sidebar Filters */}
            <aside className="hidden lg:block w-72 shrink-0 space-y-8">
              <div className="sticky top-24">
                <h2 className="flex items-center gap-3 font-extrabold text-xl text-gray-900 dark:text-white mb-6 px-2">
                  <Filter size={20} aria-hidden="true" className="text-neo" />
                  Ecosystems
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
                            ? "bg-neo/15 dark:bg-neo/20 text-neo font-bold shadow-[inset_0_0_20px_rgba(0,229,153,0.1)]"
                            : "text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white",
                        )}
                      >
                        <span className="flex items-center gap-3 text-sm">
                          <Icon size={18} className={isActive ? "text-neo" : ""} aria-hidden="true" />
                          {cat.label}
                        </span>
                        <span className={cn(
                          "text-xs px-2.5 py-1 rounded-full font-semibold",
                          isActive ? "bg-neo/20 text-neo" : "bg-gray-200/50 dark:bg-white/10 text-gray-500 dark:text-gray-400",
                        )}>
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 glass-panel p-2 rounded-2xl">
                <div className="flex items-center gap-2 overflow-x-auto p-1 no-scrollbar w-full sm:w-auto">
                  {(["trending", "recent", "popular"] as const).map((opt) => (
                    <Button
                      key={opt}
                      variant="ghost"
                      onClick={() => setSortBy(opt)}
                      className={cn(
                        "h-10 rounded-xl text-sm font-bold px-6 capitalize transition-all",
                        sortBy === opt
                          ? "bg-white dark:bg-[#1A1C23] text-gray-900 dark:text-white shadow-sm"
                          : "text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5",
                      )}
                    >
                      {opt}
                    </Button>
                  ))}
                </div>

                <div className="flex items-center gap-2 px-3">
                  <div className="bg-gray-200/50 dark:bg-black/40 rounded-xl p-1.5 flex items-center border border-gray-300/30 dark:border-white/5">
                    <button
                      type="button"
                      onClick={() => setViewMode("grid")}
                      className={cn(
                        "p-2 rounded-lg transition-all focus-visible:outline-none",
                        viewMode === "grid"
                          ? "bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow"
                          : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300",
                      )}
                    >
                      <LayoutGrid size={18} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode("list")}
                      className={cn(
                        "p-2 rounded-lg transition-all focus-visible:outline-none",
                        viewMode === "list"
                          ? "bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow"
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
                  viewMode === "grid" ? "grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" : "grid-cols-1 gap-4",
                )}
              >
                {filteredApps.length > 0 ? (
                  filteredApps.map((app, idx) => (
                    <motion.div
                      key={app.app_id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-50px" }}
                      transition={{ duration: 0.5, delay: idx * 0.05 }}
                      className="group"
                    >
                      {viewMode === "grid" ? <MiniAppCard app={app} /> : <MiniAppListItem app={app} />}
                    </motion.div>
                  ))
                ) : (
                  <div className="col-span-full flex flex-col items-center justify-center py-20 text-gray-500 dark:text-gray-400 glass-panel rounded-3xl">
                    <LayoutGrid className="w-16 h-16 mb-4 text-gray-300 dark:text-gray-700" />
                    <p className="text-xl font-semibold">No apps found</p>
                    <p className="text-sm mt-2">Try adjusting your filters.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-32 px-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-neo/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-[#7000FF]/5 blur-[100px] rounded-full pointer-events-none" />

        <div className="mx-auto max-w-7xl relative z-10">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white">Why <span className="neo-gradient-text">Build on Neo N3?</span></h2>
            <p className="mt-6 text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto font-medium">
              A comprehensive toolkit for developers, bringing extreme performance and native capabilities to the web3 environment.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            <FeatureItem icon={Shield} title="Confidential TEE" desc="Run private logic in AWS Nitro enclaves where even operators can't see the data." />
            <FeatureItem icon={Zap} title="Native VRF" desc="Integrated verifiable randomness directly into the consensus layer for guaranteed fairness." />
            <FeatureItem icon={Globe} title="Oracle Network" desc="Securely access real-world data without external dependencies or heavy fees." />
            <FeatureItem icon={Cpu} title="NeoFS Storage" desc="De-centralized metadata and vast asset storage baked directly into the protocol." />
          </div>
        </div>
      </section>

      {/* Hero CTA Section */}
      <section className="py-24 px-4 pb-40">
        <div className="mx-auto max-w-6xl">
          <motion.div 
            whileHover={{ scale: 1.01 }}
            className="relative rounded-[2.5rem] animated-gradient-bg p-1 md:p-1.5 overflow-hidden shadow-[0_0_50px_rgba(0,229,153,0.3)] hover:shadow-[0_0_80px_rgba(112,0,255,0.4)] transition-all duration-700"
          >
            <div className="absolute top-0 right-0 p-12 opacity-[0.03] text-black">
              <Code2 width={340} height={340} aria-hidden="true" />
            </div>
            
            <div className="relative z-10 bg-white/95 dark:bg-[#05050A]/95 backdrop-blur-2xl rounded-[2.2rem] h-full p-10 md:p-16 flex flex-col md:flex-row items-center justify-between gap-10">
              <div className="max-w-2xl">
                <h2 className="text-4xl md:text-5xl font-black text-gray-900 dark:text-white leading-tight">
                  Supercharge Your Next <br/> Decentralized App.
                </h2>
                <p className="mt-6 text-gray-600 dark:text-gray-300 text-xl font-medium">
                  Use our React SDK to embed blockchain interactions, manage identity, and scale your application effortlessly.
                </p>
                <div className="mt-10 flex flex-wrap gap-4">
                  <Button className="bg-gray-900 border border-gray-900 dark:bg-white dark:border-white text-white dark:text-gray-950 hover:bg-gray-800 dark:hover:bg-gray-200 px-10 h-14 rounded-full text-lg font-bold transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 block sm:inline-flex items-center justify-center">
                    Get Started <ChevronRight className="ml-2 w-5 h-5" />
                  </Button>
                  <Button variant="outline" className="border-gray-200 dark:border-white/20 text-gray-900 dark:text-white bg-transparent hover:bg-gray-100 dark:hover:bg-white/10 px-8 h-14 rounded-full text-lg font-bold transition-all">
                    View Documentation
                  </Button>
                </div>
              </div>
              
              <div className="hidden lg:block relative w-64 h-64">
                 <div className="absolute inset-0 bg-neo/20 blur-[60px] rounded-full" />
                 <div className="relative h-full w-full rounded-[2rem] border border-white/20 glass-panel flex items-center justify-center group">
                    <Rocket className="w-24 h-24 text-neo group-hover:-translate-y-3 group-hover:scale-110 transition-all duration-500 ease-out" />
                 </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}

function FeatureItem({ icon: Icon, title, desc }: { icon: React.ComponentType<{ size?: number | string; className?: string }>; title: string; desc: string }) {
  return (
    <Card className="glass-card hover:border-neo/50 p-8 border border-gray-200 dark:border-white/5 bg-white/50 dark:bg-[#0C0D14]/60 text-left hover:-translate-y-2 transition-all duration-500 rounded-[2rem] group relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-neo/5 group-hover:bg-neo/10 blur-[40px] rounded-full transition-all duration-500" />
      <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 flex items-center justify-center text-gray-900 dark:text-white mb-6 group-hover:scale-110 group-hover:bg-neo group-hover:text-dark-950 group-hover:border-neo transition-all duration-500 shadow-sm relative z-10">
        <Icon size={26} aria-hidden="true" />
      </div>
      <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 relative z-10">{title}</h3>
      <p className="text-gray-600 dark:text-gray-400 text-base leading-relaxed font-medium relative z-10">{desc}</p>
    </Card>
  );
}
