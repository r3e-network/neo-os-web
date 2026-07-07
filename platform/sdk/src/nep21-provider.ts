export type NeoDapiEventName =
  | "accountchanged"
  | "accountschanged"
  | "networkchanged";

export type NeoDapiAccount = {
  hash?: string;
  accountHash?: string;
  address?: string;
  label?: string;
  isDefault?: boolean;
};

export type NeoDapiInvocation<TArg = { type: string; value: unknown }> = {
  hash: string;
  operation: string;
  args?: TArg[];
  abortOnFail?: boolean;
};

export type NeoDapiAuthenticationResponse = {
  network?: number;
  address?: string;
  accountHash?: string;
  hash?: string;
  scriptHash?: string;
  nonce?: string;
  pubkey?: string;
  signature?: string;
};

export type NeoDapiAuthenticationPayload = {
  action: "Authentication";
  grant_type: "Signature";
  allowed_algorithms: ["ECDSA-P256"];
  domain: string;
  networks: number[];
  nonce: string;
  timestamp: number;
  Action?: "Authentication";
  Domain?: string;
  Networks?: number[];
  Nonce?: number;
  Timestamp?: number;
};

export type NeoDapiPaymentRequest<TArg = { type: string; value: unknown }> = {
  asset: string;
  from?: string;
  to: string;
  amount: string;
  data?: TArg;
  purpose?: string;
  details?: string;
  timeoutSeconds?: number;
};

export type NeoDapiPaymentResult = {
  transactionHash: string;
  blockTime?: number;
  succeeded: boolean;
  confirmed?: boolean;
};

export interface NeoDapiProvider<
  TArg = { type: string; value: unknown },
  TCallResult = unknown,
> {
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
  authenticate?: (
    payload: NeoDapiAuthenticationPayload,
  ) => Promise<NeoDapiAuthenticationResponse>;
  call?: (invocation: NeoDapiInvocation<TArg>) => Promise<TCallResult>;
  getAccounts: () => Promise<NeoDapiAccount[]>;
  getNetwork?: () => Promise<unknown> | unknown;
  getBalance?: (asset: string, account?: string) => Promise<unknown>;
  invoke?: (
    invocations: NeoDapiInvocation<TArg>[],
    signers?: Array<Record<string, unknown>>,
    suggestedSystemFee?: string,
  ) => Promise<unknown>;
  send?: (
    asset: string,
    from: string,
    to: string,
    amount: string,
    data?: TArg,
  ) => Promise<unknown>;
  requestPayment?: (
    request: NeoDapiPaymentRequest<TArg>,
  ) => Promise<NeoDapiPaymentResult>;
  signMessage?: (
    message: string,
    account?: string,
  ) => Promise<{
    signature?: string;
    data?: string;
    account?: string;
    pubkey?: string;
    publicKey?: string;
    salt?: string;
    message?: string;
  }>;
}

export type Nep21ProviderPreference = "any" | "onegate" | "neoline";

export type Nep21Window = Window & {
  NEP21Provider?: unknown;
  NEP21Providers?: Record<string, unknown> | unknown[];
  Neo?: { DapiProvider?: unknown };
  OneGateDapiProvider?: unknown;
  NEOLine?: unknown;
  NEOLineN3?: unknown;
  neoDapiProvider?: unknown;
  neoDapi?: unknown;
};

type Candidate = {
  provider: unknown;
  key?: string;
};

type HostBridgeRequestPayload =
  | Record<string, unknown>
  | unknown[]
  | string
  | number
  | boolean
  | null
  | undefined;

type HostBridgeResponse = {
  type?: string;
  id?: unknown;
  ok?: unknown;
  result?: unknown;
  error?: { message?: unknown } | string;
  protocolVersion?: unknown;
};

type HostBridgeStateMessage = {
  type?: string;
  state?: unknown;
  protocolVersion?: unknown;
};

const HOST_WALLET_BRIDGE_REQUEST = "neo-miniapp-wallet-bridge:request";
const HOST_WALLET_BRIDGE_RESPONSE = "neo-miniapp-wallet-bridge:response";
export const HOST_WALLET_BRIDGE_STATE = "neo-miniapp-wallet-bridge:state";

// Versioned protocol contract for the host<->iframe wallet bridge.
//
// This module is the embedded miniapp (iframe) end of the bridge. It lives in a
// separate npm workspace from the host shell
// (platform/host-app/components/playarea/bridge/events.ts) with no shared
// dependency, so both sides declare identical copies of these values. A parity
// test asserts they never drift. Keep these in lockstep with the host module
// (see HOST_WALLET_BRIDGE_PROTOCOL_VERSION there).
export const HOST_WALLET_BRIDGE_PROTOCOL_VERSION = 1;
// Versions this SDK accepts on a host response envelope. A missing version is
// the pre-negotiation baseline and is treated as the current protocol so an
// older host keeps working unchanged.
export const HOST_WALLET_BRIDGE_COMPATIBLE_PROTOCOL_VERSIONS: readonly number[] =
  [HOST_WALLET_BRIDGE_PROTOCOL_VERSION];

export function normalizeBridgeProtocolVersion(
  value: unknown,
): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value === "number" && Number.isInteger(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isInteger(parsed)) return parsed;
  }
  // Present but unparseable — never in the compatible set, so the response is
  // rejected rather than silently accepted.
  return Number.NaN;
}

export function isCompatibleBridgeProtocolVersion(
  version: number | null | undefined,
): boolean {
  if (version === null || version === undefined) return true;
  return HOST_WALLET_BRIDGE_COMPATIBLE_PROTOCOL_VERSIONS.includes(version);
}

const HOST_WALLET_BRIDGE_TIMEOUT_MS = 8000;
const MAINNET_MAGIC = 860833102;
const TESTNET_MAGIC = 894710606;

let cachedProvider: NeoDapiProvider | null = null;
let cachedWindow: Nep21Window | null = null;
let cachedHostBridgeProvider: NeoDapiProvider | null = null;
let cachedHostBridgeWindow: Nep21Window | null = null;
let cachedHostBridgeStateCleanup: (() => void) | null = null;
let cachedLegacyNeoLineProvider: NeoDapiProvider | null = null;
let cachedLegacyNeoLineWindow: Nep21Window | null = null;
let hostBridgeRequestId = 0;

type LegacyNeoLineN3Account = {
  address?: unknown;
  label?: unknown;
  isLedger?: unknown;
};

type LegacyNeoLineN3Api = {
  EVENT?: Record<string, string>;
  getProvider?: () => Promise<unknown>;
  getNetworks?: () => Promise<unknown>;
  getAccount?: () => Promise<LegacyNeoLineN3Account>;
  pickAddress?: () => Promise<LegacyNeoLineN3Account>;
  switchWalletAccount?: () => Promise<LegacyNeoLineN3Account>;
  getPublicKey?: () => Promise<{ publicKey?: unknown; pubkey?: unknown }>;
  AddressToScriptHash?: (payload: { address: string }) => Promise<{ scriptHash?: unknown }>;
  getBalance?: (payload?: unknown) => Promise<unknown>;
  invokeRead?: (payload: unknown) => Promise<unknown>;
  invoke?: (payload: unknown) => Promise<unknown>;
  invokeMultiple?: (payload: unknown) => Promise<unknown>;
  send?: (payload: unknown) => Promise<unknown>;
  signMessage?: (payload: unknown) => Promise<unknown>;
  addEventListener?: (eventName: string, listener: () => void) => void;
  removeEventListener?: (eventName: string, listener: () => void) => void;
};

function getTargetWindow(targetWindow?: Window): Nep21Window | null {
  if (targetWindow) return targetWindow as Nep21Window;
  if (typeof window === "undefined") return null;
  return window as Nep21Window;
}

function hasNep21Metadata(provider: Partial<NeoDapiProvider>): boolean {
  const version = String(provider.dapiVersion ?? "").trim();
  const compatible = Array.isArray(provider.compatibility)
    ? provider.compatibility.some(
        (entry) => String(entry).toUpperCase() === "NEP-21",
      )
    : false;
  return compatible || version === "1.0" || version.startsWith("1.0.");
}

function hasUsableDapiCapability(provider: Partial<NeoDapiProvider>): boolean {
  return (
    typeof provider.invoke === "function" ||
    typeof provider.call === "function" ||
    typeof provider.send === "function" ||
    typeof provider.requestPayment === "function" ||
    typeof provider.signMessage === "function" ||
    typeof provider.authenticate === "function" ||
    typeof provider.getBalance === "function"
  );
}

export function isNep21Provider(value: unknown): value is NeoDapiProvider {
  if (!value || typeof value !== "object") return false;
  const provider = value as Partial<NeoDapiProvider>;
  return (
    typeof provider.getAccounts === "function" &&
    (hasNep21Metadata(provider) || hasUsableDapiCapability(provider))
  );
}

function registryCandidates(
  registry: Nep21Window["NEP21Providers"],
): Candidate[] {
  if (!registry || typeof registry !== "object") return [];
  return Object.entries(registry as Record<string, unknown>).map(
    ([key, provider]) => ({
      key,
      provider,
    }),
  );
}

function providerCandidates(win: Nep21Window): Candidate[] {
  const directCandidates: Candidate[] = [
    { provider: win.NEP21Provider },
    ...registryCandidates(win.NEP21Providers),
    { provider: win.OneGateDapiProvider },
    { provider: win.Neo?.DapiProvider },
    { provider: win.neoDapiProvider },
    { provider: win.neoDapi },
    { provider: getLegacyNeoLineN3Provider(win), key: "neoline-legacy-n3" },
  ];
  const hostBridge = getHostWalletBridgeProvider(win);
  if (!hostBridge) return directCandidates;

  // Embedded miniapps run in a sandboxed opaque origin. Browser wallet
  // extensions can still attempt direct injection there, but many fail because
  // storage is unavailable. Prefer the explicit host bridge in embeds so
  // signing and network checks always run in the top-level trusted shell.
  return [{ provider: hostBridge, key: "yiwu-host" }, ...directCandidates];
}

function providerMatchesPreference(
  win: Nep21Window,
  provider: NeoDapiProvider,
  preference: Nep21ProviderPreference,
  key?: string,
): boolean {
  if (preference === "any") return true;
  const name = String(provider.name ?? key ?? "").toLowerCase();
  if (preference === "onegate") {
    return win.OneGateDapiProvider === provider || name.includes("onegate");
  }
  if (preference === "neoline") {
    return name.includes("neoline") || name.includes("neo line");
  }
  return false;
}

function findProviderCandidate(
  win: Nep21Window,
  preference: Nep21ProviderPreference,
): NeoDapiProvider | null {
  const candidates = providerCandidates(win);
  const match = candidates.find(
    (candidate) =>
      isNep21Provider(candidate.provider) &&
      providerMatchesPreference(
        win,
        candidate.provider,
        preference,
        candidate.key,
      ),
  );
  return isNep21Provider(match?.provider) ? match.provider : null;
}

function providerStillVisible(
  win: Nep21Window,
  provider: NeoDapiProvider,
  preference: Nep21ProviderPreference,
): boolean {
  return providerCandidates(win).some(
    (candidate) =>
      candidate.provider === provider &&
      providerMatchesPreference(win, provider, preference, candidate.key),
  );
}

export function rememberNep21Provider(
  provider: unknown,
  targetWindow?: Window,
): NeoDapiProvider | null {
  if (!isNep21Provider(provider)) return null;
  const win = getTargetWindow(targetWindow);
  if (!win) return provider;
  cachedProvider = provider;
  cachedWindow = win;
  const writableWindow = win as {
    NEP21Provider?: NeoDapiProvider;
    NEP21Providers?: Record<string, unknown> | unknown[];
  };
  writableWindow.NEP21Provider = provider;
  const registry =
    writableWindow.NEP21Providers &&
    typeof writableWindow.NEP21Providers === "object"
      ? { ...(writableWindow.NEP21Providers as Record<string, unknown>) }
      : {};
  const name = String(provider.name ?? "").trim();
  if (name) registry[name] = provider;
  writableWindow.NEP21Providers = registry;
  return provider;
}

export function readImmediateNep21Provider(
  options: {
    preference?: Nep21ProviderPreference;
    targetWindow?: Window;
  } = {},
): NeoDapiProvider | null {
  const preference = options.preference ?? "any";
  const win = getTargetWindow(options.targetWindow);
  if (!win) return null;
  if (
    cachedProvider &&
    cachedWindow === win &&
    providerStillVisible(win, cachedProvider, preference)
  ) {
    return cachedProvider;
  }
  const provider = findProviderCandidate(win, preference);
  return provider ? rememberNep21Provider(provider, win) : null;
}

export function extractNep21ProviderFromReadyEvent(event: Event): unknown {
  const detail = (event as CustomEvent<unknown>).detail;
  if (isNep21Provider(detail)) return detail;
  if (detail && typeof detail === "object") {
    return (detail as { provider?: unknown }).provider;
  }
  return null;
}

export function requestNep21Provider(targetWindow?: Window): void {
  const win = getTargetWindow(targetWindow);
  if (!win || typeof win.dispatchEvent !== "function") return;
  win.dispatchEvent(
    new CustomEvent("Neo.DapiProvider.request", {
      detail: { version: "1.0" },
    }),
  );
}

export function waitForNep21Provider(
  options: {
    timeoutMs?: number;
    preference?: Nep21ProviderPreference;
    targetWindow?: Window;
    request?: boolean;
  } = {},
): Promise<NeoDapiProvider> {
  const timeoutMs = options.timeoutMs ?? 3000;
  const preference = options.preference ?? "any";
  const win = getTargetWindow(options.targetWindow);
  if (!win)
    return Promise.reject(new Error("NEP-21 dAPI provider not detected."));
  const immediate = readImmediateNep21Provider({
    preference,
    targetWindow: win,
  });
  if (immediate) return Promise.resolve(immediate);

  return new Promise((resolve, reject) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout>;
    const finish = (provider: NeoDapiProvider | null, error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      win.removeEventListener("Neo.DapiProvider.ready", onReady);
      win.removeEventListener("NEOLine.N3.EVENT.READY", onLegacyNeoLineReady);
      if (provider) {
        resolve(provider);
      } else {
        reject(error ?? new Error("NEP-21 dAPI provider not detected."));
      }
    };
    const onReady = (event: Event) => {
      const provider = rememberNep21Provider(
        extractNep21ProviderFromReadyEvent(event),
        win,
      );
      if (!provider) return;
      if (!providerMatchesPreference(win, provider, preference)) return;
      finish(provider);
    };
    const onLegacyNeoLineReady = () => {
      const provider = readImmediateNep21Provider({
        preference,
        targetWindow: win,
      });
      if (provider) finish(provider);
    };
    timeout = setTimeout(
      () => finish(null, new Error("NEP-21 dAPI provider not detected.")),
      timeoutMs,
    );
    win.addEventListener("Neo.DapiProvider.ready", onReady);
    win.addEventListener("NEOLine.N3.EVENT.READY", onLegacyNeoLineReady);
    if (options.request ?? true) requestNep21Provider(win);
  });
}

export function resetNep21ProviderCacheForTests(): void {
  cachedProvider = null;
  cachedWindow = null;
  cachedHostBridgeProvider = null;
  cachedHostBridgeWindow = null;
  cachedHostBridgeStateCleanup?.();
  cachedHostBridgeStateCleanup = null;
  cachedLegacyNeoLineProvider = null;
  cachedLegacyNeoLineWindow = null;
  hostBridgeRequestId = 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isEmbeddedHostLaunch(win: Nep21Window): boolean {
  try {
    const source = new URLSearchParams(win.location.search).get("source");
    if (source && source.toLowerCase() === "embed") return true;
  } catch {
    // Ignore URL parsing errors and fall back to frame detection.
  }
  try {
    return win.parent !== win;
  } catch {
    return false;
  }
}

function networkMagicFromLocation(win: Nep21Window): number {
  try {
    const raw = String(
      new URLSearchParams(win.location.search).get("network") || "",
    )
      .trim()
      .toLowerCase();
    if (raw.includes("mainnet")) return MAINNET_MAGIC;
  } catch {
    // Default to testnet for local embedded validation.
  }
  return TESTNET_MAGIC;
}

function normalizeScriptHashPrefix(value: unknown, options: { prefixed: boolean }): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const withoutPrefix = raw.startsWith("0x") || raw.startsWith("0X")
    ? raw.slice(2)
    : raw;
  return options.prefixed ? `0x${withoutPrefix}` : withoutPrefix;
}

function normalizeLegacyNetworkMagic(value: unknown): number | null {
  if (typeof value === "number") {
    if (value === MAINNET_MAGIC || value === 3) return MAINNET_MAGIC;
    if (value === TESTNET_MAGIC || value === 6) return TESTNET_MAGIC;
  }
  if (typeof value === "string") {
    const raw = value.trim().toLowerCase();
    if (!raw) return null;
    if (raw.includes("mainnet") || raw === "main" || raw === "3") return MAINNET_MAGIC;
    if (raw.includes("testnet") || raw === "test" || raw === "6") return TESTNET_MAGIC;
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return normalizeLegacyNetworkMagic(parsed);
  }
  if (isRecord(value)) {
    return (
      normalizeLegacyNetworkMagic(value.defaultNetwork) ||
      normalizeLegacyNetworkMagic(value.network) ||
      normalizeLegacyNetworkMagic(value.chainId) ||
      normalizeLegacyNetworkMagic(value.id)
    );
  }
  return null;
}

function normalizeLegacyArg(arg: unknown): unknown {
  if (!isRecord(arg)) return arg;
  const type = String(arg.type ?? "").toLowerCase();
  if (type !== "hash160") return arg;
  return {
    ...arg,
    value: normalizeScriptHashPrefix(arg.value, { prefixed: true }) || arg.value,
  };
}

function normalizeLegacySigner(signer: unknown): unknown {
  if (!isRecord(signer)) return signer;
  return {
    ...signer,
    account: normalizeScriptHashPrefix(signer.account, { prefixed: false }) || signer.account,
    scopes: normalizeLegacySignerScopes(signer.scopes),
  };
}

const LEGACY_SIGNER_SCOPE_BY_NAME: Record<string, number> = {
  none: 0,
  calledbyentry: 1,
  customcontracts: 16,
  customgroups: 32,
  witnessrules: 64,
  rules: 64,
  global: 128,
};

function normalizeLegacySignerScopes(scope: unknown): unknown {
  if (typeof scope === "number" && Number.isFinite(scope)) return scope;
  const raw = String(scope ?? "").trim();
  if (!raw) return scope;
  if (/^\d+$/.test(raw)) return Number(raw);
  const parts = raw
    .split(",")
    .map((part) => part.trim().toLowerCase().replace(/\s+/g, ""))
    .filter(Boolean);
  if (!parts.length) return scope;
  let mapped = 0;
  for (const part of parts) {
    const value = LEGACY_SIGNER_SCOPE_BY_NAME[part];
    if (value === undefined) return scope;
    mapped |= value;
  }
  return mapped;
}

function normalizeLegacyInvocation(invocation: NeoDapiInvocation<unknown>) {
  return {
    scriptHash: normalizeScriptHashPrefix(invocation.hash, { prefixed: false }),
    operation: invocation.operation,
    args: invocation.args?.map(normalizeLegacyArg) ?? [],
    abortOnFail: invocation.abortOnFail,
  };
}

function findLegacyBalanceAmount(result: unknown, asset: string): string | number | null {
  if (typeof result === "string" || typeof result === "number") return result;
  if (!result || typeof result !== "object") return null;

  const assetLower = normalizeScriptHashPrefix(asset, { prefixed: true }).toLowerCase();
  const assetBareLower = normalizeScriptHashPrefix(asset, { prefixed: false }).toLowerCase();
  const search = (value: unknown): string | number | null => {
    if (typeof value === "string" || typeof value === "number") return value;
    if (Array.isArray(value)) {
      for (const entry of value) {
        const match = search(entry);
        if (match !== null) return match;
      }
      return null;
    }
    if (!isRecord(value)) return null;
    const contract = String(value.contract ?? value.asset ?? value.hash ?? "").toLowerCase();
    if (
      contract === assetLower ||
      contract === assetBareLower ||
      normalizeScriptHashPrefix(contract, { prefixed: true }).toLowerCase() === assetLower
    ) {
      const amount = value.amount ?? value.balance ?? value.value;
      if (typeof amount === "string" || typeof amount === "number") return amount;
    }
    for (const nested of Object.values(value)) {
      const match = search(nested);
      if (match !== null) return match;
    }
    return null;
  };
  return search(result);
}

function resolveLegacyNeoLineApi(candidate: unknown): LegacyNeoLineN3Api | null {
  if (!candidate || typeof candidate !== "object") return null;
  const record = candidate as Record<string, unknown>;
  if (typeof record.Init === "function") {
    try {
      return new (record.Init as new () => LegacyNeoLineN3Api)();
    } catch {
      try {
        return (record.Init as () => LegacyNeoLineN3Api)();
      } catch {
        return null;
      }
    }
  }
  if (typeof (candidate as LegacyNeoLineN3Api).getAccount === "function") {
    return candidate as LegacyNeoLineN3Api;
  }
  return null;
}

function resolveLegacyNeoLineN3Api(win: Nep21Window): LegacyNeoLineN3Api | null {
  return resolveLegacyNeoLineApi(win.NEOLineN3);
}

function resolveLegacyNeoLineCommonApi(win: Nep21Window): LegacyNeoLineN3Api | null {
  return resolveLegacyNeoLineApi(win.NEOLine);
}

async function updateLegacyNeoLineNetwork(
  provider: NeoDapiProvider,
  api: LegacyNeoLineN3Api,
) {
  if (typeof api.getNetworks !== "function") return;
  try {
    const magic = normalizeLegacyNetworkMagic(await api.getNetworks());
    if (magic) provider.network = magic;
  } catch {
    // Network reads are best effort. The platform still fails closed on writes
    // when a wallet network cannot be verified by the host store.
  }
}

function getLegacyNeoLineEventName(
  api: LegacyNeoLineN3Api,
  event: NeoDapiEventName,
): string {
  const registry = api.EVENT ?? {};
  if (event === "accountchanged" || event === "accountschanged") {
    return (
      registry.ACCOUNT_CHANGED ||
      registry.ACCOUNTS_CHANGED ||
      "accountChanged"
    );
  }
  return registry.NETWORK_CHANGED || "networkChanged";
}

function getLegacyNeoLineN3Provider(win: Nep21Window): NeoDapiProvider | null {
  if (cachedLegacyNeoLineProvider && cachedLegacyNeoLineWindow === win) {
    return cachedLegacyNeoLineProvider;
  }
  const api = resolveLegacyNeoLineN3Api(win);
  if (!api) return null;
  const commonApi = resolveLegacyNeoLineCommonApi(win);
  const accountApi = commonApi ?? api;
  const networkApi = commonApi ?? api;
  const eventApi = commonApi ?? api;
  let legacyAccountAddress: string | null = null;
  let legacyAccountHash: string | null = null;
  const legacyListenerMap = new Map<
    NeoDapiEventName,
    Map<() => void, () => void>
  >();

  const resolveLegacyFromAddress = (value: unknown): string => {
    const raw = String(value ?? "").trim();
    if (!raw) return legacyAccountAddress ?? "";
    const rawBare = normalizeScriptHashPrefix(raw, { prefixed: false }).toLowerCase();
    const hashBare = normalizeScriptHashPrefix(legacyAccountHash, { prefixed: false }).toLowerCase();
    if (legacyAccountAddress && hashBare && rawBare === hashBare) {
      return legacyAccountAddress;
    }
    return raw;
  };

  const provider: NeoDapiProvider<unknown> = {
    name: "NeoLine Legacy N3",
    dapiVersion: "1.0.0",
    compatibility: ["NEP-21"],
    supportedNetworks: [MAINNET_MAGIC, TESTNET_MAGIC],
    async getAccounts() {
      await updateLegacyNeoLineNetwork(provider, networkApi);
      const account =
        typeof accountApi.getAccount === "function"
          ? await accountApi.getAccount()
          : typeof accountApi.pickAddress === "function"
            ? await accountApi.pickAddress()
            : null;
      const address = String(account?.address ?? "").trim();
      if (!address) return [];
      let hash = "";
      const addressApi =
        typeof api.AddressToScriptHash === "function" ? api : accountApi;
      if (typeof addressApi.AddressToScriptHash === "function") {
        try {
          const converted = await addressApi.AddressToScriptHash({ address });
          hash = normalizeScriptHashPrefix(converted?.scriptHash, {
            prefixed: true,
          });
        } catch {
          hash = "";
        }
      }
      legacyAccountAddress = address;
      legacyAccountHash = hash || null;
      return [
        {
          hash: hash || address,
          address,
          label: typeof account?.label === "string" ? account.label : "NeoLine",
          isDefault: true,
        },
      ];
    },
    async authenticate() {
      const accounts = await provider.getAccounts();
      const account = accounts[0];
      const publicKey =
        typeof accountApi.getPublicKey === "function"
          ? await accountApi.getPublicKey().catch(() => null)
          : null;
      return {
        network: provider.network,
        address: account?.address ?? account?.hash,
        pubkey: String(publicKey?.pubkey ?? publicKey?.publicKey ?? ""),
      };
    },
    async getNetwork() {
      await updateLegacyNeoLineNetwork(provider, networkApi);
      return provider.network;
    },
    call: (invocation) => {
      if (typeof api.invokeRead !== "function") {
        return Promise.reject(
          new Error("NeoLine N3 does not support read-only contract calls."),
        );
      }
      return api.invokeRead(normalizeLegacyInvocation(invocation));
    },
    async getBalance(asset, account) {
      if (typeof api.getBalance !== "function") return "0";
      const payload = account
        ? {
            params: [
              {
                address: resolveLegacyFromAddress(account),
                contracts: [normalizeScriptHashPrefix(asset, { prefixed: false })],
              },
            ],
          }
        : undefined;
      let result: unknown;
      try {
        result = await api.getBalance(payload);
      } catch (error) {
        if (payload === undefined) throw error;
        result = await api.getBalance();
      }
      return findLegacyBalanceAmount(result, asset) ?? "0";
    },
    invoke: (invocations, signers, suggestedSystemFee) => {
      const normalizedInvocations = invocations.map(normalizeLegacyInvocation);
      const normalizedSigners = signers?.map(normalizeLegacySigner);
      if (
        normalizedInvocations.length > 1 &&
        typeof api.invokeMultiple === "function"
      ) {
        return api.invokeMultiple({
          invokeArgs: normalizedInvocations,
          signers: normalizedSigners,
          suggestedSystemFee,
        });
      }
      if (typeof api.invoke !== "function") {
        return Promise.reject(
          new Error("NeoLine N3 does not support contract invoke."),
        );
      }
      return api.invoke({
        ...normalizedInvocations[0],
        signers: normalizedSigners,
        suggestedSystemFee,
      });
    },
    send: (asset, from, to, amount, data) => {
      if (typeof api.send !== "function") {
        return Promise.reject(
          new Error("NeoLine N3 does not support asset transfers."),
        );
      }
      return api.send({
        asset: normalizeScriptHashPrefix(asset, { prefixed: false }) || asset,
        fromAddress: resolveLegacyFromAddress(from),
        toAddress: to,
        amount,
        data,
      });
    },
    signMessage: async (message) => {
      if (typeof api.signMessage !== "function") {
        return Promise.reject(
          new Error("NeoLine N3 does not support message signing."),
        );
      }
      const result = await api.signMessage({ message });
      if (isRecord(result)) {
        return {
          signature:
            typeof result.signature === "string" ? result.signature : undefined,
          data: typeof result.data === "string" ? result.data : undefined,
          account:
            typeof result.account === "string" ? result.account : undefined,
          pubkey: typeof result.pubkey === "string" ? result.pubkey : undefined,
          publicKey:
            typeof result.publicKey === "string" ? result.publicKey : undefined,
          salt: typeof result.salt === "string" ? result.salt : undefined,
          message:
            typeof result.message === "string" ? result.message : undefined,
        };
      }
      return { data: String(result ?? "") };
    },
    on: (event, listener) => {
      const wrapped = () => {
        void (async () => {
          if (event === "networkchanged") {
            await updateLegacyNeoLineNetwork(provider, networkApi);
          }
          listener();
        })();
      };
      const eventListeners = legacyListenerMap.get(event) ?? new Map();
      eventListeners.set(listener, wrapped);
      legacyListenerMap.set(event, eventListeners);
      eventApi.addEventListener?.(getLegacyNeoLineEventName(eventApi, event), wrapped);
    },
    removeListener: (event, listener) => {
      const eventListeners = legacyListenerMap.get(event);
      const wrapped = eventListeners?.get(listener) ?? listener;
      eventListeners?.delete(listener);
      eventApi.removeEventListener?.(getLegacyNeoLineEventName(eventApi, event), wrapped);
    },
  };
  cachedLegacyNeoLineProvider = provider as NeoDapiProvider;
  cachedLegacyNeoLineWindow = win;
  return cachedLegacyNeoLineProvider;
}

function createHostBridgeRequestId(): string {
  hostBridgeRequestId += 1;
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.getRandomValues === "function"
  ) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    const nonce = Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join("");
    return `host-wallet-${nonce}`;
  }
  return `host-wallet-${Date.now().toString(16)}-${hostBridgeRequestId}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function deriveHostBridgeOrigin(win: Nep21Window): string | null {
  // Prefer the embedding page reported by the referrer (the host shell), then
  // fall back to the frame's own URL origin (miniapps are served first-party).
  const candidates: string[] = [];
  try {
    const referrer = String(win.document?.referrer ?? "").trim();
    if (referrer) candidates.push(referrer);
  } catch {
    // Sandboxed documents may refuse referrer access; try the location below.
  }
  try {
    candidates.push(win.location.href);
  } catch {
    // No usable location; the source-identity check remains the boundary.
  }
  for (const candidate of candidates) {
    try {
      const origin = new URL(candidate).origin;
      if (origin && origin !== "null") return origin;
    } catch {
      // Ignore unparseable candidates and keep looking.
    }
  }
  return null;
}

function hostBridgeRequest<T>(
  win: Nep21Window,
  method: string,
  payload?: HostBridgeRequestPayload,
): Promise<T> {
  const target = win.parent;
  if (!target) {
    return Promise.reject(
      new Error("MiniApp host wallet bridge is not available."),
    );
  }

  const id = createHostBridgeRequestId();
  const expectedOrigin = deriveHostBridgeOrigin(win);
  if (!expectedOrigin) {
    // Fail closed: with no concrete target origin we would have to post the
    // wallet-bridge request with "*", broadcasting the payload (and any
    // sensitive arguments) to every listener that can reach this window.
    // Refuse to send rather than leak it.
    return Promise.reject(
      new Error(
        "MiniApp host wallet bridge target origin could not be determined.",
      ),
    );
  }
  return new Promise<T>((resolve, reject) => {
    const timeout = win.setTimeout(() => {
      cleanup();
      reject(new Error("MiniApp host wallet bridge timed out."));
    }, HOST_WALLET_BRIDGE_TIMEOUT_MS);

    const cleanup = () => {
      win.clearTimeout(timeout);
      win.removeEventListener("message", onMessage);
    };

    const onMessage = (event: MessageEvent) => {
      // Identity check: only the embedding host window may answer a bridge
      // request. Cross-window messages always carry the sender as `source`,
      // so a nested frame inside the miniapp can never spoof a response. A
      // null/undefined source only occurs for synthetic same-document events
      // (e.g. jsdom test harnesses), where no foreign window is involved.
      if (event.source !== target && event.source != null) return;
      // Origin check: sandboxed hosts and test harnesses report an opaque
      // ("null"/empty) origin — the source identity above stays the boundary
      // there. A real, mismatching origin is rejected outright.
      if (
        expectedOrigin &&
        event.origin &&
        event.origin !== "null" &&
        event.origin !== expectedOrigin
      ) {
        return;
      }
      const data = event.data as HostBridgeResponse;
      if (!isRecord(data)) return;
      if (data.type !== HOST_WALLET_BRIDGE_RESPONSE || data.id !== id) return;
      // Protocol negotiation on the reply lane: a host that answers with an
      // incompatible version is rejected with a clear error instead of having
      // its (possibly differently-shaped) result consumed blindly. A missing
      // version is the pre-negotiation baseline and is accepted.
      const responseProtocolVersion = normalizeBridgeProtocolVersion(
        data.protocolVersion,
      );
      if (!isCompatibleBridgeProtocolVersion(responseProtocolVersion)) {
        cleanup();
        reject(
          new Error(
            `Unsupported wallet bridge protocol version ${String(
              data.protocolVersion,
            )}. This miniapp speaks version(s) ${HOST_WALLET_BRIDGE_COMPATIBLE_PROTOCOL_VERSIONS.join(
              ", ",
            )}.`,
          ),
        );
        return;
      }
      cleanup();
      if (data.ok === true) {
        resolve(data.result as T);
        return;
      }
      const error = data.error;
      const message =
        typeof error === "string"
          ? error
          : String(
              error?.message || "MiniApp host wallet bridge request failed.",
            );
      reject(new Error(message));
    };

    win.addEventListener("message", onMessage);
    target.postMessage(
      {
        type: HOST_WALLET_BRIDGE_REQUEST,
        id,
        method,
        payload,
        // Named, negotiable protocol version. `version: 1` is retained as the
        // legacy alias so a host pinned to the old field still sees a value.
        protocolVersion: HOST_WALLET_BRIDGE_PROTOCOL_VERSION,
        version: HOST_WALLET_BRIDGE_PROTOCOL_VERSION,
      },
      expectedOrigin,
    );
  });
}

function getHostWalletBridgeProvider(win: Nep21Window): NeoDapiProvider | null {
  if (!isEmbeddedHostLaunch(win)) return null;
  if (cachedHostBridgeProvider && cachedHostBridgeWindow === win) {
    return cachedHostBridgeProvider;
  }
  cachedHostBridgeStateCleanup?.();
  cachedHostBridgeStateCleanup = null;
  const hostBridgeListeners = new Map<NeoDapiEventName, Set<() => void>>();
  let lastHostBridgeAddress: string | null = null;

  const emitHostBridgeEvent = (event: NeoDapiEventName) => {
    hostBridgeListeners.get(event)?.forEach((listener) => listener());
  };

  const readStateAccountAddress = (state: Record<string, unknown>): string => {
    if (state.connected === false) return "";
    return String(state.address ?? "").trim();
  };

  const applyHostBridgeState = (
    provider: NeoDapiProvider,
    state: Record<string, unknown>,
  ) => {
    const previousNetwork = provider.network;
    const nextNetwork = normalizeLegacyNetworkMagic(
      state.network ?? state.networkName,
    );
    if (nextNetwork) {
      provider.network = nextNetwork;
    } else {
      delete provider.network;
    }

    const previousAddress = lastHostBridgeAddress;
    const nextAddress = readStateAccountAddress(state) || null;
    lastHostBridgeAddress = nextAddress;

    if (provider.network !== previousNetwork) {
      emitHostBridgeEvent("networkchanged");
    }
    if (nextAddress !== previousAddress) {
      emitHostBridgeEvent("accountchanged");
    }
  };

  const provider: NeoDapiProvider = {
    name: "Yiwu Host Wallet",
    dapiVersion: "1.0.0",
    compatibility: ["NEP-21"],
    network: networkMagicFromLocation(win),
    supportedNetworks: [MAINNET_MAGIC, TESTNET_MAGIC],
    getAccounts: async () => {
      const accounts = await hostBridgeRequest<
        ReturnType<NeoDapiProvider["getAccounts"]> extends Promise<infer T>
          ? T
          : never
      >(win, "getAccounts");
      const account = accounts.find((entry) => entry.isDefault) ?? accounts[0];
      lastHostBridgeAddress =
        typeof account?.address === "string" && account.address.trim()
          ? account.address
          : typeof account?.hash === "string" && account.hash.trim()
            ? account.hash
            : null;
      return accounts;
    },
    authenticate: (payload) => hostBridgeRequest(win, "authenticate", payload),
    call: (invocation) => hostBridgeRequest(win, "call", { invocation }),
    getBalance: (asset, account) =>
      hostBridgeRequest(win, "getBalance", { asset, account }),
    invoke: (invocations, signers, suggestedSystemFee) =>
      hostBridgeRequest(win, "invoke", {
        invocations,
        signers,
        suggestedSystemFee,
      }),
    send: (asset, from, to, amount, data) =>
      hostBridgeRequest(win, "send", { asset, from, to, amount, data }),
    requestPayment: (request) =>
      hostBridgeRequest(win, "requestPayment", request),
    signMessage: (message, account) =>
      hostBridgeRequest(win, "signMessage", { message, account }),
    on: (event, listener) => {
      const listeners = hostBridgeListeners.get(event) ?? new Set<() => void>();
      listeners.add(listener);
      hostBridgeListeners.set(event, listeners);
    },
    removeListener: (event, listener) => {
      hostBridgeListeners.get(event)?.delete(listener);
    },
  };
  const hostWindow = win.parent;
  const expectedOrigin = deriveHostBridgeOrigin(win);
  const onHostBridgeState = (event: MessageEvent) => {
    if (event.source !== hostWindow && event.source != null) return;
    if (
      expectedOrigin &&
      event.origin &&
      event.origin !== "null" &&
      event.origin !== expectedOrigin
    ) {
      return;
    }
    const data = event.data as HostBridgeStateMessage;
    if (!isRecord(data) || data.type !== HOST_WALLET_BRIDGE_STATE) return;
    const stateProtocolVersion = normalizeBridgeProtocolVersion(
      data.protocolVersion,
    );
    if (!isCompatibleBridgeProtocolVersion(stateProtocolVersion)) return;
    if (!isRecord(data.state)) return;
    applyHostBridgeState(provider, data.state);
  };
  win.addEventListener("message", onHostBridgeState);
  cachedHostBridgeStateCleanup = () => {
    win.removeEventListener("message", onHostBridgeState);
  };
  cachedHostBridgeProvider = provider;
  cachedHostBridgeWindow = win;
  return provider;
}
