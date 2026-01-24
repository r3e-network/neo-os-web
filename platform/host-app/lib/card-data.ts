import type { ChainId } from "@/lib/chains/types";

export type CountdownData = {
  endTime: number;
  jackpot: string;
  participants: number;
};

export type MultiplierData = {
  multiplier: number;
  players: number;
};

export type StatsData = {
  tvl: string;
  volume24h: string;
  users: number;
};

export type VotingData = {
  title: string;
  options: { label: string; percentage: number }[];
  totalVotes: number;
};

export async function getCountdownData(_appId: string, _chainId: ChainId): Promise<CountdownData> {
  return {
    endTime: Date.now(),
    jackpot: "0",
    participants: 0,
  };
}

export async function getMultiplierData(_appId: string, _chainId: ChainId): Promise<MultiplierData> {
  return {
    multiplier: 1,
    players: 0,
  };
}

export async function getStatsData(_appId: string, _chainId: ChainId): Promise<StatsData> {
  return {
    tvl: "0",
    volume24h: "0",
    users: 0,
  };
}

export async function getVotingData(_appId: string, _chainId: ChainId): Promise<VotingData> {
  return {
    title: "",
    options: [],
    totalVotes: 0,
  };
}
