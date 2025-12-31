import Head from "next/head";
import { useState, useEffect, useMemo } from "react";
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
import { BUILTIN_APPS } from "@/lib/builtin-apps";

// Format large numbers (e.g., 1234567 -> "1.2M")
function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return String(num);
}

// Featured apps for homepage (first 6 from BUILTIN_APPS)
const featuredApps = BUILTIN_APPS.slice(0, 6);

export default function HomePage() {
  const { t } = useTranslation("host");
  const { t: tc } = useTranslation("common");
  const { address: walletAddress } = useWalletStore();

  // Stats state - null means loading
  const [platformStats, setPlatformStats] = useState<{ label: string; value: string }[] | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);

  // Fetch real platform stats from API
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setStatsError(null);
        const res = await fetch("/api/platform/stats");
        if (!res.ok) {
          throw new Error(`API error: ${res.status}`);
        }
        const data = await res.json();
        setPlatformStats([
          { label: t("detail.totalTransactions"), value: formatNumber(data.totalTransactions) },
          { label: t("detail.activeUsers"), value: formatNumber(data.totalUsers) },
          { label: t("detail.stakingApr"), value: `${data.stakingApr}%` },
          { label: t("detail.gasBurned"), value: `${formatNumber(parseFloat(data.totalGasBurned))} GAS` },
        ]);
      } catch (error) {
        console.error("Failed to fetch platform stats:", error);
        setStatsError("Failed to load stats");
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [t]);

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
      {statsError ? (
        <div className="mx-auto max-w-7xl px-4 py-4 text-center text-red-500">{statsError}</div>
      ) : platformStats ? (
        <StatsBar stats={platformStats} />
      ) : (
        <div className="mx-auto max-w-7xl px-4 py-8 text-center text-gray-500">Loading stats...</div>
      )}

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
          <MiniAppGrid apps={featuredApps} columns={3} />
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
