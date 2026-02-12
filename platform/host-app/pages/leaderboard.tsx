"use client";

import Head from "next/head";
import { Layout } from "@/components/layout";
import { Leaderboard } from "@/components/features/gamification";
import { useWalletStore } from "@/lib/wallet/store";

export default function LeaderboardPage() {
  const { address } = useWalletStore();

  return (
    <Layout>
      <Head>
        <title>Leaderboard - NeoHub</title>
      </Head>
      <div className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-3xl font-bold text-erobo-ink dark:text-white mb-8">Community Leaderboard</h1>
        <Leaderboard currentWallet={address} />
      </div>
    </Layout>
  );
}
