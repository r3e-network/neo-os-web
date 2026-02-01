/**
 * MiniApp Statistics Types
 * Stats collected from blockchain for platform display
 */

export interface MiniAppStats {
  appId: string;
  // User metrics
  activeUsersMonthly: number;
  activeUsersWeekly: number;
  activeUsersDaily: number;
  // Transaction metrics
  totalTransactions: number;
  transactionsWeekly: number;
  transactionsDaily: number;
  // Volume metrics
  totalVolumeGas: string;
  volumeWeeklyGas: string;
  volumeDailyGas: string;
  // Rating & reviews
  rating: number;
  reviewCount: number;
  // Trends
  weeklyTrend?: number; // percentage change (optional, computed)
  // View count
  viewCount?: number;
  // Extended analytics (Full Analytics mode)
  retentionD1?: number; // Day 1 retention %
  retentionD7?: number; // Day 7 retention %
  avgSessionDuration?: number; // seconds
  funnelViewToConnect?: number; // % who connect wallet
  funnelConnectToTx?: number; // % who make transaction
  // Timestamps
  lastUpdated: number;
}

export interface MiniAppLiveStatus {
  appId: string;
  // Gaming specific
  jackpot?: string;
  playersOnline?: number;
  nextDraw?: number;
  // DeFi specific
  tvl?: string;
  apy?: number;
  volume24h?: string;
  // Governance specific
  activeProposals?: number;
  totalVotes?: number;
  quorum?: number;
}

export interface StatsCollectionResult {
  appId: string;
  success: boolean;
  stats?: MiniAppStats;
  liveStatus?: MiniAppLiveStatus;
  error?: string;
}

export interface ContractEvent {
  txHash: string;
  blockIndex: number;
  timestamp: number;
  eventName: string;
  appId: string;
  sender: string;
  amount?: string;
}
