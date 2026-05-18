/**
 * Neo N3 Web Wallet SDK
 *
 * Provides wallet connection, contract invocation, and event querying
 * for Neo N3 web apps. Replaces the legacy package-level wallet shim.
 *
 * Supports:
 * - OneGate and NeoLine through the Neo dAPI / NEP-21 protocol
 * - Abstract Account (AA) via social login
 */
import { ref } from "vue";
import {
  getMiniAppContractHash,
  getNetwork,
  MAINNET_MAGIC,
  TESTNET_MAGIC,
} from "../constants/rpc";
import { MiniAppError } from "./errorHandling";
import {
  readImmediateNep21Provider,
  resetNep21ProviderCacheForTests,
  waitForNep21Provider,
} from "./nep21-provider";
import {
  buildDapiInvocation,
  chainTypeFromDapiNetwork,
  mapDapiSigners,
  networkLabel,
  normalizeBalanceResult,
  normalizeTxResult,
  resolveNetworkFromChainId,
} from "./wallet-sdk-invoke-utils";
import {
  createEventsComposable,
  createGasSponsorComposable,
  createPaymentsComposable,
} from "./wallet-sdk-composables";
import type {
  ActiveWalletProvider,
  BatchInvokeParams,
  ContractArg,
  ContractEvent,
  EventsListParams,
  EventsListResponse,
  GameState,
  InvokeParams,
  InvokeResult,
  MiniAppManifest,
  NeoDapiProvider,
  StackItem,
  WalletSDK,
  WalletSigner,
} from "./wallet-sdk-types";

export type {
  ActiveWalletProvider,
  BatchInvokeParams,
  ContractArg,
  ContractEvent,
  EligibilityResult,
  EventsListParams,
  EventsListResponse,
  GameState,
  InvokeParams,
  InvokeResult,
  NeoDapiProvider,
  StackItem,
  WalletSDK,
  WalletSigner,
} from "./wallet-sdk-types";
export type {
  EligibilityResult,
  PaymentResult,
  SponsorshipResult,
} from "./wallet-sdk-composables";

// Error codes for i18n-compatible error handling
const ERROR_CODE_INVOKE_MULTIPLE_UNSUPPORTED =
  "WALLET_INVOKE_MULTIPLE_UNSUPPORTED";
const ERROR_CODE_CONTRACT_NOT_CONFIGURED = "WALLET_CONTRACT_NOT_CONFIGURED";
const ERROR_CODE_ELIGIBILITY_CHECK_FAILED = "WALLET_ELIGIBILITY_CHECK_FAILED";
const ERROR_CODE_PLATFORM_API_NOT_CONFIGURED =
  "WALLET_PLATFORM_API_NOT_CONFIGURED";
const ERROR_CODE_WALLET_NOT_CONNECTED = "WALLET_NOT_CONNECTED";
const ERROR_CODE_SPONSORSHIP_REQUEST_FAILED =
  "WALLET_SPONSORSHIP_REQUEST_FAILED";
const ERROR_CODE_MINIAPP_CONTRACT_UNAVAILABLE =
  "WALLET_MINIAPP_CONTRACT_UNAVAILABLE";
const ERROR_CODE_PAYMENT_INVALID_AMOUNT = "WALLET_PAYMENT_INVALID_AMOUNT";
const ERROR_CODE_WALLET_NETWORK_UNVERIFIED = "WALLET_NETWORK_UNVERIFIED";
const ERROR_CODE_WALLET_NETWORK_MISMATCH = "WALLET_NETWORK_MISMATCH";

const PLATFORM_API = import.meta.env?.VITE_PLATFORM_API || "";
let walletInstance: WalletSDK | null = null;

function readImmediateDapiProvider(): NeoDapiProvider | null {
  return readImmediateNep21Provider() as NeoDapiProvider | null;
}

function waitForDapiProvider(timeoutMs = 3000): Promise<NeoDapiProvider> {
  return waitForNep21Provider({ timeoutMs }) as Promise<NeoDapiProvider>;
}

function encodeBase64Utf8(value: string): string {
  if (typeof btoa === "function") {
    return btoa(unescape(encodeURIComponent(value)));
  }
  return value;
}

function createNonce(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
      "",
    );
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
  const [root = "", slug = ""] = pathname.split("/").filter(Boolean);
  return root === "miniapps" && Boolean(slug) && !slug.startsWith("miniapp-");
}

export function __resetWalletForTests(): void {
  walletInstance = null;
  resetNep21ProviderCacheForTests();
}

async function loadCurrentMiniAppManifest(): Promise<MiniAppManifest | null> {
  const now = Date.now();
  if (
    cachedManifest !== undefined &&
    now - cachedManifestTimestamp < CACHED_MANIFEST_TTL_MS
  ) {
    return cachedManifest;
  }
  if (
    typeof window !== "undefined" &&
    !isStaticMiniAppRuntimePath(window.location.pathname)
  ) {
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
  let activeProvider: ActiveWalletProvider | null = null;
  let dapiAccountHash: string | null = null;
  let dapiEventsAttached = false;

  const ensureWalletProvider = async (): Promise<ActiveWalletProvider> => {
    if (activeProvider) return activeProvider;

    const immediateDapi = readImmediateDapiProvider();
    if (immediateDapi) {
      activeProvider = { kind: "nep21", provider: immediateDapi };
      return activeProvider;
    }

    const provider = await waitForDapiProvider(3000).catch(() => {
      throw new Error(
        "Compatible Neo wallet not detected. Please install a NEP-21 dAPI wallet such as OneGate or NeoLine.",
      );
    });
    activeProvider = { kind: "nep21", provider };
    return activeProvider;
  };

  const updateDapiNetwork = (provider: NeoDapiProvider) => {
    const nextChainType = chainTypeFromDapiNetwork(provider.network);
    chainType.value = nextChainType;
    chainId.value = nextChainType;
  };

  const assertWalletMatchesAppNetwork = () => {
    const targetNetwork = getNetwork();
    const walletNetwork = resolveNetworkFromChainId(chainId.value);
    if (!walletNetwork) {
      throw new MiniAppError(
        `Wallet network is not verified. Reconnect OneGate or NeoLine on ${networkLabel(targetNetwork)}.`,
        ERROR_CODE_WALLET_NETWORK_UNVERIFIED,
        undefined,
        undefined,
        undefined,
        ERROR_CODE_WALLET_NETWORK_UNVERIFIED,
      );
    }
    if (walletNetwork !== targetNetwork) {
      throw new MiniAppError(
        `Wallet is on ${networkLabel(walletNetwork)} but this DApp targets ${networkLabel(targetNetwork)}. Switch wallet network before submitting.`,
        ERROR_CODE_WALLET_NETWORK_MISMATCH,
        undefined,
        undefined,
        undefined,
        ERROR_CODE_WALLET_NETWORK_MISMATCH,
      );
    }
  };

  const setDapiAccount = (account: NeoDapiAccount) => {
    dapiAccountHash = account.hash;
    address.value = account.address || account.hash;
  };

  const resolveDapiAccount = (account?: string | null): string => {
    if (account && dapiAccountHash && account === address.value)
      return dapiAccountHash;
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
      throw new Error("Connected Neo wallet did not return any account.");
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
      throw new Error(
        "Connected Neo wallet authentication did not return an address.",
      );
    }
    dapiAccountHash = null;
    address.value = authenticated.address;
  };

  const connect = async () => {
    const wallet = await ensureWalletProvider();
    await connectDapi(wallet.provider);
    if (!dapiEventsAttached) {
      dapiEventsAttached = true;
      const handleAccountChanged = () => {
        void connectDapi(wallet.provider).catch(() => {
          dapiAccountHash = null;
          address.value = null;
        });
      };
      wallet.provider.on?.("networkchanged", () =>
        updateDapiNetwork(wallet.provider),
      );
      wallet.provider.on?.("accountchanged", handleAccountChanged);
      wallet.provider.on?.("accountschanged", handleAccountChanged);
    }
  };

  const invokeContract = async (
    params: InvokeParams,
  ): Promise<InvokeResult> => {
    const wallet = await ensureWalletProvider();
    if (!address.value) await connect();
    assertWalletMatchesAppNetwork();

    if (!wallet.provider.invoke) {
      throw new MiniAppError(
        "Connected Neo wallet does not support contract invoke.",
        ERROR_CODE_INVOKE_MULTIPLE_UNSUPPORTED,
        undefined,
        undefined,
        undefined,
        ERROR_CODE_INVOKE_MULTIPLE_UNSUPPORTED,
      );
    }
    const result = await wallet.provider.invoke(
      [buildDapiInvocation(params, dapiAccountHash, address.value)],
      mapDapiSigners(params.signers, dapiAccountHash, address.value),
    );
    return normalizeTxResult(result);
  };

  const invokeMultiple = async (
    params: BatchInvokeParams,
  ): Promise<InvokeResult> => {
    const wallet = await ensureWalletProvider();
    if (!address.value) await connect();
    assertWalletMatchesAppNetwork();

    if (!wallet.provider.invoke) {
      throw new MiniAppError(
        "Connected Neo wallet does not support contract invoke.",
        ERROR_CODE_INVOKE_MULTIPLE_UNSUPPORTED,
        undefined,
        undefined,
        undefined,
        ERROR_CODE_INVOKE_MULTIPLE_UNSUPPORTED,
      );
    }
    const result = await wallet.provider.invoke(
      (params.invokeArgs ?? []).map((entry) =>
        buildDapiInvocation(entry, dapiAccountHash, address.value),
      ),
      mapDapiSigners(params.signers, dapiAccountHash, address.value),
    );
    return normalizeTxResult(result);
  };

  const invokeRead = async (params: InvokeParams): Promise<InvokeResult> => {
    const wallet = await ensureWalletProvider();
    if (!address.value) await connect();
    assertWalletMatchesAppNetwork();
    if (!wallet.provider.call) {
      throw new MiniAppError(
        "Connected Neo wallet does not support read-only contract call.",
        ERROR_CODE_INVOKE_MULTIPLE_UNSUPPORTED,
        undefined,
        undefined,
        undefined,
        ERROR_CODE_INVOKE_MULTIPLE_UNSUPPORTED,
      );
    }
    return wallet.provider.call(
      buildDapiInvocation(params, dapiAccountHash, address.value),
    );
  };

  const getBalance = async (asset: string): Promise<string | number> => {
    const wallet = await ensureWalletProvider();
    if (!address.value) return "0";
    assertWalletMatchesAppNetwork();

    const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
    const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";

    const contractHash =
      asset === "GAS" ? GAS_HASH : asset === "NEO" ? NEO_HASH : asset;

    if (!wallet.provider.getBalance) return "0";
    const result = await wallet.provider.getBalance(
      contractHash,
      dapiAccountHash ?? address.value,
    );
    return normalizeBalanceResult(result, contractHash);
  };

  const send = async (
    asset: string,
    amount: string | number,
    to: string,
    from?: string,
  ): Promise<InvokeResult> => {
    const wallet = await ensureWalletProvider();
    if (!address.value) await connect();
    assertWalletMatchesAppNetwork();

    const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
    const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
    const contractHash =
      asset === "GAS" ? GAS_HASH : asset === "NEO" ? NEO_HASH : asset;

    if (wallet.provider.send) {
      const result = await wallet.provider.send(
        contractHash,
        resolveDapiAccount(from),
        to,
        String(amount),
      );
      return normalizeTxResult(result);
    }

    if (!wallet.provider.invoke) {
      throw new MiniAppError(
        "Connected Neo wallet does not support contract invoke.",
        ERROR_CODE_INVOKE_MULTIPLE_UNSUPPORTED,
        undefined,
        undefined,
        undefined,
        ERROR_CODE_INVOKE_MULTIPLE_UNSUPPORTED,
      );
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

    if (!wallet.provider.signMessage) {
      throw new Error("Connected Neo wallet does not support message signing.");
    }
    const signed = await wallet.provider.signMessage(
      encodeBase64Utf8(message),
      dapiAccountHash ?? address.value ?? undefined,
    );
    return {
      publicKey: signed.pubkey,
      data: signed.signature,
      signature: signed.signature,
      account: signed.account,
      pubkey: signed.pubkey,
    };
  };

  const getContractAddress = async (): Promise<string> => {
    const manifest = await loadCurrentMiniAppManifest();
    const network = getNetwork();
    const configured =
      manifest?.contracts?.[`neo-n3-${network}`] ||
      manifest?.contracts?.[network] ||
      "";
    if (configured) return configured;

    const fallbackAppId =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("app_id") ||
          new URLSearchParams(window.location.search).get("appId") ||
          ""
        : "";
    const fallback = fallbackAppId
      ? getMiniAppContractHash(fallbackAppId, network)
      : "";
    if (fallback) return fallback;

    throw new MiniAppError(
      "Contract address not configured",
      ERROR_CODE_CONTRACT_NOT_CONFIGURED,
      undefined,
      undefined,
      undefined,
      ERROR_CODE_CONTRACT_NOT_CONFIGURED,
    );
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

const composableDeps = {
  platformApi: PLATFORM_API,
  useWallet,
  loadCurrentMiniAppManifest,
  errorCodes: {
    ELIGIBILITY_CHECK_FAILED: ERROR_CODE_ELIGIBILITY_CHECK_FAILED,
    PLATFORM_API_NOT_CONFIGURED: ERROR_CODE_PLATFORM_API_NOT_CONFIGURED,
    WALLET_NOT_CONNECTED: ERROR_CODE_WALLET_NOT_CONNECTED,
    SPONSORSHIP_REQUEST_FAILED: ERROR_CODE_SPONSORSHIP_REQUEST_FAILED,
    PAYMENT_INVALID_AMOUNT: ERROR_CODE_PAYMENT_INVALID_AMOUNT,
    MINIAPP_CONTRACT_UNAVAILABLE: ERROR_CODE_MINIAPP_CONTRACT_UNAVAILABLE,
  },
};

export function useGasSponsor() {
  return createGasSponsorComposable(composableDeps);
}

export function usePayments(appId?: string) {
  return createPaymentsComposable(appId, composableDeps);
}

export function useEvents() {
  return createEventsComposable(composableDeps);
}
