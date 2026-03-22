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
import { getMiniAppContractHash, getNetwork, type NeoNetwork, N3INDEX_API } from "../constants/rpc";
import { MiniAppError } from "./errorHandling";

// Error codes for i18n-compatible error handling
const ERROR_CODE_INVOKE_MULTIPLE_UNSUPPORTED = "WALLET_INVOKE_MULTIPLE_UNSUPPORTED";
const ERROR_CODE_CONTRACT_NOT_CONFIGURED = "WALLET_CONTRACT_NOT_CONFIGURED";
const ERROR_CODE_ELIGIBILITY_CHECK_FAILED = "WALLET_ELIGIBILITY_CHECK_FAILED";
const ERROR_CODE_PLATFORM_API_NOT_CONFIGURED = "WALLET_PLATFORM_API_NOT_CONFIGURED";
const ERROR_CODE_WALLET_NOT_CONNECTED = "WALLET_NOT_CONNECTED";
const ERROR_CODE_SPONSORSHIP_REQUEST_FAILED = "WALLET_SPONSORSHIP_REQUEST_FAILED";
const ERROR_CODE_MINIAPP_CONTRACT_UNAVAILABLE = "WALLET_MINIAPP_CONTRACT_UNAVAILABLE";
const ERROR_CODE_PAYMENT_INVALID_AMOUNT = "WALLET_PAYMENT_INVALID_AMOUNT";

// Re-export types that were previously in @neo/types
export interface WalletSDK {
  address: Ref<string | null>;
  chainType: Ref<string>;
  /** Connected chain ID (e.g. "neo-n3-mainnet", "neo-n3-testnet") */
  chainId?: Ref<string>;
  /** App-specific chain ID override (e.g. for AA-based apps) */
  appChainId?: Ref<string>;
  connect: () => Promise<void>;
  invokeContract: (params: InvokeParams) => Promise<InvokeResult>;
  invokeMultiple: (params: BatchInvokeParams) => Promise<InvokeResult>;
  invokeRead: (params: InvokeParams) => Promise<InvokeResult>;
  getBalance: (asset: string) => Promise<string | number>;
  getContractAddress: () => Promise<string>;
  /** Sign a message with the connected wallet */
  signMessage?: (message: string) => Promise<{ publicKey?: string; data?: string } | null>;
  /** Switch the wallet to a different chain/network */
  switchToAppChain?: (chainId: string) => Promise<void>;
}

export interface InvokeParams {
  scriptHash: string;
  operation: string;
  args?: ContractArg[];
  signers?: WalletSigner[];
}

export interface BatchInvokeParams {
  invokeArgs: InvokeParams[];
  signers?: WalletSigner[];
}

export interface ContractArg {
  type: string;
  value: unknown;
}

export interface WalletSigner {
  account: string;
  scopes: string | number;
  allowedContracts?: string[];
  allowedGroups?: string[];
  rules?: unknown[];
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
    signers?: Array<{
      account: string;
      scopes: number;
      allowedContracts?: string[];
      allowedGroups?: string[];
      rules?: unknown[];
    }>;
  }) => Promise<{ txid: string }>;
  invokeMultiple?: (params: {
    invokeArgs: Array<{
      scriptHash: string;
      operation: string;
      args: ContractArg[];
    }>;
    signers?: Array<{
      account: string;
      scopes: number;
      allowedContracts?: string[];
      allowedGroups?: string[];
      rules?: unknown[];
    }>;
  }) => Promise<{ txid: string }>;
  invokeMulti?: (params: {
    invokeArgs: Array<{
      scriptHash: string;
      operation: string;
      args: ContractArg[];
    }>;
    signers?: Array<{
      account: string;
      scopes: number;
      allowedContracts?: string[];
      allowedGroups?: string[];
      rules?: unknown[];
    }>;
  }) => Promise<{ txid: string }>;
  invokeRead: (params: { scriptHash: string; operation: string; args?: ContractArg[] }) => Promise<InvokeResult>;
  getBalance: (params: {
    address: string;
    contracts: string[];
  }) => Promise<{ [asset: string]: { amount: string; contract: string }[] }>;
}

type MiniAppManifest = {
  id?: string;
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

const SIGNER_SCOPE_MAP: Record<string, number> = {
  none: 0,
  calledbyentry: 1,
  customcontracts: 16,
  customgroups: 32,
  rules: 64,
  global: 128,
};

function normalizeOperationName(operation: string): string {
  const raw = String(operation || "").trim();
  if (!raw) return raw;
  return raw.charAt(0).toLowerCase() + raw.slice(1);
}

function normalizeSignerScope(scope: string | number): number {
  if (typeof scope === "number" && Number.isFinite(scope)) {
    return scope;
  }

  const raw = String(scope ?? "").trim();
  if (/^\d+$/.test(raw)) {
    return parseInt(raw, 10);
  }

  return SIGNER_SCOPE_MAP[raw.toLowerCase()] ?? 1;
}

function mapSigners(signers?: WalletSigner[]) {
  return signers?.map((signer) => ({
    account: signer.account,
    scopes: normalizeSignerScope(signer.scopes),
    ...(signer.allowedContracts?.length ? { allowedContracts: signer.allowedContracts } : {}),
    ...(signer.allowedGroups?.length ? { allowedGroups: signer.allowedGroups } : {}),
    ...(signer.rules?.length ? { rules: signer.rules } : {}),
  }));
}

let cachedManifest: MiniAppManifest | null | undefined;
let cachedManifestTimestamp = 0;
const CACHED_MANIFEST_TTL_MS = 30000; // 30 seconds

export function invalidateManifestCache(): void {
  cachedManifest = undefined;
  cachedManifestTimestamp = 0;
}

async function loadCurrentMiniAppManifest(): Promise<MiniAppManifest | null> {
  const now = Date.now();
  if (cachedManifest !== undefined && now - cachedManifestTimestamp < CACHED_MANIFEST_TTL_MS) {
    return cachedManifest;
  }
  try {
    const response = await fetch("/neo-manifest.json", { cache: "no-store" });
    if (!response.ok) {
      cachedManifest = null;
      cachedManifestTimestamp = now;
      return null;
    }
    const text = await response.text();
    cachedManifest = JSON.parse(text) as MiniAppManifest;
    cachedManifestTimestamp = now;
    return cachedManifest;
  } catch (_e: unknown) {
    cachedManifest = null;
    cachedManifestTimestamp = now;
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
      const timeoutId = setTimeout(() => {
        clearInterval(check);
        reject(new Error("NeoLine wallet not detected. Please install NeoLine extension."));
      }, 3000);
      const check = setInterval(() => {
        if (window.neo3Dapi) {
          clearInterval(check);
          clearTimeout(timeoutId);
          neoline = window.neo3Dapi;
          resolve(neoline);
        } else if (window.NEOLineN3) {
          clearInterval(check);
          clearTimeout(timeoutId);
          neoline = new window.NEOLineN3.Init();
          resolve(neoline);
        } else if (++attempts > 30) {
          clearInterval(check);
          clearTimeout(timeoutId);
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
      signers: mapSigners(params.signers),
    });
    return { txid: result.txid, tx: result.txid };
  };

  const invokeMultiple = async (params: BatchInvokeParams): Promise<InvokeResult> => {
    const nl = await ensureNeoLine();
    if (!address.value) await connect();

    const provider = nl.invokeMultiple || nl.invokeMulti;
    if (!provider) {
      throw new MiniAppError("Connected Neo wallet does not support invokeMultiple.", ERROR_CODE_INVOKE_MULTIPLE_UNSUPPORTED, undefined, undefined, undefined, ERROR_CODE_INVOKE_MULTIPLE_UNSUPPORTED);
    }

    const result = await provider({
      invokeArgs: (params.invokeArgs ?? []).map((entry) => ({
        scriptHash: entry.scriptHash,
        operation: normalizeOperationName(entry.operation),
        args: entry.args ?? [],
      })),
      signers: mapSigners(params.signers),
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

    throw new MiniAppError("Contract address not configured", ERROR_CODE_CONTRACT_NOT_CONFIGURED, undefined, undefined, undefined, ERROR_CODE_CONTRACT_NOT_CONFIGURED);
  };

  walletInstance = {
    address,
    chainType,
    connect,
    invokeContract,
    invokeMultiple,
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
      if (!res.ok) throw new MiniAppError("Failed to check eligibility", ERROR_CODE_ELIGIBILITY_CHECK_FAILED, undefined, undefined, undefined, ERROR_CODE_ELIGIBILITY_CHECK_FAILED);
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
      if (!PLATFORM_API) throw new MiniAppError("Platform API not configured", ERROR_CODE_PLATFORM_API_NOT_CONFIGURED, undefined, undefined, undefined, ERROR_CODE_PLATFORM_API_NOT_CONFIGURED);
      const wallet = useWallet();
      const addr = wallet.address.value;
      if (!addr) throw new MiniAppError("Wallet not connected", ERROR_CODE_WALLET_NOT_CONNECTED, undefined, undefined, undefined, ERROR_CODE_WALLET_NOT_CONNECTED);
      const res = await fetch(`${PLATFORM_API}/api/gas-sponsor/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: addr, amount }),
      });
      if (!res.ok) throw new MiniAppError("Sponsorship request failed", ERROR_CODE_SPONSORSHIP_REQUEST_FAILED, undefined, undefined, undefined, ERROR_CODE_SPONSORSHIP_REQUEST_FAILED);
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

  const payGAS = async (
    amount: string,
    memo: string,
    targetContractHash = "",
    scopedAppId = appId || "miniapp",
  ): Promise<PaymentResult> => {
    const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
    const parsedAmount = parseFloat(amount);
    if (!Number.isFinite(parsedAmount)) {
      throw new MiniAppError("Invalid amount", ERROR_CODE_PAYMENT_INVALID_AMOUNT, undefined, undefined, undefined, ERROR_CODE_PAYMENT_INVALID_AMOUNT);
    }
    const amountFixed8 = Math.round(parsedAmount * 1e8).toString();
    if (!wallet.address.value) {
      await wallet.connect();
    }
    const resolvedTargetHash = targetContractHash || await wallet.getContractAddress();
    if (!resolvedTargetHash) {
      throw new MiniAppError("MiniApp contract address unavailable", ERROR_CODE_MINIAPP_CONTRACT_UNAVAILABLE, undefined, undefined, undefined, ERROR_CODE_MINIAPP_CONTRACT_UNAVAILABLE);
    }
    const transferData = String(memo || scopedAppId || "miniapp");

    const result = await wallet.invokeContract({
      scriptHash: GAS_HASH,
      operation: "transfer",
      args: [
        { type: "Hash160", value: wallet.address.value },
        { type: "Hash160", value: resolvedTargetHash },
        { type: "Integer", value: amountFixed8 },
        { type: "String", value: transferData },
      ],
    });

    const txid = result.txid ?? "";

    return {
      request_id: txid,
      receipt_id: "",
      txid,
    };
  };

  const processPayment = async (targetContractHash: string, scopedAppId: string, amount: string, memo: string): Promise<PaymentResult> => {
    return payGAS(amount, `${memo}`, targetContractHash, scopedAppId);
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
        let contractHash = getMiniAppContractHash(params.app_id, network);
        if (!contractHash) {
          const manifest = await loadCurrentMiniAppManifest();
          const requestedAppId = String(params.app_id || "").trim();
          if (manifest?.id === requestedAppId) {
            contractHash =
              manifest.contracts?.[`neo-n3-${network}`] ||
              manifest.contracts?.[network] ||
              "";
          }
        }
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
      } catch (e: unknown) {
        console.warn("[useEvents] N3Index fetch failed, falling back to platform API:", e);
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
    signal?: AbortSignal,
  ): Promise<ContractEvent | null> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (signal?.aborted) return null;
      const result = await list({
        app_id: appId,
        event_name: eventName,
        tx_hash: txHash,
        limit: 1,
      });
      if (result.events.length > 0) return result.events[0];
      // Wait 2500ms or until signal fires, whichever comes first
      let aborted = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const onAbort = () => { aborted = true; };
      signal?.addEventListener("abort", onAbort, { once: true });
      await new Promise((r) => {
        timer = setTimeout(r, 2500);
        const onAbortResolve = () => { aborted = true; r(null); };
        signal?.addEventListener("abort", onAbortResolve, { once: true });
      });
      if (timer !== undefined) clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
      if (aborted) return null;
    }
    return null;
  };

  return { list, waitForEvent };
}
