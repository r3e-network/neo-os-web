export interface MiniAppSDKConfig {
  baseUrl?: string;
  edgeBaseUrl?: string;
  appId?: string;
  getAuthToken?: () => Promise<string | undefined>;
  getAPIKey?: () => Promise<string | undefined>;
}

export interface MiniAppSDK {
  // Required methods for SDK validation
  invoke?: (method: string, params?: Record<string, unknown>) => Promise<unknown>;
  getConfig?: () => { appId: string; debug?: boolean };
  getAddress?: () => Promise<string | null>;
  wallet?: {
    getAddress?: () => Promise<string | null>;
    invokeIntent?: (requestId: string) => Promise<unknown>;
  };
  payments?: {
    payGAS?: (appId: string, amount: string, memo?: string) => Promise<{ txHash: string | null }>;
    payGASAndInvoke?: (appId: string, amount: string, memo?: string) => Promise<{ txHash: string | null }>;
  };
  governance?: {
    vote?: (
      appId: string,
      proposalId: string,
      neoAmount: string,
      support?: boolean,
    ) => Promise<{ txHash: string | null }>;
    voteAndInvoke?: (
      appId: string,
      proposalId: string,
      neoAmount: string,
      support?: boolean,
    ) => Promise<{ txHash: string | null }>;
  };
  rng?: {
    requestRandom?: (appId: string) => Promise<{ requestId: string | null }>;
  };
  datafeed?: {
    getPrice?: (symbol: string) => Promise<{ price: string }>;
  };
  stats?: {
    getMyUsage?: (appId: string, date?: string) => Promise<Record<string, unknown>>;
  };
  events?: {
    list?: (params: Record<string, unknown>) => Promise<{ events: unknown[] }>;
  };
  transactions?: {
    list?: (params: Record<string, unknown>) => Promise<{ transactions: unknown[] }>;
  };
  automation?: {
    register?: (
      taskName: string,
      taskType: string,
      payload?: Record<string, unknown>,
      schedule?: { intervalSeconds?: number; maxRuns?: number },
    ) => Promise<{ success: boolean; taskId?: string; error?: string }>;
    unregister?: (taskName: string) => Promise<{ success: boolean }>;
    status?: (taskName: string) => Promise<Record<string, unknown>>;
    list?: () => Promise<{ tasks: unknown[] }>;
    update?: (
      taskId: string,
      payload?: Record<string, unknown>,
      schedule?: { intervalSeconds?: number; cron?: string; maxRuns?: number },
    ) => Promise<{ success: boolean }>;
    enable?: (taskId: string) => Promise<{ success: boolean; status: string }>;
    disable?: (taskId: string) => Promise<{ success: boolean; status: string }>;
    logs?: (taskId?: string, limit?: number) => Promise<{ logs: unknown[] }>;
  };
}
