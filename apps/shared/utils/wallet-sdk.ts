/**
 * Neo N3 Web Wallet SDK
 *
 * Provides wallet connection, contract invocation, and event querying
 * for Neo N3 web apps. Replaces the UniApp-specific @neo/uniapp-sdk.
 *
 * Supports:
 * - NeoLine browser extension
 * - WalletConnect
 * - Abstract Account (AA) via social login
 */
import { ref, type Ref } from "vue";
import { getMiniAppContractHash, getNetwork, getPaymentHubHash, getRpcUrl, type NeoNetwork, N3INDEX_API } from "../constants/rpc";

// Re-export types that were previously in @neo/types
export interface WalletSDK {
  address: Ref<string | null>;
  chainType: Ref<string>;
  connect: () => Promise<void>;
  invokeContract: (params: InvokeParams) => Promise<InvokeResult>;
  invokeRead: (params: InvokeParams) => Promise<InvokeResult>;
  getBalance: (asset: string) => Promise<string | number>;
  getContractAddress: () => Promise<string>;
}

export interface InvokeParams {
  scriptHash: string;
  operation: string;
  args?: ContractArg[];
  signers?: Array<{ account: string; scopes: string }>;
}

export interface ContractArg {
  type: string;
  value: unknown;
}

export interface InvokeResult {
  stack?: StackItem[];
  state?: string;
  gasconsumed?: string;
  exception?: string | null;
  tx?: string;
  txid?: string;
}

export interface StackItem {
  type: string;
  value: unknown;
}

export interface GameState {
  wins: number;
  losses: number;
  totalGames: number;
}

export interface EventsListParams {
  app_id?: string;
  event_name?: string;
  limit?: number;
  offset?: number;
  tx_hash?: string;
}

export interface EventsListResponse {
  events: ContractEvent[];
  total?: number;
}

export interface ContractEvent {
  id: string | number;
  event_name: string;
  state: unknown;
  tx_hash?: string;
  created_at?: string;
  block_index?: number;
}

// ---------------------------------------------------------------------------
// NeoLine interface (browser extension)
// ---------------------------------------------------------------------------

interface NeoLineN3 {
  getAccount: () => Promise<{ address: string }>;
  invoke: (params: {
    scriptHash: string;
    operation: string;
    args: ContractArg[];
    signers?: Array<{ account: string; scopes: number }>;
  }) => Promise<{ txid: string }>;
  invokeRead: (params: { scriptHash: string; operation: string; args?: ContractArg[] }) => Promise<InvokeResult>;
  getBalance: (params: {
    address: string;
    contracts: string[];
  }) => Promise<{ [asset: string]: { amount: string; contract: string }[] }>;
}

type MiniAppManifest = {
  contracts?: Record<string, string>;
  default_network?: string;
};

declare global {
  interface Window {
    NEOLineN3?: { Init: new () => NeoLineN3 };
    neo3Dapi?: NeoLineN3;
  }
}

// ---------------------------------------------------------------------------
// Platform API for events (replaces useEvents from uniapp-sdk)
// ---------------------------------------------------------------------------

const PLATFORM_API = import.meta.env?.VITE_PLATFORM_API || "";

async function fetchEvents(params: EventsListParams): Promise<EventsListResponse> {
  if (!PLATFORM_API) {
    return { events: [], total: 0 };
  }
  const query = new URLSearchParams();
  if (params.app_id) query.set("app_id", params.app_id);
  if (params.event_name) query.set("event_name", params.event_name);
  if (params.limit) query.set("limit", String(params.limit));
  if (params.offset) query.set("offset", String(params.offset));
  if (params.tx_hash) query.set("tx_hash", params.tx_hash);

  const res = await fetch(`${PLATFORM_API}/api/activity/events?${query.toString()}`);
  if (!res.ok) return { events: [], total: 0 };
  return res.json();
}

// ---------------------------------------------------------------------------
// useWallet composable
// ---------------------------------------------------------------------------

let walletInstance: WalletSDK | null = null;

function normalizeOperationName(operation: string): string {
  const raw = String(operation || "").trim();
  if (!raw) return raw;
  return raw.charAt(0).toLowerCase() + raw.slice(1);
}

let cachedManifest: MiniAppManifest | null | undefined;

async function loadCurrentMiniAppManifest(): Promise<MiniAppManifest | null> {
  if (cachedManifest !== undefined) return cachedManifest;
  try {
    const response = await fetch("/neo-manifest.json", { cache: "no-store" });
    if (!response.ok) {
      cachedManifest = null;
      return null;
    }
    cachedManifest = (await response.json()) as MiniAppManifest;
    return cachedManifest;
  } catch {
    cachedManifest = null;
    return null;
  }
}

export function useWallet(existingWallet?: WalletSDK): WalletSDK {
  if (existingWallet) return existingWallet;
  if (walletInstance) return walletInstance;

  const address = ref<string | null>(null);
  const chainType = ref("neo-n3");
  let neoline: NeoLineN3 | null = null;

  const ensureNeoLine = async (): Promise<NeoLineN3> => {
    if (neoline) return neoline;

    // Check for injected NeoLine
    if (window.neo3Dapi) {
      neoline = window.neo3Dapi;
      return neoline;
    }

    if (window.NEOLineN3) {
      neoline = new window.NEOLineN3.Init();
      return neoline;
    }

    // Wait for NeoLine to inject (up to 3 seconds)
    return new Promise((resolve, reject) => {
      let attempts = 0;
      const check = setInterval(() => {
        if (window.neo3Dapi) {
          clearInterval(check);
          neoline = window.neo3Dapi;
          resolve(neoline);
        } else if (window.NEOLineN3) {
          clearInterval(check);
          neoline = new window.NEOLineN3.Init();
          resolve(neoline);
        } else if (++attempts > 30) {
          clearInterval(check);
          reject(new Error("NeoLine wallet not detected. Please install NeoLine extension."));
        }
      }, 100);
    });
  };

  const connect = async () => {
    const nl = await ensureNeoLine();
    const account = await nl.getAccount();
    address.value = account.address;
  };

  const invokeContract = async (params: InvokeParams): Promise<InvokeResult> => {
    const nl = await ensureNeoLine();
    if (!address.value) await connect();
    const result = await nl.invoke({
      scriptHash: params.scriptHash,
      operation: normalizeOperationName(params.operation),
      args: params.args ?? [],
      signers: params.signers?.map((s) => ({
        account: s.account,
        scopes: parseInt(s.scopes) || 1,
      })),
    });
    return { txid: result.txid, tx: result.txid };
  };

  const invokeRead = async (params: InvokeParams): Promise<InvokeResult> => {
    const nl = await ensureNeoLine();
    return nl.invokeRead({
      scriptHash: params.scriptHash,
      operation: normalizeOperationName(params.operation),
      args: params.args,
    });
  };

  const getBalance = async (asset: string): Promise<string | number> => {
    const nl = await ensureNeoLine();
    if (!address.value) return "0";

    const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
    const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";

    const contractHash = asset === "GAS" ? GAS_HASH : asset === "NEO" ? NEO_HASH : asset;

    const result = await nl.getBalance({
      address: address.value,
      contracts: [contractHash],
    });

    const balances = Object.values(result).flat();
    const match = balances.find((b) => b.contract === contractHash);
    return match?.amount ?? "0";
  };

  const getContractAddress = async (): Promise<string> => {
    const manifest = await loadCurrentMiniAppManifest();
    const network = getNetwork();
    const configured = manifest?.contracts?.[`neo-n3-${network}`] || manifest?.contracts?.[network] || "";
    if (configured) return configured;

    const fallbackAppId =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("app_id") || new URLSearchParams(window.location.search).get("appId") || ""
        : "";
    const fallback = fallbackAppId ? getMiniAppContractHash(fallbackAppId, network) : "";
    if (fallback) return fallback;

    throw new Error("Contract address unavailable");
  };

  walletInstance = {
    address,
    chainType,
    connect,
    invokeContract,
    invokeRead,
    getBalance,
    getContractAddress,
  };

  return walletInstance;
}

// ---------------------------------------------------------------------------
// useGasSponsor composable
// ---------------------------------------------------------------------------

export interface EligibilityResult {
  gas_balance: string;
  used_today: string;
  daily_limit: string;
  resets_at: string;
}

export interface SponsorshipResult {
  success: boolean;
}

export function useGasSponsor() {
  const isCheckingEligibility = ref(false);
  const eligibilityError = ref<string | null>(null);
  const isRequestingSponsorship = ref(false);
  const sponsorshipError = ref<string | null>(null);

  const checkEligibility = async (): Promise<EligibilityResult> => {
    isCheckingEligibility.value = true;
    eligibilityError.value = null;
    try {
      if (!PLATFORM_API) {
        return { gas_balance: "0", used_today: "0", daily_limit: "0.1", resets_at: "" };
      }
      const wallet = useWallet();
      const addr = wallet.address.value;
      if (!addr) {
        return { gas_balance: "0", used_today: "0", daily_limit: "0.1", resets_at: "" };
      }
      const res = await fetch(`${PLATFORM_API}/api/gas-sponsor/eligibility?address=${addr}`);
      if (!res.ok) throw new Error("Failed to check eligibility");
      return res.json();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      eligibilityError.value = msg;
      return { gas_balance: "0", used_today: "0", daily_limit: "0.1", resets_at: "" };
    } finally {
      isCheckingEligibility.value = false;
    }
  };

  const requestSponsorship = async (amount: number): Promise<SponsorshipResult> => {
    isRequestingSponsorship.value = true;
    sponsorshipError.value = null;
    try {
      if (!PLATFORM_API) throw new Error("Platform API not configured");
      const wallet = useWallet();
      const addr = wallet.address.value;
      if (!addr) throw new Error("Wallet not connected");
      const res = await fetch(`${PLATFORM_API}/api/gas-sponsor/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr, amount }),
      });
      if (!res.ok) throw new Error("Sponsorship request failed");
      return res.json();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      sponsorshipError.value = msg;
      return { success: false };
    } finally {
      isRequestingSponsorship.value = false;
    }
  };

  return {
    isCheckingEligibility,
    eligibilityError,
    checkEligibility,
    isRequestingSponsorship,
    sponsorshipError,
    requestSponsorship,
  };
}

// ---------------------------------------------------------------------------
// usePayments composable
// ---------------------------------------------------------------------------

export interface PaymentResult {
  request_id?: string;
  receipt_id: string;
  txid: string;
}

export function usePayments(appId?: string) {
  const wallet = useWallet();

  const fetchApplicationLog = async (rpcUrl: string, txid: string) => {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "getapplicationlog",
        params: [txid],
        id: 1,
      }),
    });
    const payload = await response.json();
    if (!response.ok || payload.error) {
      throw new Error(payload?.error?.message || "failed to fetch application log");
    }
    return payload.result;
  };

  const extractReceiptIdFromLog = (log: any, paymentHubHash: string): string => {
    const executions = Array.isArray(log?.executions) ? log.executions : [];
    for (const execution of executions) {
      const notifications = Array.isArray(execution?.notifications) ? execution.notifications : [];
      for (const notification of notifications) {
        if (
          String(notification?.contract || "").toLowerCase() === String(paymentHubHash || "").toLowerCase() &&
          String(notification?.eventname || "") === "PaymentReceived"
        ) {
          const values = notification?.state?.value;
          const receipt = Array.isArray(values) ? values[0] : null;
          if (receipt?.type === "Integer") {
            return String(receipt.value || "");
          }
        }
      }
    }
    return "";
  };

  const waitForReceiptId = async (txid: string, paymentHubHash: string, timeoutMs = 30000): Promise<string> => {
    const rpcUrl = getRpcUrl();
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      try {
        const log = await fetchApplicationLog(rpcUrl, txid);
        const receiptId = extractReceiptIdFromLog(log, paymentHubHash);
        if (receiptId) return receiptId;
      } catch {
        // retry until timeout
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    throw new Error("Payment receipt not found");
  };

  const payGAS = async (
    amount: string,
    memo: string,
    paymentHubHash = getPaymentHubHash(),
    scopedAppId = appId || "miniapp",
  ): Promise<PaymentResult> => {
    const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
    const amountFixed8 = Math.round(parseFloat(amount) * 1e8).toString();
    if (!paymentHubHash) {
      throw new Error("PaymentHub address unavailable");
    }
    if (!wallet.address.value) {
      await wallet.connect();
    }

    const result = await wallet.invokeContract({
      scriptHash: GAS_HASH,
      operation: "transfer",
      args: [
        { type: "Hash160", value: wallet.address.value },
        { type: "Hash160", value: paymentHubHash },
        { type: "Integer", value: amountFixed8 },
        { type: "String", value: scopedAppId },
      ],
    });

    const txid = result.txid ?? "";
    const receiptId = txid ? await waitForReceiptId(txid, paymentHubHash) : "";

    return {
      request_id: txid,
      receipt_id: receiptId,
      txid,
    };
  };

  const processPayment = async (paymentHubHash: string, scopedAppId: string, amount: string, memo: string): Promise<PaymentResult> => {
    return payGAS(amount, `${memo}`, paymentHubHash || getPaymentHubHash(getNetwork()), scopedAppId);
  };

  return { payGAS, processPayment };
}

// ---------------------------------------------------------------------------
// useEvents composable — N3Index-powered event querying
// ---------------------------------------------------------------------------

export function useEvents() {
  /**
   * List contract events via N3Index decoded events API.
   * Falls back to platform API if N3Index is unavailable.
   */
  const list = async (params: EventsListParams): Promise<EventsListResponse> => {
    // Try N3Index first (decoded events, more reliable)
    if (params.app_id) {
      try {
        const network = getNetwork() as NeoNetwork;
        const contractHash = getMiniAppContractHash(params.app_id, network);
        if (!contractHash) {
          throw new Error(`missing contract hash for ${params.app_id}`);
        }
        const url = new URL(`${N3INDEX_API}/indexer/v1/networks/${network}/contracts/${contractHash}/events`);
        if (params.event_name) url.searchParams.set("event_name", params.event_name);
        if (params.limit) url.searchParams.set("limit", String(params.limit));
        if (params.offset) url.searchParams.set("offset", String(params.offset));
        if (params.tx_hash) url.searchParams.set("tx_hash", params.tx_hash);

        const res = await fetch(url.toString());
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            return {
              events: data.map((e: Record<string, unknown>) => ({
                id: e.id as string | number,
                event_name: e.event_name as string,
                state: e.state,
                tx_hash: e.txid as string,
                created_at: e.block_time as string,
                block_index: e.block_index as number,
              })),
              total: data.length,
            };
          }
        }
      } catch {
        // Fall through to platform API
      }
    }

    // Fallback to platform API
    return fetchEvents(params);
  };

  /**
   * Wait for a specific event after a transaction.
   * Uses N3Index polling for decoded contract events.
   */
  const waitForEvent = async (
    txHash: string,
    eventName: string,
    appId: string,
    timeoutMs = 60000,
  ): Promise<ContractEvent | null> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const result = await list({
        app_id: appId,
        event_name: eventName,
        tx_hash: txHash,
        limit: 1,
      });
      if (result.events.length > 0) return result.events[0];
      await new Promise((r) => setTimeout(r, 2500));
    }
    return null;
  };

  return { list, waitForEvent };
}
