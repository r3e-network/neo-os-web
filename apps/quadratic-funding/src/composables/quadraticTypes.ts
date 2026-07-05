export interface ProjectItem {
  id: string; roundId: string; owner: string; name: string; description: string; link: string;
  totalContributed: bigint; contributorCount: bigint; matchedAmount: bigint; active: boolean; claimed: boolean; status?: string;
}

export interface RoundItem {
  id: string;
  creator: string;
  assetSymbol: string;
  matchingPool: bigint;
  matchingRemaining: bigint;
  totalContributed: bigint;
  projectCount: bigint;
  startTime: number;
  endTime: number;
  status: string;
  title: string;
  description: string;
  finalized?: boolean;
  cancelled?: boolean;
}
