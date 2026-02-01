// =============================================================================
// Admin Console Type Definitions
// =============================================================================

export type ServiceStatus = "healthy" | "unhealthy" | "unknown";

export interface ServiceHealth {
  name: string;
  status: ServiceStatus;
  url: string;
  lastCheck: string;
  version?: string;
  uptime?: number;
  error?: string;
}

export interface MiniApp {
  app_id: string;
  developer_user_id: string;
  manifest_hash: string;
  entry_url: string;
  developer_pubkey: string;
  permissions: Record<string, unknown>;
  limits: {
    daily_gas_cap_per_user?: number;
    governance_cap?: number;
  };
  assets_allowed: string[];
  governance_assets_allowed: string[];
  manifest: Record<string, unknown>;
  status: "active" | "disabled" | "pending";
  created_at: string;
  updated_at: string;
}

export interface RegistryMiniAppVersion {
  id: string;
  app_id: string;
  version?: string | null;
  version_code?: number | null;
  entry_url?: string | null;
  status?: string | null;
  is_current?: boolean | null;
  supported_chains?: string[] | null;
  contracts?: Record<string, unknown> | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_notes?: string | null;
  created_at?: string | null;
  published_at?: string | null;
}

export interface RegistryMiniAppBuild {
  id: string;
  version_id: string;
  build_number?: number | null;
  storage_path?: string | null;
  storage_provider?: string | null;
  status?: string | null;
  created_at?: string | null;
  completed_at?: string | null;
}

export interface RegistryMiniApp {
  app_id: string;
  name: string;
  name_zh?: string | null;
  description?: string | null;
  description_zh?: string | null;
  short_description?: string | null;
  icon_url?: string | null;
  banner_url?: string | null;
  category?: string | null;
  permissions?: Record<string, unknown> | null;
  supported_chains?: string[] | null;
  contracts?: Record<string, unknown> | null;
  status?: string | null;
  visibility?: string | null;
  developer_name?: string | null;
  developer_address?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  latest_version?: RegistryMiniAppVersion | null;
  latest_build?: RegistryMiniAppBuild | null;
}

export interface User {
  id: string;
  address: string;
  email?: string;
  created_at: string;
  updated_at: string;
}

export interface MiniAppUsage {
  id: string;
  user_id: string;
  app_id: string;
  usage_date: string;
  gas_used: number;
  governance_used: number;
  created_at: string;
  updated_at: string;
}

export interface AnalyticsData {
  totalUsers: number;
  totalMiniApps: number;
  totalTransactions: number;
  gasUsageToday: number;
  usageByApp: Array<{
    app_id: string;
    total_gas: number;
    total_governance: number;
    user_count: number;
  }>;
  usageOverTime: Array<{
    date: string;
    gas_used: number;
    governance_used: number;
  }>;
}

export interface Contract {
  name: string;
  hash: string;
  deployed: boolean;
  network: string;
  deployedAt?: string;
}

export interface DeploymentRequest {
  contractName: string;
  network: string;
  parameters?: Record<string, unknown>;
}

export interface APIError {
  message: string;
  code?: string;
  details?: unknown;
}
