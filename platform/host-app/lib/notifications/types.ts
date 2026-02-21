// Notification system type definitions

export type NotificationType =
  | "miniapp_win"
  | "miniapp_loss"
  | "balance_deposit"
  | "balance_withdraw"
  | "chain_no_block"
  | "chain_congestion";

export type DigestFrequency = "instant" | "hourly" | "daily";

export interface NotificationPreferences {
  walletAddress: string;
  email: string | null;
  emailVerified: boolean;
  notifyMiniappResults: boolean;
  notifyBalanceChanges: boolean;
  notifyChainAlerts: boolean;
  digestFrequency: DigestFrequency;
}

export interface NotificationEvent {
  id: string;
  type: NotificationType;
  walletAddress: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  read: boolean;
}

export interface ChainHealthStatus {
  network: "testnet" | "mainnet";
  lastBlockTime: number;
  blockHeight: number;
  pendingTxCount: number;
  status: "healthy" | "warning" | "critical";
}
