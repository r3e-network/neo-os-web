// Database types for notification system

export interface NotificationPreferencesRow {
  id: string;
  wallet_address: string;
  email: string | null;
  email_verified: boolean;
  notify_miniapp_results: boolean;
  notify_balance_changes: boolean;
  notify_chain_alerts: boolean;
  digest_frequency: "instant" | "hourly" | "daily";
  created_at: string;
  updated_at: string;
}

export interface NotificationEventRow {
  id: string;
  wallet_address: string;
  type: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  read: boolean;
  created_at: string;
}
