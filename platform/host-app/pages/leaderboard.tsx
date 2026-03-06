import Head from "next/head";
import dynamic from "next/dynamic";
import { Layout } from "@/components/layout";

const LeaderboardPageClient = dynamic(
  () => import("@/components/pages/LeaderboardPageClient").then((module) => ({ default: module.LeaderboardPageClient })),
  { ssr: false },
);

export default function LeaderboardPage() {
  return (
    <Layout>
      <Head>
        <title>Leaderboard - R3E Network</title>
      </Head>
      <div className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white mb-8">Community Leaderboard</h1>
        <LeaderboardPageClient />
      </div>
    </Layout>
  );
}
