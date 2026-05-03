/**
 * Neo N3 Web Wallet SDK
 *
 * Provides wallet connection, contract invocation, and event querying
 * for Neo N3 web apps. Replaces the legacy package-level wallet shim.
 *
 * Supports:
 * - NeoLine browser extension
 * - WalletConnect
 * - Abstract Account (AA) via social login
 */
import { ref, type Ref } from "vue";
import { getMiniAppContractHash, getNetwork, type NeoNetwork, N3INDEX_API, MAINNET_MAGIC, TESTNET_MAGIC } from "../constants/rpc";
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
  send?: (asset: string, amount: string | number, to: string, from?: string) => Promise<InvokeResult>;
  getContractAddress: () => Promise<string>;
  /** Sign a message with the connected wallet */
  signMessage?: (message: string) => Promise<{ publicKey?: string; data?: string; signature?: string; account?: string; pubkey?: string } | null>;
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
  signMessage?: (params: { message: string }) => Promise<string | { publicKey?: string; data?: string; signature?: string }>;
}

// ---------------------------------------------------------------------------
// NEP-21 dAPI provider interface
// ---------------------------------------------------------------------------

type NeoDapiEventName = "accountchanged" | "accountschanged" | "networkchanged";

type NeoDapiAccount = {
  hash: string;
  address?: string;
  label?: string;
  isDefault?: boolean;
};

type NeoDapiInvocation = {
  hash: string;
  operation: string;
  args?: ContractArg[];
  abortOnFail?: boolean;
};

type NeoDapiAuthenticationResponse = {
  network?: number;
  address?: string;
  nonce?: string;
  pubkey?: string;
  signature?: string;
};

interface NeoDapiProvider {
  compatibility?: string[];
  dapiVersion?: string;
  extra?: unknown;
  name?: string;
  network?: number;
  supportedNetworks?: number[];
  version?: string;
  website?: string;
  on?: (event: NeoDapiEventName, listener: () => void) => void;
  removeListener?: (event: NeoDapiEventName, listener: () => void) => void;
  authenticate?: (payload: {
    action: "Authentication";
    grant_type: "Signature";
    allowed_algorithms: ["ECDSA-P256"];
    domain: string;
    networks: number[];
    nonce: string;
    timestamp: number;
  }) => Promise<NeoDapiAuthenticationResponse>;
  call?: (invocation: NeoDapiInvocation) => Promise<InvokeResult>;
  getAccounts: () => Promise<NeoDapiAccount[]>;
  getBalance?: (asset: string, account?: string) => Promise<unknown>;
  invoke?: (invocations: NeoDapiInvocation[], signers?: WalletSigner[], suggestedSystemFee?: string) => Promise<unknown>;
  send?: (asset: string, from: string, to: string, amount: string, data?: ContractArg) => Promise<unknown>;
  signMessage?: (message: string, account?: string) => Promise<{ signature: string; account: string; pubkey: string }>;
}

type ActiveWalletProvider =
  | { kind: "nep21"; provider: NeoDapiProvider }
  | { kind: "neoline"; provider: NeoLineN3 };

type MiniAppManifest = {
  id?: string;
  contracts?: Record<string, string>;
  default_network?: string;
};

declare global {
  interface Window {
    NEOLineN3?: { Init: new () => NeoLineN3 };
    neo3Dapi?: NeoLineN3;
    Neo?: { DapiProvider?: NeoDapiProvider };
    neoDapiProvider?: NeoDapiProvider;
    neoDapi?: NeoDapiProvider;
  }
}

// ---------------------------------------------------------------------------
// Platform API for events.
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
  try {
    return await res.json();
  } catch (_e) {
    console.warn("[wallet-sdk] fetchEvents failed to parse JSON:", _e instanceof Error ? _e.message : String(_e));
    return { events: [], total: 0 };
  }
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

const DAPI_SCOPE_BY_NUMBER: Record<number, string> = {
  0: "None",
  1: "CalledByEntry",
  16: "CustomContracts",
  32: "CustomGroups",
  64: "WitnessRules",
  128: "Global",
};

const DAPI_SCOPE_BY_NAME: Record<string, string> = {
  none: "None",
  calledbyentry: "CalledByEntry",
  customcontracts: "CustomContracts",
  customgroups: "CustomGroups",
  rules: "WitnessRules",
  witnessrules: "WitnessRules",
  global: "Global",
};

function normalizeDapiSignerScope(scope: string | number): string {
  if (typeof scope === "number" && Number.isFinite(scope)) {
    if (DAPI_SCOPE_BY_NUMBER[scope]) return DAPI_SCOPE_BY_NUMBER[scope];
    const parts = Object.entries(DAPI_SCOPE_BY_NUMBER)
      .filter(([bit]) => Number(bit) !== 0 && (scope & Number(bit)) === Number(bit))
      .map(([, name]) => name);
    return parts.length ? parts.join(", ") : "CalledByEntry";
  }

  const raw = String(scope ?? "").trim();
  if (/^\d+$/.test(raw)) {
    return normalizeDapiSignerScope(parseInt(raw, 10));
  }
  if (raw.includes(",")) {
    const parts = raw
      .split(",")
      .map((part) => DAPI_SCOPE_BY_NAME[part.trim().toLowerCase()] ?? part.trim())
      .filter(Boolean);
    return parts.length ? parts.join(", ") : "CalledByEntry";
  }

  return DAPI_SCOPE_BY_NAME[raw.toLowerCase()] ?? (raw || "CalledByEntry");
}

function mapDapiSigners(signers?: WalletSigner[], accountHash?: string | null, currentAddress?: string | null) {
  return signers?.map((signer) => ({
    account: accountHash && currentAddress && signer.account === currentAddress ? accountHash : signer.account,
    scopes: normalizeDapiSignerScope(signer.scopes),
    ...(signer.allowedContracts?.length ? { allowedContracts: signer.allowedContracts } : {}),
    ...(signer.allowedGroups?.length ? { allowedGroups: signer.allowedGroups } : {}),
    ...(signer.rules?.length ? { rules: signer.rules } : {}),
  }));
}

function isNeoDapiProvider(candidate: unknown): candidate is NeoDapiProvider {
  if (!candidate || typeof candidate !== "object") return false;
  const provider = candidate as Partial<NeoDapiProvider>;
  return typeof provider.getAccounts === "function" && (
    typeof provider.invoke === "function" ||
    typeof provider.call === "function" ||
    typeof provider.send === "function" ||
    typeof provider.signMessage === "function"
  );
}

let cachedDapiProvider: NeoDapiProvider | null = null;
let dapiReadyListenerInstalled = false;
let dapiWaiters: Array<(provider: NeoDapiProvider) => void> = [];

function readImmediateDapiProvider(): NeoDapiProvider | null {
  if (cachedDapiProvider) return cachedDapiProvider;
  if (typeof window === "undefined") return null;
  const candidates = [
    window.Neo?.DapiProvider,
    window.neoDapiProvider,
    window.neoDapi,
  ];
  const provider = candidates.find(isNeoDapiProvider) ?? null;
  if (provider) cachedDapiProvider = provider;
  return provider;
}

function installDapiReadyListener(): void {
  if (dapiReadyListenerInstalled || typeof window === "undefined") return;
  dapiReadyListenerInstalled = true;
  window.addEventListener("Neo.DapiProvider.ready", (event: Event) => {
    const provider = (event as CustomEvent<{ provider?: unknown }>).detail?.provider;
    if (!isNeoDapiProvider(provider)) return;
    cachedDapiProvider = provider;
    const waiters = dapiWaiters;
    dapiWaiters = [];
    waiters.forEach((resolve) => resolve(provider));
  });
}

function waitForDapiProvider(timeoutMs = 3000): Promise<NeoDapiProvider> {
  installDapiReadyListener();
  const immediate = readImmediateDapiProvider();
  if (immediate) return Promise.resolve(immediate);

  return new Promise((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout>;
    const waiter = (provider: NeoDapiProvider) => {
      clearTimeout(timeout);
      resolve(provider);
    };
    timeout = setTimeout(() => {
      dapiWaiters = dapiWaiters.filter((entry) => entry !== waiter);
      reject(new Error("NEP-21 dAPI provider not detected."));
    }, timeoutMs);
    dapiWaiters.push(waiter);
    window.dispatchEvent(new CustomEvent("Neo.DapiProvider.request", {
      detail: { version: "1.0" },
    }));
  });
}

function resolveNetworkFromMagic(network?: number): NeoNetwork | null {
  if (network === MAINNET_MAGIC) return "mainnet";
  if (network === TESTNET_MAGIC) return "testnet";
  return null;
}

function chainTypeFromDapiNetwork(network?: number): string {
  const resolved = resolveNetworkFromMagic(network);
  return resolved ? `neo-n3-${resolved}` : "neo-n3";
}

function buildDapiInvocation(params: InvokeParams): NeoDapiInvocation {
  return {
    hash: params.scriptHash,
    operation: normalizeOperationName(params.operation),
    args: params.args ?? [],
  };
}

function normalizeTxResult(result: unknown): InvokeResult {
  if (typeof result === "string") return { txid: result, tx: result };
  if (result && typeof result === "object") {
    const record = result as Record<string, unknown>;
    const txid = String(record.txid ?? record.tx ?? record.hash ?? "");
    return {
      ...(result as InvokeResult),
      ...(txid ? { txid, tx: txid } : {}),
    };
  }
  return {};
}

function normalizeBalanceResult(result: unknown, assetHash: string): string | number {
  if (typeof result === "string" || typeof result === "number") return result;
  if (result && typeof result === "object") {
    const record = result as Record<string, unknown>;
    if (typeof record.amount === "string" || typeof record.amount === "number") return record.amount;

    const direct = record[assetHash] ?? record[assetHash.toLowerCase()] ?? record[assetHash.toUpperCase()];
    if (typeof direct === "string" || typeof direct === "number") return direct;

    if (Array.isArray(direct)) {
      const match = direct.find((entry) => entry && typeof entry === "object" && (entry as Record<string, unknown>).contract === assetHash);
      const amount = (match as Record<string, unknown> | undefined)?.amount;
      if (typeof amount === "string" || typeof amount === "number") return amount;
    }
  }
  return "0";
}

function encodeBase64Utf8(value: string): string {
  if (typeof btoa === "function") {
    return btoa(unescape(encodeURIComponent(value)));
  }
  return value;
}

function createNonce(): string {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
}

function getAuthenticationDomain(): string {
  if (typeof window === "undefined") return "localhost";
  return window.location.host || window.location.hostname || "localhost";
}

let cachedManifest: MiniAppManifest | null | undefined;
let cachedManifestTimestamp = 0;
const CACHED_MANIFEST_TTL_MS = 30000; // 30 seconds

export function invalidateManifestCache(): void {
  cachedManifest = undefined;
  cachedManifestTimestamp = 0;
}

function isStaticMiniAppRuntimePath(pathname: string): boolean {
  const [root, slug] = pathname.split("/").filter(Boolean);
  return root === "miniapps" && Boolean(slug) && !slug.startsWith("miniapp-");
}

export function __resetWalletForTests(): void {
  walletInstance = null;
  cachedDapiProvider = null;
  dapiWaiters = [];
}

async function loadCurrentMiniAppManifest(): Promise<MiniAppManifest | null> {
  const now = Date.now();
  if (cachedManifest !== undefined && now - cachedManifestTimestamp < CACHED_MANIFEST_TTL_MS) {
    return cachedManifest;
  }
  if (typeof window !== "undefined" && !isStaticMiniAppRuntimePath(window.location.pathname)) {
    cachedManifest = null;
    cachedManifestTimestamp = now;
    return null;
  }
  try {
    const manifestUrl =
      typeof window === "undefined"
        ? "/neo-manifest.json"
        : new URL("neo-manifest.json", window.location.href).toString();
    const response = await fetch(manifestUrl, { cache: "no-store" });
    if (!response.ok) {
      cachedManifest = null;
      cachedManifestTimestamp = now;
      return null;
    }
    const text = await response.text();
    cachedManifest = JSON.parse(text) as MiniAppManifest;
    cachedManifestTimestamp = now;
    return cachedManifest;
  } catch (_e) {
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
  const chainId = ref("neo-n3");
  let neoline: NeoLineN3 | null = null;
  let activeProvider: ActiveWalletProvider | null = null;
  let dapiAccountHash: string | null = null;
  let dapiEventsAttached = false;

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

  const ensureWalletProvider = async (): Promise<ActiveWalletProvider> => {
    if (activeProvider) return activeProvider;

    const immediateDapi = readImmediateDapiProvider();
    if (immediateDapi) {
      activeProvider = { kind: "nep21", provider: immediateDapi };
      return activeProvider;
    }

    if (typeof window !== "undefined" && (window.neo3Dapi || window.NEOLineN3)) {
      activeProvider = { kind: "neoline", provider: await ensureNeoLine() };
      return activeProvider;
    }

    return new Promise((resolve, reject) => {
      const errors: Error[] = [];
      const resolveOnce = (provider: ActiveWalletProvider) => {
        if (activeProvider) return;
        activeProvider = provider;
        resolve(provider);
      };
      const rejectIfDone = (error: unknown) => {
        errors.push(error instanceof Error ? error : new Error(String(error)));
        if (errors.length >= 2 && !activeProvider) {
          reject(new Error("Compatible Neo wallet not detected. Please install a NEP-21 dAPI wallet or NeoLine extension."));
        }
      };

      waitForDapiProvider(3000)
        .then((provider) => resolveOnce({ kind: "nep21", provider }))
        .catch(rejectIfDone);
      ensureNeoLine()
        .then((provider) => resolveOnce({ kind: "neoline", provider }))
        .catch(rejectIfDone);
    });
  };

  const updateDapiNetwork = (provider: NeoDapiProvider) => {
    const nextChainType = chainTypeFromDapiNetwork(provider.network);
    chainType.value = nextChainType;
    chainId.value = nextChainType;
  };

  const setDapiAccount = (account: NeoDapiAccount) => {
    dapiAccountHash = account.hash;
    address.value = account.address || account.hash;
  };

  const resolveDapiAccount = (account?: string | null): string => {
    if (account && dapiAccountHash && account === address.value) return dapiAccountHash;
    return account ?? dapiAccountHash ?? address.value ?? "";
  };

  const connectDapi = async (provider: NeoDapiProvider) => {
    updateDapiNetwork(provider);

    try {
      const accounts = await provider.getAccounts();
      const account = accounts.find((entry) => entry.isDefault) ?? accounts[0];
      if (account?.hash) {
        setDapiAccount(account);
        return;
      }
    } catch (_e) {
      // Some providers require an authentication prompt before account access.
    }

    if (!provider.authenticate) {
      throw new Error("NEP-21 wallet did not return any account.");
    }

    const supportedNetworks = provider.supportedNetworks?.length
      ? provider.supportedNetworks
      : [MAINNET_MAGIC, TESTNET_MAGIC];
    const authenticated = await provider.authenticate({
      action: "Authentication",
      grant_type: "Signature",
      allowed_algorithms: ["ECDSA-P256"],
      domain: getAuthenticationDomain(),
      networks: supportedNetworks,
      nonce: createNonce(),
      timestamp: Date.now(),
    });

    if (authenticated.network) {
      chainType.value = chainTypeFromDapiNetwork(authenticated.network);
      chainId.value = chainType.value;
    }
    if (!authenticated.address) {
      throw new Error("NEP-21 wallet authentication did not return an address.");
    }
    dapiAccountHash = null;
    address.value = authenticated.address;
  };

  const connect = async () => {
    const wallet = await ensureWalletProvider();
    if (wallet.kind === "nep21") {
      await connectDapi(wallet.provider);
      if (!dapiEventsAttached) {
        dapiEventsAttached = true;
        const handleAccountChanged = () => {
          void connectDapi(wallet.provider).catch(() => {
            dapiAccountHash = null;
            address.value = null;
          });
        };
        wallet.provider.on?.("networkchanged", () => updateDapiNetwork(wallet.provider));
        wallet.provider.on?.("accountchanged", handleAccountChanged);
        wallet.provider.on?.("accountschanged", handleAccountChanged);
      }
      return;
    }

    const account = await wallet.provider.getAccount();
    address.value = account.address;
  };

  const invokeContract = async (params: InvokeParams): Promise<InvokeResult> => {
    const wallet = await ensureWalletProvider();
    if (!address.value) await connect();

    if (wallet.kind === "nep21") {
      if (!wallet.provider.invoke) {
        throw new MiniAppError("Connected NEP-21 wallet does not support invoke.", ERROR_CODE_INVOKE_MULTIPLE_UNSUPPORTED, undefined, undefined, undefined, ERROR_CODE_INVOKE_MULTIPLE_UNSUPPORTED);
      }
      const result = await wallet.provider.invoke(
        [buildDapiInvocation(params)],
        mapDapiSigners(params.signers, dapiAccountHash, address.value),
      );
      return normalizeTxResult(result);
    }

    const result = await wallet.provider.invoke({
      scriptHash: params.scriptHash,
      operation: normalizeOperationName(params.operation),
      args: params.args ?? [],
      signers: mapSigners(params.signers),
    });
    return { txid: result.txid, tx: result.txid };
  };

  const invokeMultiple = async (params: BatchInvokeParams): Promise<InvokeResult> => {
    const wallet = await ensureWalletProvider();
    if (!address.value) await connect();

    if (wallet.kind === "nep21") {
      if (!wallet.provider.invoke) {
        throw new MiniAppError("Connected NEP-21 wallet does not support invoke.", ERROR_CODE_INVOKE_MULTIPLE_UNSUPPORTED, undefined, undefined, undefined, ERROR_CODE_INVOKE_MULTIPLE_UNSUPPORTED);
      }
      const result = await wallet.provider.invoke(
        (params.invokeArgs ?? []).map(buildDapiInvocation),
        mapDapiSigners(params.signers, dapiAccountHash, address.value),
      );
      return normalizeTxResult(result);
    }

    const provider = wallet.provider.invokeMultiple || wallet.provider.invokeMulti;
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
    const wallet = await ensureWalletProvider();
    if (wallet.kind === "nep21") {
      if (!wallet.provider.call) {
        throw new MiniAppError("Connected NEP-21 wallet does not support call.", ERROR_CODE_INVOKE_MULTIPLE_UNSUPPORTED, undefined, undefined, undefined, ERROR_CODE_INVOKE_MULTIPLE_UNSUPPORTED);
      }
      return wallet.provider.call(buildDapiInvocation(params));
    }

    return wallet.provider.invokeRead({
      scriptHash: params.scriptHash,
      operation: normalizeOperationName(params.operation),
      args: params.args,
    });
  };

  const getBalance = async (asset: string): Promise<string | number> => {
    const wallet = await ensureWalletProvider();
    if (!address.value) return "0";

    const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
    const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";

    const contractHash = asset === "GAS" ? GAS_HASH : asset === "NEO" ? NEO_HASH : asset;

    if (wallet.kind === "nep21") {
      if (!wallet.provider.getBalance) return "0";
      const result = await wallet.provider.getBalance(contractHash, dapiAccountHash ?? address.value);
      return normalizeBalanceResult(result, contractHash);
    }

    const result = await wallet.provider.getBalance({
      address: address.value,
      contracts: [contractHash],
    });

    const balances = Object.values(result).flat();
    const match = balances.find((b) => b.contract === contractHash);
    return match?.amount ?? "0";
  };

  const send = async (asset: string, amount: string | number, to: string, from?: string): Promise<InvokeResult> => {
    const wallet = await ensureWalletProvider();
    if (!address.value) await connect();

    const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
    const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
    const contractHash = asset === "GAS" ? GAS_HASH : asset === "NEO" ? NEO_HASH : asset;

    if (wallet.kind === "nep21" && wallet.provider.send) {
      const result = await wallet.provider.send(
        contractHash,
        resolveDapiAccount(from),
        to,
        String(amount),
      );
      return normalizeTxResult(result);
    }

    return invokeContract({
      scriptHash: contractHash,
      operation: "transfer",
      args: [
        { type: "Hash160", value: from ?? address.value },
        { type: "Hash160", value: to },
        { type: "Integer", value: String(amount) },
        { type: "Any", value: null },
      ],
    });
  };

  const signMessage = async (message: string) => {
    const wallet = await ensureWalletProvider();
    if (!address.value) await connect();

    if (wallet.kind === "nep21") {
      if (!wallet.provider.signMessage) {
        throw new Error("Connected NEP-21 wallet does not support signMessage.");
      }
      const signed = await wallet.provider.signMessage(encodeBase64Utf8(message), dapiAccountHash ?? address.value ?? undefined);
      return {
        publicKey: signed.pubkey,
        data: signed.signature,
        signature: signed.signature,
        account: signed.account,
        pubkey: signed.pubkey,
      };
    }

    if (!wallet.provider.signMessage) {
      throw new Error("Connected Neo wallet does not support signMessage.");
    }
    const signed = await wallet.provider.signMessage({ message });
    return typeof signed === "string" ? { data: signed, signature: signed } : signed;
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
    chainId,
    connect,
    invokeContract,
    invokeMultiple,
    invokeRead,
    getBalance,
    send,
    getContractAddress,
    signMessage,
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
    } catch (e) {
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
    } catch (e) {
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
      } catch (e) {
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
      if (result.events.length > 0) return result.events[0] ?? null;
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
