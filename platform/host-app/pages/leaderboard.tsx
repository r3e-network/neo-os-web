import Head from "next/head";
import dynamic from "next/dynamic";
import { Layout, PageHero } from "@/components/layout";

const LeaderboardPageClient = dynamic(
  () =>
    import("@/components/pages/LeaderboardPageClient").then((module) => ({
      default: module.LeaderboardPageClient,
    })),
  { ssr: false },
);

export default function LeaderboardPage() {
  return (
    <Layout>
      <Head>
        <title>Leaderboard - R3E Network</title>
      </Head>
      <div className="pb-16 pt-20">
        <PageHero
          eyebrow="Community"
          title="Community Leaderboard"
          description="Track active contributors across the miniapp platform. This page focuses on participation and reputation rather than the removed platform-wide frontend statistics."
          stats={[
            {
              label: "Scope",
              value: "Community",
              hint: "Ratings, participation, reputation",
            },
            {
              label: "Platform stats",
              value: "Hidden",
              hint: "Operational metrics stay off the frontend",
            },
          ]}
        />
        <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <LeaderboardPageClient />
        </div>
      </div>
    </Layout>
  );
}
