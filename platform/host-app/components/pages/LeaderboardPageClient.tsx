"use client";

import { Leaderboard } from "@/components/features/gamification";
import {
  selectConnectedWalletAddress,
  useWalletStore,
} from "@/lib/wallet/store";

export function LeaderboardPageClient() {
  const address = useWalletStore(selectConnectedWalletAddress);

  return <Leaderboard currentWallet={address} />;
}
