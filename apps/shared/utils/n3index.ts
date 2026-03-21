/**
 * N3Index API Client — Neo N3 blockchain data engine.
 *
 * Base URL: https://api.n3index.dev
 * Two integration modes:
 *   - /indexer/v1 — Curated product API (wallets, dashboards, DApps)
 *   - /rest/v1   — Raw PostgREST access (analytics, data science)
 *
 * @see https://n3index.dev
 */

const N3INDEX_BASE = "https://api.n3index.dev";

export type Network = "mainnet" | "testnet";

// ─── Indexer API (curated product endpoints) ─────────────────────────────

export interface NetworkStatus {
  network: string;
  indexed_block: number;
  chain_tip: number;
  lag_blocks: number;
  is_healthy: boolean;
}

export interface NetworkSummary {
  network: string;
  total_blocks: number;
  total_transactions: number;
  total_addresses: number;
  total_assets: number;
  active_7d: number;
  indexed_transactions: number;
  latest_block: number;
  latest_block_time: string;
}

export interface AccountInfo {
  address: string;
  network: string;
  sent_count: number;
  signed_count: number;
  nep17_transfer_count: number;
  nep11_transfer_count: number;
}

export interface AccountTransaction {
  txid: string;
  block_index: number;
  block_time: string;
  sender: string;
  vm_state: string;
  gas_consumed: string;
}

export interface ContractInfo {
  contract_hash: string;
  network: string;
  name: string;
  event_count: number;
  execution_count: number;
}

export interface ContractEvent {
  id: number;
  txid: string;
  contract_hash: string;
  event_name: string;
  state: unknown;
  block_index: number;
  block_time: string;
  network: string;
}

export interface TokenInfo {
  contract_hash: string;
  name: string;
  symbol: string;
  decimals: number;
  total_supply: string;
  transfer_count: number;
  holder_count: number;
}

export interface ValidatorInfo {
  address: string;
  name: string;
  votes: string;
  active: boolean;
  rank: number;
  logo_url?: string;
}

// ─── Fetch helper ────────────────────────────────────────────────────────

async function apiFetch<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(`${N3INDEX_BASE}${path}`);
  if (params) {
    for (const [key, val] of Object.entries(params)) {
      url.searchParams.set(key, String(val));
    }
  }
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`N3Index API error: ${res.status} ${res.statusText} — ${path}`);
  }
  return res.json() as Promise<T>;
}

// ─── Indexer API ─────────────────────────────────────────────────────────

/** Health check */
export const healthCheck = () => apiFetch<{ status: string }>("/indexer/healthz");

/** Network indexing status */
export const getNetworkStatus = (network: Network) => apiFetch<NetworkStatus>(`/indexer/v1/networks/${network}/status`);

/** Explorer-style network summary */
export const getNetworkSummary = (network: Network) =>
  apiFetch<NetworkSummary>(`/indexer/v1/networks/${network}/summary`);

/** Account summary */
export const getAccount = (network: Network, address: string) =>
  apiFetch<AccountInfo>(`/indexer/v1/networks/${network}/accounts/${address}`);

/** Account transactions */
export const getAccountTransactions = (network: Network, address: string, limit = 20) =>
  apiFetch<AccountTransaction[]>(`/indexer/v1/networks/${network}/accounts/${address}/transactions`, { limit });

/** Contract overview */
export const getContract = (network: Network, contractHash: string) =>
  apiFetch<ContractInfo>(`/indexer/v1/networks/${network}/contracts/${contractHash}`);

/** Contract events (decoded) */
export const getContractEvents = (
  network: Network,
  contractHash: string,
  params?: { event_name?: string; tx_hash?: string; limit?: number; offset?: number },
) =>
  apiFetch<ContractEvent[]>(
    `/indexer/v1/networks/${network}/contracts/${contractHash}/events`,
    params as Record<string, string | number>,
  );

/** Token overview */
export const getToken = (network: Network, contractHash: string) =>
  apiFetch<TokenInfo>(`/indexer/v1/networks/${network}/tokens/${contractHash}`);

/** Daily chain analytics */
export const getDailyAnalytics = (network: Network, limit = 7) =>
  apiFetch<unknown[]>(`/indexer/v1/networks/${network}/analytics/daily`, { limit });

/** Validator directory */
export const getValidators = (network: Network) =>
  apiFetch<ValidatorInfo[]>(`/indexer/v1/networks/${network}/metadata/validators`);

/** Contract metadata lookup */
export const getContractMetadata = (network: Network, hashes: string[]) =>
  apiFetch<unknown[]>(`/indexer/v1/networks/${network}/metadata/contracts`, {
    contract_hashes: hashes.join(","),
  });

/** Address metadata lookup */
export const getAddressMetadata = (network: Network, addresses: string[]) =>
  apiFetch<unknown[]>(`/indexer/v1/networks/${network}/metadata/addresses`, {
    addresses: addresses.join(","),
  });

// ─── REST API (PostgREST raw access) ─────────────────────────────────────

/** Generic REST query */
export const restQuery = <T = unknown>(table: string, params?: Record<string, string>) =>
  apiFetch<T[]>(`/rest/v1/${table}`, params as Record<string, string | number>);

/** Query blocks */
export const getBlocks = (network: Network, limit = 10) =>
  restQuery("blocks", { network: `eq.${network}`, limit: String(limit) });

/** Query transactions */
export const getTransactions = (network: Network, limit = 10) =>
  restQuery("transactions", { network: `eq.${network}`, limit: String(limit) });

/** Query NEP-17 transfers */
export const getNep17Transfers = (network: Network, txid?: string, limit = 20) => {
  const params: Record<string, string> = { network: `eq.${network}`, limit: String(limit) };
  if (txid) params.txid = `eq.${txid}`;
  return restQuery("nep17_transfers", params);
};

/** Query NEP-11 transfers */
export const getNep11Transfers = (network: Network, txid?: string, limit = 20) => {
  const params: Record<string, string> = { network: `eq.${network}`, limit: String(limit) };
  if (txid) params.txid = `eq.${txid}`;
  return restQuery("nep11_transfers", params);
};

/** Query contract events via REST */
export const restContractEvents = (network: Network, contractHash: string, eventName?: string, limit = 20) => {
  const params: Record<string, string> = {
    network: `eq.${network}`,
    contract_hash: `eq.${contractHash}`,
    limit: String(limit),
  };
  if (eventName) params.event_name = `eq.${eventName}`;
  return restQuery("contract_events", params);
};

/** Token balances view */
export const getNep17Balances = (network: Network, limit = 10) =>
  restQuery("v_nep17_balances", { network: `eq.${network}`, limit: String(limit) });

/** Daily chain analytics view */
export const restDailyAnalytics = (network: Network, limit = 7) =>
  restQuery("v_daily_chain_analytics", { network: `eq.${network}`, limit: String(limit) });

// ─── Convenience: wait for tx confirmation ──────────────────────────────

/**
 * Poll N3Index until a transaction appears in the index.
 * More reliable than RPC polling since N3Index decodes events.
 */
export async function waitForTransaction(
  network: Network,
  txid: string,
  timeoutMs = 60000,
): Promise<ContractEvent[] | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const events = await getContractEvents(network, "", { tx_hash: txid, limit: 10 });
      if (events.length > 0) return events;
    } catch (_e: unknown) {
      // Not indexed yet
    }
    await new Promise((r) => setTimeout(r, 3000));
  }
  return null;
}

// ─── Export base URL for direct use ──────────────────────────────────────

export const N3INDEX_API = N3INDEX_BASE;
export default {
  N3INDEX_API,
  healthCheck,
  getNetworkStatus,
  getNetworkSummary,
  getAccount,
  getAccountTransactions,
  getContract,
  getContractEvents,
  getToken,
  getDailyAnalytics,
  getValidators,
  getContractMetadata,
  getAddressMetadata,
  restQuery,
  getBlocks,
  getTransactions,
  getNep17Transfers,
  getNep11Transfers,
  restContractEvents,
  getNep17Balances,
  restDailyAnalytics,
  waitForTransaction,
};
