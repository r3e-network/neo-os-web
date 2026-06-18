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
import { createObservable, withValueCompat } from "../react/context";
import {
  GAS_HASH,
  getMiniAppContractHash,
  getNetwork,
  MAINNET_MAGIC,
  NEO_HASH,
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
  WalletIntentConfirmationContext,
  WalletSigner,
} from "./wallet-sdk-types";
import type { NeoDapiAccount } from "./nep21-provider";

export type {
  ActiveWalletProvider,
  BatchInvokeParams,
  ContractArg,
  ContractEvent,
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
const ERROR_CODE_WALLET_CONFIRMATION_REJECTED = "WALLET_CONFIRMATION_REJECTED";

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

function createNumericNonce(): number {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const bytes = new Uint32Array(1);
    crypto.getRandomValues(bytes);
    return bytes[0] ?? Math.floor(Math.random() * 0xffffffff);
  }
  return Math.floor(Math.random() * 0xffffffff);
}

function getAuthenticationDomain(): string {
  if (typeof window === "undefined") return "localhost";
  return window.location.hostname || window.location.host || "localhost";
}

function buildDapiAuthenticationPayload(networks: number[]) {
  const domain = getAuthenticationDomain();
  const timestamp = Date.now();
  return {
    action: "Authentication" as const,
    grant_type: "Signature" as const,
    allowed_algorithms: ["ECDSA-P256"] as ["ECDSA-P256"],
    domain,
    networks,
    nonce: createNonce(),
    timestamp,
    Action: "Authentication" as const,
    Domain: domain,
    Networks: networks,
    Nonce: createNumericNonce(),
    Timestamp: Math.floor(timestamp / 1000),
  };
}

function stringifyIntentValue(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean")
    return String(value);
  try {
    return JSON.stringify(value);
  } catch (_e) {
    return String(value);
  }
}

function buildWalletIntentSummary(
  params: InvokeParams,
  context?: WalletIntentConfirmationContext,
): string {
  const lines = [
    context?.title || "Confirm Neo transaction",
    context?.appId ? `MiniApp: ${context.appId}` : "",
    context?.endpoint ? `Source: ${context.endpoint}` : "",
    `Contract: ${params.scriptHash}`,
    `Method: ${params.operation}`,
  ].filter(Boolean);
  const args = params.args ?? [];
  if (args.length) {
    lines.push(
      "Arguments:",
      ...args.map(
        (arg, index) =>
          `${index + 1}. ${arg.type}: ${stringifyIntentValue(arg.value)}`,
      ),
    );
  }
  if (params.signers?.length) {
    lines.push(
      "Signers:",
      ...params.signers.map(
        (signer, index) => `${index + 1}. ${signer.account} (${signer.scopes})`,
      ),
    );
  }
  return lines.join("\n");
}

function applyStyles(
  element: HTMLElement,
  styles: Partial<CSSStyleDeclaration>,
): void {
  Object.assign(element.style, styles);
}

function createIntentLine(label: string, value: string): HTMLElement {
  const row = document.createElement("div");
  applyStyles(row, {
    display: "grid",
    gridTemplateColumns: "96px minmax(0, 1fr)",
    gap: "12px",
    alignItems: "start",
    padding: "10px 0",
    borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
  });
  const labelEl = document.createElement("span");
  labelEl.textContent = label;
  applyStyles(labelEl, {
    color: "#64748b",
    fontSize: "12px",
    fontWeight: "700",
    textTransform: "uppercase",
  });
  const valueEl = document.createElement("code");
  valueEl.textContent = value;
  applyStyles(valueEl, {
    color: "#0f172a",
    fontFamily:
      "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
    fontSize: "12px",
    lineHeight: "1.5",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  });
  row.append(labelEl, valueEl);
  return row;
}

function confirmWalletIntentInModal(
  params: InvokeParams,
  context?: WalletIntentConfirmationContext,
): Promise<boolean> {
  if (typeof document === "undefined" || !document.body) {
    if (typeof window !== "undefined" && typeof window.confirm === "function") {
      return Promise.resolve(
        window.confirm(buildWalletIntentSummary(params, context)),
      );
    }
    return Promise.reject(
      new Error("Wallet intent confirmation UI is not available."),
    );
  }

  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", "Confirm Neo transaction");
    applyStyles(overlay, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483647",
      display: "grid",
      placeItems: "center",
      padding: "20px",
      background: "rgba(15, 23, 42, 0.52)",
      backdropFilter: "blur(8px)",
      fontFamily:
        "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
    });

    const panel = document.createElement("section");
    applyStyles(panel, {
      width: "min(560px, 100%)",
      maxHeight: "min(720px, 92vh)",
      overflow: "auto",
      borderRadius: "8px",
      background: "#ffffff",
      boxShadow: "0 24px 70px rgba(15, 23, 42, 0.28)",
      border: "1px solid rgba(15, 23, 42, 0.10)",
    });

    const header = document.createElement("div");
    applyStyles(header, {
      padding: "22px 24px 16px",
      borderBottom: "1px solid rgba(15, 23, 42, 0.08)",
    });
    const eyebrow = document.createElement("div");
    eyebrow.textContent = context?.endpoint
      ? String(context.endpoint)
      : "Wallet confirmation";
    applyStyles(eyebrow, {
      color: "#0f766e",
      fontSize: "12px",
      fontWeight: "800",
      letterSpacing: "0",
      textTransform: "uppercase",
      marginBottom: "8px",
    });
    const title = document.createElement("h2");
    title.textContent = context?.title || "Confirm Neo transaction";
    applyStyles(title, {
      margin: "0",
      color: "#0f172a",
      fontSize: "22px",
      lineHeight: "1.2",
      letterSpacing: "0",
    });
    const copy = document.createElement("p");
    copy.textContent =
      "Review the contract, method, arguments, and signer before opening your wallet approval.";
    applyStyles(copy, {
      margin: "10px 0 0",
      color: "#475569",
      fontSize: "14px",
      lineHeight: "1.55",
    });
    header.append(eyebrow, title, copy);

    const body = document.createElement("div");
    applyStyles(body, { padding: "8px 24px 4px" });
    if (context?.appId) body.append(createIntentLine("MiniApp", context.appId));
    body.append(
      createIntentLine("Contract", params.scriptHash),
      createIntentLine("Method", params.operation),
    );
    if (params.args?.length) {
      body.append(
        createIntentLine(
          "Arguments",
          params.args
            .map(
              (arg, index) =>
                `${index + 1}. ${arg.type}: ${stringifyIntentValue(arg.value)}`,
            )
            .join("\n"),
        ),
      );
    }
    if (params.signers?.length) {
      body.append(
        createIntentLine(
          "Signers",
          params.signers
            .map(
              (signer, index) =>
                `${index + 1}. ${signer.account} (${signer.scopes})`,
            )
            .join("\n"),
        ),
      );
    }

    const footer = document.createElement("div");
    applyStyles(footer, {
      display: "flex",
      gap: "12px",
      justifyContent: "flex-end",
      padding: "18px 24px 24px",
    });
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.textContent = "Cancel";
    applyStyles(cancel, {
      minHeight: "40px",
      padding: "0 16px",
      borderRadius: "6px",
      border: "1px solid rgba(15, 23, 42, 0.18)",
      background: "#ffffff",
      color: "#0f172a",
      fontWeight: "700",
      cursor: "pointer",
    });
    const confirm = document.createElement("button");
    confirm.type = "button";
    confirm.textContent = "Open wallet";
    applyStyles(confirm, {
      minHeight: "40px",
      padding: "0 18px",
      borderRadius: "6px",
      border: "1px solid #0f766e",
      background: "#0f766e",
      color: "#ffffff",
      fontWeight: "800",
      cursor: "pointer",
    });
    footer.append(cancel, confirm);
    panel.append(header, body, footer);
    overlay.append(panel);

    const cleanup = (decision: boolean) => {
      document.removeEventListener("keydown", onKeyDown);
      overlay.remove();
      resolve(decision);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") cleanup(false);
    };
    cancel.addEventListener("click", () => cleanup(false));
    confirm.addEventListener("click", () => cleanup(true));
    document.addEventListener("keydown", onKeyDown);
    document.body.append(overlay);
    confirm.focus();
  });
}

async function confirmWalletIntent(
  params: InvokeParams,
  context?: WalletIntentConfirmationContext,
): Promise<void> {
  const hook =
    typeof window !== "undefined"
      ? window.NeoMiniAppWalletConfirmIntent
      : undefined;
  const accepted =
    typeof hook === "function"
      ? await hook(params, context)
      : await confirmWalletIntentInModal(params, context);
  if (!accepted) {
    throw new MiniAppError(
      "Wallet request canceled before submission.",
      ERROR_CODE_WALLET_CONFIRMATION_REJECTED,
      undefined,
      undefined,
      undefined,
      ERROR_CODE_WALLET_CONFIRMATION_REJECTED,
    );
  }
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

  // Reactive wallet state. `withValueCompat` exposes both the Observable
  // surface (`get`/`set`/`subscribe`) consumed by the React runtime and a
  // `.value` getter/setter so the rest of this SDK (and `refToObservable`
  // wrappers in the composables) keep working unchanged.
  const address = withValueCompat(createObservable<string | null>(null));
  const chainType = withValueCompat(createObservable("neo-n3"));
  const chainId = withValueCompat(createObservable("neo-n3"));
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
    const authenticated = await provider.authenticate(
      buildDapiAuthenticationPayload(supportedNetworks),
    );

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
    updateDapiNetwork(wallet.provider);
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

  const invokeWithConfirmation = async (
    params: InvokeParams,
    context?: WalletIntentConfirmationContext,
  ): Promise<InvokeResult> => {
    await confirmWalletIntent(params, context);
    return invokeContract(params);
  };

  const invokeMultiple = async (
    params: BatchInvokeParams,
  ): Promise<InvokeResult> => {
    const wallet = await ensureWalletProvider();
    if (!address.value) await connect();
    updateDapiNetwork(wallet.provider);
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
    updateDapiNetwork(wallet.provider);
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
    updateDapiNetwork(wallet.provider);
    assertWalletMatchesAppNetwork();

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
    updateDapiNetwork(wallet.provider);
    assertWalletMatchesAppNetwork();

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

    // Manifest-backed registry lookup before the URL fallback (matches the
    // events lane): a manifest without a contracts entry still resolves via
    // the generated MINIAPP_CONTRACTS registry keyed by its app id.
    const manifestAppId = String(manifest?.id ?? "").trim();
    const registryHash = manifestAppId
      ? getMiniAppContractHash(manifestAppId, network)
      : "";
    if (registryHash) return registryHash;

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
    invokeWithConfirmation,
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
