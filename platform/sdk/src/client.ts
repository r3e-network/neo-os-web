import type {
  APIKeyCreateResponse,
  APIKeyRevokeResponse,
  APIKeysListResponse,
  AppRegisterResponse,
  AppUpdateManifestResponse,
  AutomationDeleteResponse,
  AutomationExecution,
  AutomationStatusResponse,
  AutomationTrigger,
  AutomationTriggerRequest,
  EventsListParams,
  EventsListResponse,
  GasBankAccountResponse,
  GasBankDepositCreateResponse,
  GasBankDepositsResponse,
  GasBankTransactionsResponse,
  GasSponsorCheckResponse,
  GasSponsorRequestResponse,
  HostSDK,
  ContractParam,
  InvocationIntent,
  MiniAppSDK,
  MiniAppSDKConfig,
  MiniAppUsageResponse,
  SignedMessage,
  ComputeExecuteRequest,
  ComputeJob,
  OracleQueryRequest,
  OracleQueryResponse,
  PayGASResponse,
  PriceResponse,
  RNGResponse,
  SecretsDeleteResponse,
  SecretsGetResponse,
  SecretsListResponse,
  SecretsPermissionsResponse,
  SecretsUpsertResponse,
  TransactionsListParams,
  TransactionsListResponse,
  PrivacyMerklePathResponse,
  PrivacyRelayRequest,
  PrivacyRelayResponse,
  WalletProviderInfo,
  VoteBNEOResponse,
  WalletBindResponse,
  WalletNonceResponse,
} from "./types.js";
import {
  readImmediateNep21Provider,
  waitForNep21Provider,
  type NeoDapiAccount as DapiAccount,
  type NeoDapiProvider as BaseNeoDapiProvider,
} from "./nep21-provider.js";

const MAINNET_MAGIC = 860833102;
const TESTNET_MAGIC = 894710606;
const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;

/** NeoLine N3 wallet interface */
interface NeoLineN3Wallet {
  Init: new () => NeoLineN3Instance;
}

interface NeoLineN3Instance {
  getAccount: () => Promise<{
    address?: string;
    account?: { address?: string };
  }>;
  signMessage?: (params: { message: string }) => Promise<SignedMessage>;
  invoke: (params: NeoLineInvokeParams) => Promise<unknown>;
}

interface NeoLineInvokeParams {
  scriptHash: string;
  operation: string;
  args: unknown[];
  signers?: Array<{ account: string; scopes: string | number }>;
}

/** EIP-1193 compatible provider (MetaMask, etc.) */
interface EIP1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

type NeoDapiProvider = BaseNeoDapiProvider<ContractParam>;

type InjectedWalletContext =
  | {
      kind: "nep21";
      address: string;
      accountHash?: string;
      provider: NeoDapiProvider;
    }
  | { kind: "neoline"; address: string; instance: NeoLineN3Instance }
  | { kind: "evm"; address: string; provider: EIP1193Provider };

type NeoInvocationWalletContext = Extract<
  InjectedWalletContext,
  { kind: "nep21" } | { kind: "neoline" }
>;

/** Extended window with supported injected wallets */
interface WindowWithInjectedWallets extends Window {
  ethereum?: EIP1193Provider;
  NEOLineN3?: NeoLineN3Wallet;
  NEOLine?: NeoLineN3Wallet;
  [key: string]: unknown;
}

function encodeBase64Utf8(value: string): string {
  if (typeof btoa !== "function") return value;
  return btoa(unescape(encodeURIComponent(value)));
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

function readImmediateDapiProvider(): NeoDapiProvider | null {
  return readImmediateNep21Provider() as NeoDapiProvider | null;
}

function waitForDapiProvider(timeoutMs = 750): Promise<NeoDapiProvider | null> {
  const immediate = readImmediateDapiProvider();
  if (immediate) return Promise.resolve(immediate);
  if (typeof window === "undefined") return Promise.resolve(null);
  return waitForNep21Provider({ timeoutMs }).catch(() => null) as Promise<
    NeoDapiProvider | null
  >;
}

function getAuthenticationDomain(): string {
  if (typeof window === "undefined") return "localhost";
  return window.location.host || window.location.hostname || "localhost";
}

async function getNeoDapiContext(
  allowAuthenticate = true,
): Promise<Extract<InjectedWalletContext, { kind: "nep21" }> | null> {
  const provider = await waitForDapiProvider();
  if (!provider) return null;

  let accounts: DapiAccount[] = [];
  if (provider.getAccounts) {
    try {
      accounts = await provider.getAccounts();
    } catch {
      accounts = [];
    }
  }

  const account = accounts.find((entry) => entry.isDefault) ?? accounts[0];
  if (account) {
    const address = String(account.address ?? account.hash ?? "").trim();
    if (address) {
      return {
        kind: "nep21",
        address,
        accountHash: String(account.hash ?? "").trim() || undefined,
        provider,
      };
    }
  }

  if (!allowAuthenticate || !provider.authenticate) return null;

  const authenticated = await provider.authenticate({
    action: "Authentication",
    grant_type: "Signature",
    allowed_algorithms: ["ECDSA-P256"],
    domain: getAuthenticationDomain(),
    networks: provider.supportedNetworks?.length
      ? provider.supportedNetworks
      : [MAINNET_MAGIC, TESTNET_MAGIC],
    nonce: createNonce(),
    timestamp: Date.now(),
  });
  const address = String(authenticated.address ?? "").trim();
  if (!address) return null;
  return { kind: "nep21", address, provider };
}

async function getNeoLineContext(): Promise<Extract<
  InjectedWalletContext,
  { kind: "neoline" }
> | null> {
  if (typeof window === "undefined") return null;
  const g = window as unknown as WindowWithInjectedWallets;
  const neoline = g.NEOLineN3 ?? g.NEOLine;
  if (!neoline || typeof neoline.Init !== "function") return null;
  const instance = new neoline.Init();
  if (!instance || typeof instance.getAccount !== "function") return null;
  const res = await instance.getAccount();
  const address = String(res?.address ?? res?.account?.address ?? "").trim();
  if (!address) return null;
  return { kind: "neoline", address, instance };
}

async function getEvmContext(): Promise<Extract<
  InjectedWalletContext,
  { kind: "evm" }
> | null> {
  if (typeof window === "undefined") return null;
  const g = window as unknown as WindowWithInjectedWallets;
  if (!g.ethereum || typeof g.ethereum.request !== "function") return null;
  try {
    const accounts = (await g.ethereum.request({
      method: "eth_accounts",
    })) as unknown;
    if (Array.isArray(accounts) && accounts.length > 0) {
      const address = String(accounts[0] ?? "").trim();
      if (address) return { kind: "evm", address, provider: g.ethereum };
    }
  } catch {
    // User denied request or wallet unavailable — try the next wallet option.
  }
  return null;
}

async function getInjectedWalletContext(
  options: { allowDapiAuthenticate?: boolean; includeEvm?: boolean } = {},
): Promise<InjectedWalletContext> {
  if (typeof window === "undefined") {
    throw new Error("wallet methods must be called in a browser context");
  }

  const dapi = await getNeoDapiContext(options.allowDapiAuthenticate ?? true);
  if (dapi) return dapi;

  const neoline = await getNeoLineContext();
  if (neoline) return neoline;

  if (options.includeEvm ?? true) {
    const evm = await getEvmContext();
    if (evm) return evm;
  }

  throw new Error(
    "NEP-21 dAPI or NeoLine N3 wallet not detected, or host must bridge wallet methods",
  );
}

async function getInjectedNeoInvocationContext(): Promise<NeoInvocationWalletContext> {
  const context = await getInjectedWalletContext({ includeEvm: false });
  if (context.kind === "evm") {
    throw new Error(
      "direct contract invocation requires a Neo wallet provider",
    );
  }
  return context;
}

async function getInjectedWalletAddress(): Promise<string> {
  return (await getInjectedWalletContext()).address;
}

async function getWalletProviderInfo(): Promise<WalletProviderInfo> {
  const context = await getInjectedWalletContext({
    allowDapiAuthenticate: false,
  });
  if (context.kind === "nep21") {
    return {
      kind: "nep21",
      name: context.provider.name || "NEP-21 dAPI",
      network: context.provider.network,
      address: context.address,
      accountHash: context.accountHash,
    };
  }
  if (context.kind === "neoline")
    return { kind: "neoline", name: "NeoLine N3", address: context.address };
  return { kind: "evm", name: "EIP-1193", address: context.address };
}

async function signInjectedWalletMessage(
  message: string,
): Promise<SignedMessage> {
  const context = await getInjectedWalletContext({ includeEvm: false });
  if (context.kind === "nep21") {
    if (!context.provider.signMessage)
      throw new Error("NEP-21 wallet does not support signMessage");
    const signed = await context.provider.signMessage(
      encodeBase64Utf8(message),
      context.accountHash ?? context.address,
    );
    const signature = String(signed.signature ?? signed.data ?? "");
    return {
      publicKey: String(signed.pubkey ?? signed.publicKey ?? ""),
      data: signature,
      signature,
      account: signed.account,
      salt: String(signed.salt ?? ""),
      message: String(signed.message ?? message),
    };
  }
  if (context.kind === "neoline" && context.instance.signMessage) {
    return context.instance.signMessage({ message });
  }
  throw new Error("Connected wallet does not support signMessage");
}

// Resolve SENDER placeholder in invocation params with the user's wallet address.
// This is used for GAS.Transfer where the 'from' parameter must be the user's address.
function resolveInvocationParams(
  params: InvocationIntent["params"],
  userAddress: string,
): InvocationIntent["params"] {
  return params.map((param) => {
    if (param.type === "Hash160" && param.value === "SENDER") {
      return { type: "Hash160", value: userAddress };
    }
    if (param.type === "Array" && Array.isArray(param.value)) {
      return {
        type: "Array",
        value: resolveInvocationParams(param.value, userAddress),
      };
    }
    return param;
  });
}

async function invokeDirectInvocation(
  invocation: InvocationIntent,
): Promise<unknown> {
  const context = await getInjectedNeoInvocationContext();

  const scriptHash = String(invocation.contract_hash ?? "").trim();
  const operation = String(invocation.method ?? "").trim();

  if (!scriptHash) throw new Error("invocation missing contract_hash");
  if (!operation) throw new Error("invocation missing method");

  const signerAccount =
    context.kind === "nep21"
      ? (context.accountHash ?? context.address)
      : context.address;

  // Resolve SENDER placeholders in params with the user's actual Neo account.
  const rawArgs = Array.isArray(invocation.params) ? invocation.params : [];
  const args = resolveInvocationParams(rawArgs, signerAccount);

  if (context.kind === "nep21") {
    if (!context.provider.invoke) {
      throw new Error("NEP-21 wallet does not support invoke");
    }
    return context.provider.invoke(
      [{ hash: scriptHash, operation, args }],
      [{ account: signerAccount, scopes: "CalledByEntry" }],
    );
  }

  if (!context.instance || typeof context.instance.invoke !== "function") {
    throw new Error(
      "wallet does not support invoke (NEP-21 dAPI or NeoLine N3 required)",
    );
  }

  // Try strict CalledByEntry signer payloads with/without 0x script hash prefix.
  const candidates = [
    {
      scriptHash,
      operation,
      args,
      signers: [{ account: signerAccount, scopes: "CalledByEntry" }],
    },
    {
      scriptHash: scriptHash.replace(/^0x/i, ""),
      operation,
      args,
      signers: [{ account: signerAccount, scopes: "CalledByEntry" }],
    },
  ];

  let lastErr: unknown = null;
  for (const params of candidates) {
    try {
      return await context.instance.invoke(params);
    } catch (err) {
      lastErr = err;
    }
  }

  const tried = candidates
    .map(
      (c, i) =>
        `#${i + 1}{scriptHash=${c.scriptHash},scopes=${String(c.signers?.[0]?.scopes ?? "none")}}`,
    )
    .join("; ");
  const lastMessage =
    lastErr instanceof Error
      ? lastErr.message
      : String(lastErr ?? "invoke failed");
  throw new Error(
    `NeoLine invoke failed after ${candidates.length} candidate(s): ${tried}. Last error: ${lastMessage}`,
  );
}

// Pending invocation intents are consumable exactly once: wallet.invokeIntent
// and the *AndInvoke helpers both remove the stored entry before submitting,
// so a request_id can never replay the same to-be-signed invocation. Entries
// also expire (TTL) and the map is capped so abandoned intents cannot grow it
// unboundedly.
const PENDING_INVOCATION_TTL_MS = 10 * 60 * 1000;
const PENDING_INVOCATION_MAX_ENTRIES = 64;

type PendingInvocationEntry = {
  invocation: InvocationIntent;
  expiresAt: number;
};

type PendingInvocationMap = Map<string, PendingInvocationEntry>;

function prunePendingInvocations(pending: PendingInvocationMap): void {
  const now = Date.now();
  for (const [requestId, entry] of pending) {
    if (entry.expiresAt <= now) pending.delete(requestId);
  }
}

function rememberPendingInvocation(
  pending: PendingInvocationMap,
  requestId: string,
  invocation: InvocationIntent,
): void {
  prunePendingInvocations(pending);
  pending.delete(requestId);
  pending.set(requestId, {
    invocation,
    expiresAt: Date.now() + PENDING_INVOCATION_TTL_MS,
  });
  // Maps iterate in insertion order, so evicting from the front drops the
  // oldest intents first once the cap is exceeded.
  while (pending.size > PENDING_INVOCATION_MAX_ENTRIES) {
    const oldest = pending.keys().next().value;
    if (oldest === undefined) break;
    pending.delete(oldest);
  }
}

function takePendingInvocation(
  pending: PendingInvocationMap,
  requestId: string,
): InvocationIntent | null {
  const entry = pending.get(requestId);
  if (!entry) return null;
  pending.delete(requestId);
  if (entry.expiresAt <= Date.now()) return null;
  return entry.invocation;
}

/**
 * Typed SDK error surface: every non-2xx edge response and every malformed
 * success payload is thrown as an SDKError carrying the HTTP status, a
 * stable machine-readable code, the requested edge path, and the server
 * body (parsed JSON when possible, raw text otherwise).
 *
 * `status` is 0 when the request was never sent (client-side failures such
 * as a missing API key). `code` is the server-provided error code when the
 * body matches the edge `{ error: { code, message } }` shape, otherwise a
 * synthetic `HTTP_<status>` / `INVALID_JSON` / `NON_OBJECT_RESPONSE` /
 * `API_KEY_REQUIRED` / `ENDPOINT_RETIRED` code.
 */
export class SDKError extends Error {
  readonly status: number;
  readonly code: string;
  readonly path: string;
  readonly body?: unknown;

  constructor(params: {
    status: number;
    code: string;
    message: string;
    path: string;
    body?: unknown;
  }) {
    super(params.message);
    this.name = "SDKError";
    this.status = params.status;
    this.code = params.code;
    this.path = params.path;
    this.body = params.body;
  }
}

// Edge functions reply `{ error: { code, message } }` (see
// platform/edge/functions/_shared/response.ts); tolerate the flat
// `{ error: "..." }` and `{ code, message }` shapes as well.
function extractServerError(body: unknown): {
  code?: string;
  message?: string;
} {
  if (typeof body !== "object" || body === null) return {};
  const record = body as Record<string, unknown>;
  const error = record.error;
  if (typeof error === "string" && error.trim()) return { message: error };
  const source =
    typeof error === "object" && error !== null
      ? (error as Record<string, unknown>)
      : record;
  return {
    code:
      typeof source.code === "string" && source.code.trim()
        ? source.code
        : undefined,
    message:
      typeof source.message === "string" && source.message.trim()
        ? source.message
        : undefined,
  };
}

type RequestJSONOptions = {
  /** Host-only endpoints require API-key auth; bearer JWTs are not sent. */
  hostOnly?: boolean;
};

async function requestJSON<T>(
  cfg: MiniAppSDKConfig,
  path: string,
  init: RequestInit,
  options: RequestJSONOptions = {},
): Promise<T> {
  const base = cfg.edgeBaseUrl.replace(/\/$/, "");
  const url = `${base}${path.startsWith("/") ? "" : "/"}${path}`;

  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (options.hostOnly) {
    const apiKey = cfg.getAPIKey ? await cfg.getAPIKey() : undefined;
    if (!apiKey) {
      throw new SDKError({
        status: 0,
        code: "API_KEY_REQUIRED",
        message: "API key required for host-only endpoint",
        path,
      });
    }
    headers.set("X-API-Key", apiKey);
  } else {
    if (cfg.getAuthToken) {
      const token = await cfg.getAuthToken();
      if (token) headers.set("Authorization", `Bearer ${token}`);
    }
    if (!headers.get("Authorization") && cfg.getAPIKey) {
      const apiKey = await cfg.getAPIKey();
      if (apiKey) headers.set("X-API-Key", apiKey);
    }
  }

  const resp = await fetch(url, {
    ...init,
    headers,
    signal: init.signal ?? AbortSignal.timeout(DEFAULT_REQUEST_TIMEOUT_MS),
  });
  const text = await resp.text();

  let parsed: unknown;
  let parseFailed = false;
  try {
    parsed = JSON.parse(text);
  } catch {
    parseFailed = true;
  }

  if (!resp.ok) {
    const serverError = parseFailed ? {} : extractServerError(parsed);
    throw new SDKError({
      status: resp.status,
      code: serverError.code ?? `HTTP_${resp.status}`,
      message: serverError.message
        ? `request failed (${resp.status}): ${serverError.message}`
        : `request failed (${resp.status})`,
      path,
      body: parseFailed ? text : parsed,
    });
  }

  if (parseFailed) {
    throw new SDKError({
      status: resp.status,
      code: "INVALID_JSON",
      message: `invalid JSON response from ${path}`,
      path,
      body: text,
    });
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new SDKError({
      status: resp.status,
      code: "NON_OBJECT_RESPONSE",
      message: `unexpected non-object response from ${path}`,
      path,
      body: parsed,
    });
  }
  return parsed as T;
}

async function requestHostJSON<T>(
  cfg: MiniAppSDKConfig,
  path: string,
  init: RequestInit,
): Promise<T> {
  return requestJSON<T>(cfg, path, init, { hostOnly: true });
}

/**
 * These gateway methods pointed at Supabase Edge functions that no longer
 * exist — the TEE-forwarding lane (RNG / data feed / oracle fetch / compute
 * / privacy relay) was removed when the platform moved to the Morpheus
 * oracle runtime and self-contained miniapp contracts. The method surface
 * is kept so existing callers fail loudly with a typed error instead of an
 * opaque 404 from a non-existent function.
 */
function retiredEndpoint(method: string, replacement: string): never {
  throw new SDKError({
    status: 410,
    code: "ENDPOINT_RETIRED",
    message: `${method} endpoint retired — use ${replacement}`,
    path: method,
  });
}

export function createMiniAppSDK(cfg: MiniAppSDKConfig): MiniAppSDK {
  const pendingInvocations: PendingInvocationMap = new Map();

  return {
    async getAddress() {
      return getInjectedWalletAddress();
    },
    wallet: {
      async getAddress() {
        return getInjectedWalletAddress();
      },
      async getProviderInfo() {
        return getWalletProviderInfo();
      },
      async signMessage(message: string) {
        return signInjectedWalletMessage(message);
      },
      async invokeIntent(requestId: string): Promise<unknown> {
        const id = String(requestId ?? "").trim();
        if (!id) throw new Error("request_id required");
        const invocation = takePendingInvocation(pendingInvocations, id);
        if (!invocation)
          throw new Error("unknown request_id (no pending invocation)");
        return invokeDirectInvocation(invocation);
      },
      async invokeInvocation(invocation: InvocationIntent): Promise<unknown> {
        return invokeDirectInvocation(invocation);
      },
    },
    payments: {
      async payGAS(
        appId: string,
        amount: string,
        memo?: string,
      ): Promise<PayGASResponse> {
        const res = await requestJSON<PayGASResponse>(cfg, "/pay-gas", {
          method: "POST",
          body: JSON.stringify({ app_id: appId, amount_gas: amount, memo }),
        });
        rememberPendingInvocation(
          pendingInvocations,
          res.request_id,
          res.invocation,
        );
        return res;
      },
      async payGASAndInvoke(appId: string, amount: string, memo?: string) {
        const intent = await this.payGAS(appId, amount, memo);
        // Consume the stored intent so a later invokeIntent cannot replay
        // the same payment invocation.
        pendingInvocations.delete(intent.request_id);
        const tx = await invokeDirectInvocation(intent.invocation);
        return { intent, tx };
      },
    },
    governance: {
      async vote(
        appId: string,
        proposalId: string,
        bneoAmount: string,
        support?: boolean,
      ): Promise<VoteBNEOResponse> {
        const res = await requestJSON<VoteBNEOResponse>(cfg, "/vote-bneo", {
          method: "POST",
          body: JSON.stringify({
            app_id: appId,
            proposal_id: proposalId,
            bneo_amount: bneoAmount,
            support,
          }),
        });
        rememberPendingInvocation(
          pendingInvocations,
          res.request_id,
          res.invocation,
        );
        return res;
      },
      async voteAndInvoke(
        appId: string,
        proposalId: string,
        bneoAmount: string,
        support?: boolean,
      ) {
        const intent = await this.vote(appId, proposalId, bneoAmount, support);
        // Consume the stored intent so a later invokeIntent cannot replay
        // the same governance invocation.
        pendingInvocations.delete(intent.request_id);
        const tx = await invokeDirectInvocation(intent.invocation);
        return { intent, tx };
      },
    },
    rng: {
      async requestRandom(_appId: string): Promise<RNGResponse> {
        return retiredEndpoint(
          "rng.requestRandom",
          "on-chain randomness (Runtime.GetRandom) in your miniapp contract",
        );
      },
    },
    datafeed: {
      async getPrice(_symbol: string): Promise<PriceResponse> {
        return retiredEndpoint(
          "datafeed.getPrice",
          "the on-chain MorpheusDataFeed contract (getLatest) for price reads",
        );
      },
    },
    stats: {
      async getMyUsage(appId?: string, date?: string) {
        const resolvedAppId = String(appId ?? cfg.appId ?? "").trim();
        const qs = new URLSearchParams();
        if (resolvedAppId) qs.set("app_id", resolvedAppId);
        if (date) qs.set("date", date);
        const path = qs.toString()
          ? `/miniapp-usage?${qs.toString()}`
          : "/miniapp-usage";
        const res = await requestJSON<MiniAppUsageResponse>(cfg, path, {
          method: "GET",
        });
        return res.usage;
      },
    },
    events: {
      async list(params: EventsListParams): Promise<EventsListResponse> {
        const qs = new URLSearchParams();
        if (params.app_id) qs.set("app_id", params.app_id);
        if (params.event_name) qs.set("event_name", params.event_name);
        if (params.contract_hash) qs.set("contract_hash", params.contract_hash);
        if (params.limit) qs.set("limit", String(params.limit));
        if (params.after_id) qs.set("after_id", params.after_id);
        return requestJSON<EventsListResponse>(
          cfg,
          `/events-list?${qs.toString()}`,
          { method: "GET" },
        );
      },
    },
    transactions: {
      async list(
        params: TransactionsListParams,
      ): Promise<TransactionsListResponse> {
        const qs = new URLSearchParams();
        if (params.app_id) qs.set("app_id", params.app_id);
        if (params.limit) qs.set("limit", String(params.limit));
        if (params.after_id) qs.set("after_id", params.after_id);
        return requestJSON<TransactionsListResponse>(
          cfg,
          `/transactions-list?${qs.toString()}`,
          { method: "GET" },
        );
      },
    },
    privacy: {
      async getMerklePath(
        _commitment: string,
      ): Promise<PrivacyMerklePathResponse> {
        return retiredEndpoint(
          "privacy.getMerklePath",
          "direct contract reads; the privacy relayer gateway was removed",
        );
      },
      async relay(
        _params: PrivacyRelayRequest,
      ): Promise<PrivacyRelayResponse> {
        return retiredEndpoint(
          "privacy.relay",
          "a wallet-signed transaction; the privacy relayer gateway was removed",
        );
      },
    },
    gasSponsor: {
      async check(): Promise<GasSponsorCheckResponse> {
        return requestJSON<GasSponsorCheckResponse>(cfg, "/gas-sponsor-check", {
          method: "GET",
        });
      },
      async request(amount: string): Promise<GasSponsorRequestResponse> {
        if (!amount || typeof amount !== "string" || !amount.trim())
          throw new Error("amount is required");
        return requestJSON<GasSponsorRequestResponse>(
          cfg,
          "/gas-sponsor-request",
          {
            method: "POST",
            body: JSON.stringify({ amount }),
          },
        );
      },
    },
  };
}

/**
 * Audit fix H-4: refuse to construct the Host SDK in a browser context.
 *
 * The Host SDK exposes host-only methods (oracle, compute, automation,
 * secrets, apiKeys) that should never be reachable from a miniapp's iframe.
 * The Admin SDK already had this guard (admin.ts:55); apply the same
 * pattern here so a developer mistake (e.g. calling installMiniAppSDK with
 * a host-SDK config) fails loudly instead of silently leaking the API
 * key to every miniapp running on the page.
 *
 * Set HOST_SDK_ALLOW_BROWSER=true at build time only to opt out (e.g. for
 * specific test harnesses that intentionally run host-SDK code in a
 * browser-like jsdom environment).
 */
function assertHostSdkServerContext(): void {
  if (typeof window === "undefined") return;
  const allowBrowser =
    typeof process !== "undefined" &&
    process.env?.HOST_SDK_ALLOW_BROWSER === "true";
  if (allowBrowser) return;
  throw new Error(
    "createHostSDK is server-only. Do not bundle host-SDK code into the browser bundle.",
  );
}

export function createHostSDK(cfg: MiniAppSDKConfig): HostSDK {
  assertHostSdkServerContext();
  const mini = createMiniAppSDK(cfg);

  return {
    ...mini,
    wallet: {
      ...mini.wallet,
      async getBindMessage(): Promise<WalletNonceResponse> {
        return requestJSON<WalletNonceResponse>(cfg, "/wallet-nonce", {
          method: "POST",
          body: JSON.stringify({}),
        });
      },
      async bindWallet(params: {
        address: string;
        publicKey: string;
        signature: string;
        message: string;
        nonce: string;
        label?: string;
      }): Promise<WalletBindResponse> {
        return requestJSON<WalletBindResponse>(cfg, "/wallet-bind", {
          method: "POST",
          body: JSON.stringify({
            address: params.address,
            public_key: params.publicKey,
            signature: params.signature,
            message: params.message,
            nonce: params.nonce,
            label: params.label,
          }),
        });
      },
    },
    apps: {
      async register(params: {
        manifest: Record<string, unknown>;
      }): Promise<AppRegisterResponse> {
        return requestJSON<AppRegisterResponse>(cfg, "/app-register", {
          method: "POST",
          body: JSON.stringify({
            manifest: params.manifest,
          }),
        });
      },
      async updateManifest(params: {
        manifest: Record<string, unknown>;
      }): Promise<AppUpdateManifestResponse> {
        return requestJSON<AppUpdateManifestResponse>(
          cfg,
          "/app-update-manifest",
          {
            method: "POST",
            body: JSON.stringify({
              manifest: params.manifest,
            }),
          },
        );
      },
    },
    oracle: {
      async query(_params: OracleQueryRequest): Promise<OracleQueryResponse> {
        return retiredEndpoint(
          "oracle.query",
          "the Morpheus oracle runtime (oracle.query workflow) directly",
        );
      },
    },
    compute: {
      async execute(_params: ComputeExecuteRequest): Promise<ComputeJob> {
        return retiredEndpoint(
          "compute.execute",
          "the Morpheus oracle runtime for TEE compute",
        );
      },
      async listJobs(): Promise<ComputeJob[]> {
        return retiredEndpoint(
          "compute.listJobs",
          "the Morpheus oracle runtime for TEE compute",
        );
      },
      async getJob(_id: string): Promise<ComputeJob> {
        return retiredEndpoint(
          "compute.getJob",
          "the Morpheus oracle runtime for TEE compute",
        );
      },
    },
    automation: {
      async listTriggers(): Promise<AutomationTrigger[]> {
        return requestHostJSON<AutomationTrigger[]>(
          cfg,
          "/automation-triggers",
          { method: "GET" },
        );
      },
      async createTrigger(
        params: AutomationTriggerRequest,
      ): Promise<AutomationTrigger> {
        return requestHostJSON<AutomationTrigger>(cfg, "/automation-triggers", {
          method: "POST",
          body: JSON.stringify(params),
        });
      },
      async getTrigger(id: string): Promise<AutomationTrigger> {
        if (!id || typeof id !== "string" || !id.trim())
          throw new Error("id is required for getTrigger");
        return requestHostJSON<AutomationTrigger>(
          cfg,
          `/automation-trigger?id=${encodeURIComponent(id)}`,
          {
            method: "GET",
          },
        );
      },
      async updateTrigger(
        id: string,
        params: AutomationTriggerRequest,
      ): Promise<AutomationTrigger> {
        return requestHostJSON<AutomationTrigger>(
          cfg,
          "/automation-trigger-update",
          {
            method: "POST",
            body: JSON.stringify({ id, ...params }),
          },
        );
      },
      async deleteTrigger(id: string): Promise<AutomationDeleteResponse> {
        return requestHostJSON<AutomationDeleteResponse>(
          cfg,
          "/automation-trigger-delete",
          {
            method: "POST",
            body: JSON.stringify({ id }),
          },
        );
      },
      async enableTrigger(id: string): Promise<AutomationStatusResponse> {
        return requestHostJSON<AutomationStatusResponse>(
          cfg,
          "/automation-trigger-enable",
          {
            method: "POST",
            body: JSON.stringify({ id }),
          },
        );
      },
      async disableTrigger(id: string): Promise<AutomationStatusResponse> {
        return requestHostJSON<AutomationStatusResponse>(
          cfg,
          "/automation-trigger-disable",
          {
            method: "POST",
            body: JSON.stringify({ id }),
          },
        );
      },
      async resumeTrigger(id: string): Promise<AutomationStatusResponse> {
        return requestHostJSON<AutomationStatusResponse>(
          cfg,
          "/automation-trigger-resume",
          {
            method: "POST",
            body: JSON.stringify({ id }),
          },
        );
      },
      async listExecutions(
        id: string,
        limit?: number,
      ): Promise<AutomationExecution[]> {
        const qs = new URLSearchParams({ id });
        if (typeof limit === "number" && Number.isFinite(limit))
          qs.set("limit", String(limit));
        return requestHostJSON<AutomationExecution[]>(
          cfg,
          `/automation-trigger-executions?${qs.toString()}`,
          {
            method: "GET",
          },
        );
      },
    },
    secrets: {
      async list(): Promise<SecretsListResponse> {
        return requestHostJSON<SecretsListResponse>(cfg, "/secrets-list", {
          method: "GET",
        });
      },
      async get(name: string): Promise<SecretsGetResponse> {
        if (!name || typeof name !== "string" || !name.trim())
          throw new Error("name is required for secrets.get");
        return requestHostJSON<SecretsGetResponse>(
          cfg,
          `/secrets-get?name=${encodeURIComponent(name)}`,
          {
            method: "GET",
          },
        );
      },
      async upsert(
        name: string,
        value: string,
      ): Promise<SecretsUpsertResponse> {
        return requestHostJSON<SecretsUpsertResponse>(cfg, "/secrets-upsert", {
          method: "POST",
          body: JSON.stringify({ name, value }),
        });
      },
      async delete(name: string): Promise<SecretsDeleteResponse> {
        return requestHostJSON<SecretsDeleteResponse>(cfg, "/secrets-delete", {
          method: "POST",
          body: JSON.stringify({ name }),
        });
      },
      async setPermissions(
        name: string,
        services: string[],
      ): Promise<SecretsPermissionsResponse> {
        return requestHostJSON<SecretsPermissionsResponse>(
          cfg,
          "/secrets-permissions",
          {
            method: "POST",
            body: JSON.stringify({ name, services }),
          },
        );
      },
    },
    apiKeys: {
      async list(): Promise<APIKeysListResponse> {
        return requestJSON<APIKeysListResponse>(cfg, "/api-keys-list", {
          method: "GET",
        });
      },
      async create(params: {
        name: string;
        scopes?: string[];
        description?: string;
        expires_at?: string;
      }): Promise<APIKeyCreateResponse> {
        return requestJSON<APIKeyCreateResponse>(cfg, "/api-keys-create", {
          method: "POST",
          body: JSON.stringify({
            name: params.name,
            scopes: params.scopes,
            description: params.description,
            expires_at: params.expires_at,
          }),
        });
      },
      async revoke(id: string): Promise<APIKeyRevokeResponse> {
        return requestJSON<APIKeyRevokeResponse>(cfg, "/api-keys-revoke", {
          method: "POST",
          body: JSON.stringify({ id }),
        });
      },
    },
    gasbank: {
      async getAccount(): Promise<GasBankAccountResponse> {
        return requestJSON<GasBankAccountResponse>(cfg, "/gasbank-account", {
          method: "GET",
        });
      },
      async listDeposits(): Promise<GasBankDepositsResponse> {
        return requestJSON<GasBankDepositsResponse>(cfg, "/gasbank-deposits", {
          method: "GET",
        });
      },
      async createDeposit(params: {
        amount: string;
        from_address: string;
        tx_hash?: string;
      }): Promise<GasBankDepositCreateResponse> {
        return requestJSON<GasBankDepositCreateResponse>(
          cfg,
          "/gasbank-deposit",
          {
            method: "POST",
            body: JSON.stringify({
              amount: params.amount,
              from_address: params.from_address,
              tx_hash: params.tx_hash,
            }),
          },
        );
      },
      async listTransactions(): Promise<GasBankTransactionsResponse> {
        return requestJSON<GasBankTransactionsResponse>(
          cfg,
          "/gasbank-transactions",
          { method: "GET" },
        );
      },
    },
  };
}
