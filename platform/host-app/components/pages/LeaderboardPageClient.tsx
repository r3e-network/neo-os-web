"use client";

import { Leaderboard } from "@/components/features/gamification";
import { useWalletStore } from "@/lib/wallet/store";

export function LeaderboardPageClient() {
  const { address } = useWalletStore();

  return <Leaderboard currentWallet={address} />;
}
