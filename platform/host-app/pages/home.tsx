import Head from "next/head";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { MiniAppGrid, type MiniAppInfo } from "@/components/features/miniapp";
import { TwitterFeed } from "@/components/features/twitter";
import { StakingCard } from "@/components/features/staking";
import { useTranslation } from "@/lib/i18n/react";

// MiniApp catalog
const miniApps: MiniAppInfo[] = [
  {
    app_id: "miniapp-last-survivor",
    name: "LastSurvivor",
    description: "Every contribution resets the timer. The last survivor wins the whole jackpot.",
    icon: "⏱️",
    category: "gaming",
  },
  {
    app_id: "miniapp-fogplay",
    name: "FogPlay",
    description: "Oracle-backed coin flips with direct GAS wagering and on-chain settlement.",
    icon: "🪙",
    category: "gaming",
  },
  {
    app_id: "miniapp-gasbox",
    name: "GASBOX",
    description: "Blind-box economy with provably fair randomness and rapid consecutive spins.",
    icon: "🎁",
    category: "gaming",
  },
  {
    app_id: "miniapp-redenvelope",
    name: "Red Envelope",
    description: "Create shareable GAS envelopes with equal-split or lucky-draw claim modes.",
    icon: "🧧",
    category: "social",
  },
  {
    app_id: "miniapp-dailycheckin",
    name: "Daily Check-in",
    description: "Build streaks, unlock badges, and claim GAS rewards every day.",
    icon: "📅",
    category: "gaming",
  },
  {
    app_id: "miniapp-self-loan",
    name: "SelfLoan",
    description: "Borrow GAS instantly against future NEO staking rewards with no liquidations.",
    icon: "🔁",
    category: "defi",
  },
  {
    app_id: "miniapp-neo-pay",
    name: "NeoPay",
    description: "Recurring GAS or NEO streams with beneficiary claims and creator cancellation.",
    icon: "💸",
    category: "defi",
  },
];

export default function HomePage() {
  const { t } = useTranslation("host");
  const { t: tc } = useTranslation("common");

  return (
    <Layout>
      <Head>
        <title>{t("hero.title")}</title>
        <meta name="description" content={t("hero.subtitle")} />
      </Head>

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-500 to-primary-700 py-20 text-white">
        <div className="mx-auto max-w-7xl px-4 text-center">
          <h1 className="text-4xl font-extrabold md:text-6xl">{t("hero.title")}</h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-primary-100">{t("hero.subtitle")}</p>
          <div className="mt-8 flex justify-center gap-4">
            <Button size="lg" className="bg-white text-primary-600 hover:bg-gray-100 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800">
              {t("hero.exploreApps")}
            </Button>
            <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
              {t("hero.launchApp")}
            </Button>
          </div>
        </div>
      </section>

      {/* Staking & Twitter Section */}
      <section className="py-12 bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4">
          <div className="grid gap-8 md:grid-cols-2">
            {/* Staking Card */}
            <div>
              <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">Earn Passive Income</h2>
              <StakingCard />
            </div>
            {/* Twitter Feed */}
            <div>
              <h2 className="mb-4 text-xl font-bold text-gray-900 dark:text-white">Latest from Neo</h2>
              <TwitterFeed />
            </div>
          </div>
        </div>
      </section>

      {/* MiniApps Section */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4">
          <div className="mb-8 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t("categories.all")} {tc("navigation.miniapps")}
            </h2>
            <Button variant="outline">{tc("actions.viewAll")}</Button>
          </div>
          <MiniAppGrid apps={miniApps} columns={3} />
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-gray-50 py-16 dark:bg-gray-900">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="mb-12 text-center text-2xl font-bold text-gray-900 dark:text-white">{t("features.title")}</h2>
          <div className="grid gap-4 md:gap-8 md:grid-cols-4">
            {[
              { icon: "🔒", title: t("features.secureCompute"), desc: t("features.secureComputeDesc") },
              { icon: "🎲", title: t("features.verifiableRandom"), desc: t("features.verifiableRandomDesc") },
              { icon: "📈", title: t("features.realTimeData"), desc: t("features.realTimeDataDesc") },
              { icon: "⚡", title: t("features.automatedTasks"), desc: t("features.automatedTasksDesc") },
            ].map((feature, i) => (
              <div key={i} className="rounded-xl bg-white p-6 text-center shadow-sm dark:bg-gray-800">
                <div className="text-4xl">{feature.icon}</div>
                <h3 className="mt-4 font-semibold text-gray-900 dark:text-white">{feature.title}</h3>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Layout>
  );
}

// Disable static generation for Module Federation compatibility
export const getServerSideProps = async () => {
  return { props: {} };
};
