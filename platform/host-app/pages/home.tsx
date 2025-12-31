import Head from "next/head";
import { useState, useEffect } from "react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { StatsBar } from "@/components/features/stats";
import { MiniAppGrid, type MiniAppInfo } from "@/components/features/miniapp";
import { TwitterFeed } from "@/components/features/twitter";
import { StakingCard } from "@/components/features/staking";
import { LiveChat } from "@/components/features/chat/LiveChat";
import { useTranslation } from "@/lib/i18n/react";
import { LanguageToggle } from "@/lib/i18n/LanguageSwitcher";
import { useWalletStore } from "@/lib/wallet/store";

// Default stats (fallback)
const defaultStats = [
  { label: "Total Transactions", value: "1.2M+" },
  { label: "Active Users", value: "45K+" },
  { label: "MiniApps", value: "23" },
  { label: "Total Volume", value: "$2.5M" },
];

// Format large numbers (e.g., 1234567 -> "1.2M")
function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return String(num);
}

// MiniApp catalog
const miniApps: MiniAppInfo[] = [
  {
    app_id: "builtin-lottery",
    name: "Neo Lottery",
    description: "Decentralized lottery with provably fair randomness",
    icon: "🎰",
    category: "gaming",
    stats: { users: 12500, transactions: 45000 },
  },
  {
    app_id: "builtin-coin-flip",
    name: "Coin Flip",
    description: "50/50 coin flip - double your GAS",
    icon: "🪙",
    category: "gaming",
    stats: { users: 8900, transactions: 32000 },
  },
  {
    app_id: "builtin-dice-game",
    name: "Dice Game",
    description: "Roll the dice and win up to 6x",
    icon: "🎲",
    category: "gaming",
    stats: { users: 6700, transactions: 28000 },
  },
  {
    app_id: "builtin-prediction-market",
    name: "Prediction Market",
    description: "Trade on future outcomes",
    icon: "📊",
    category: "defi",
    stats: { users: 3200, transactions: 15000 },
  },
  {
    app_id: "builtin-red-envelope",
    name: "Red Envelope",
    description: "Send lucky GAS gifts to friends",
    icon: "🧧",
    category: "social",
    stats: { users: 5600, transactions: 22000 },
  },
  {
    app_id: "builtin-secret-vote",
    name: "Secret Vote",
    description: "Private on-chain voting",
    icon: "🗳️",
    category: "governance",
    stats: { users: 2100, transactions: 8500 },
  },
];

export default function HomePage() {
  const { t } = useTranslation("host");
  const { t: tc } = useTranslation("common");
  const { address: walletAddress } = useWalletStore();
  const [platformStats, setPlatformStats] = useState(defaultStats);

  // Fetch real platform stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/platform/stats");
        if (res.ok) {
          const data = await res.json();
          setPlatformStats([
            { label: "Total Transactions", value: formatNumber(data.totalTransactions) },
            { label: "Active Users", value: formatNumber(data.totalUsers) },
            { label: "MiniApps", value: String(data.activeApps || 23) },
            { label: "Total Volume", value: `${formatNumber(parseFloat(data.totalVolume || "0"))} GAS` },
          ]);
        }
      } catch (error) {
        console.error("Failed to fetch platform stats:", error);
      }
    };

    fetchStats();
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Layout>
      <Head>
        <title>{t("hero.title")}</title>
        <meta name="description" content={t("hero.subtitle")} />
      </Head>

      {/* Language Toggle */}
      <div className="absolute right-4 top-4 z-50">
        <LanguageToggle />
      </div>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-500 to-primary-700 py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <h1 className="text-4xl font-bold md:text-6xl">{t("hero.title")}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-primary-100">{t("hero.subtitle")}</p>
          <div className="mt-8 flex justify-center gap-4">
            <Button size="lg" className="bg-white text-primary-600 hover:bg-gray-100">
              {t("hero.exploreApps")}
            </Button>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
              {t("hero.launchApp")}
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <StatsBar stats={platformStats} />

      {/* Staking & Twitter Section */}
      <section className="py-12 bg-gray-50">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid gap-8 md:grid-cols-2">
            {/* Staking Card */}
            <div>
              <h2 className="mb-4 text-xl font-bold text-gray-900">Earn Passive Income</h2>
              <StakingCard />
            </div>
            {/* Twitter Feed */}
            <div>
              <h2 className="mb-4 text-xl font-bold text-gray-900">Latest from Neo</h2>
              <TwitterFeed />
            </div>
          </div>
        </div>
      </section>

      {/* MiniApps Section */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">
              {t("categories.all")} {tc("navigation.miniapps")}
            </h2>
            <Button variant="outline">{tc("actions.viewAll")}</Button>
          </div>
          <MiniAppGrid apps={miniApps} columns={3} />
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="mb-12 text-center text-2xl font-bold text-gray-900">{t("features.title")}</h2>
          <div className="grid gap-8 md:grid-cols-4">
            {[
              { icon: "🔒", title: t("features.secureCompute"), desc: t("features.secureComputeDesc") },
              { icon: "🎲", title: t("features.verifiableRandom"), desc: t("features.verifiableRandomDesc") },
              { icon: "📈", title: t("features.realTimeData"), desc: t("features.realTimeDataDesc") },
              { icon: "⚡", title: t("features.automatedTasks"), desc: t("features.automatedTasksDesc") },
            ].map((feature, i) => (
              <div key={i} className="rounded-xl bg-white p-6 text-center shadow-sm">
                <div className="text-4xl">{feature.icon}</div>
                <h3 className="mt-4 font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-gray-600">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live Chat - Platform-wide */}
      <LiveChat appId="platform" walletAddress={walletAddress} />
    </Layout>
  );
}

// Disable static generation for Module Federation compatibility
export const getServerSideProps = async () => {
  return { props: {} };
};
