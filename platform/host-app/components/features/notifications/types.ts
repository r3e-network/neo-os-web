export interface NotificationItem {
  id: string;
  type: "miniapp_win" | "miniapp_loss" | "balance_deposit" | "balance_withdraw" | "chain_alert" | "system";
  title: string;
  content: string;
  read: boolean;
  createdAt: string;
  metadata?: {
    appId?: string;
    appName?: string;
    amount?: string;
    txHash?: string;
  };
}

export interface NotificationGroup {
  date: string;
  items: NotificationItem[];
}
