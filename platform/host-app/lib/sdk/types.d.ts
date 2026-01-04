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
}
