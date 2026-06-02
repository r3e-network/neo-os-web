export type NeoDapiEventName =
  | "accountchanged"
  | "accountschanged"
  | "networkchanged";

export type NeoDapiAccount = {
  hash: string;
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
  nonce?: string;
  pubkey?: string;
  signature?: string;
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
  authenticate?: (payload: {
    action: "Authentication";
    grant_type: "Signature";
    allowed_algorithms: ["ECDSA-P256"];
    domain: string;
    networks: number[];
    nonce: string;
    timestamp: number;
  }) => Promise<NeoDapiAuthenticationResponse>;
  call?: (invocation: NeoDapiInvocation<TArg>) => Promise<TCallResult>;
  getAccounts: () => Promise<NeoDapiAccount[]>;
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
  neoDapiProvider?: unknown;
  neoDapi?: unknown;
};

type Candidate = {
  provider: unknown;
  key?: string;
};

type HostBridgeRequestPayload = Record<string, unknown> | unknown[] | string | number | boolean | null | undefined;

type HostBridgeResponse = {
  type?: string;
  id?: unknown;
  ok?: unknown;
  result?: unknown;
  error?: { message?: unknown } | string;
};

const HOST_WALLET_BRIDGE_REQUEST = "neo-miniapp-wallet-bridge:request";
const HOST_WALLET_BRIDGE_RESPONSE = "neo-miniapp-wallet-bridge:response";
const HOST_WALLET_BRIDGE_TIMEOUT_MS = 8000;
const MAINNET_MAGIC = 860833102;
const TESTNET_MAGIC = 894710606;

let cachedProvider: NeoDapiProvider | null = null;
let cachedWindow: Nep21Window | null = null;
let cachedHostBridgeProvider: NeoDapiProvider | null = null;
let cachedHostBridgeWindow: Nep21Window | null = null;
let hostBridgeRequestId = 0;

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

function registryCandidates(registry: Nep21Window["NEP21Providers"]): Candidate[] {
  if (!registry || typeof registry !== "object") return [];
  return Object.entries(registry as Record<string, unknown>).map(
    ([key, provider]) => ({
      key,
      provider,
    }),
  );
}

function providerCandidates(win: Nep21Window): Candidate[] {
  return [
    { provider: win.NEP21Provider },
    ...registryCandidates(win.NEP21Providers),
    { provider: win.OneGateDapiProvider },
    { provider: win.Neo?.DapiProvider },
    { provider: win.neoDapiProvider },
    { provider: win.neoDapi },
    { provider: getHostWalletBridgeProvider(win), key: "yiwu-host" },
  ];
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
    writableWindow.NEP21Providers && typeof writableWindow.NEP21Providers === "object"
      ? { ...(writableWindow.NEP21Providers as Record<string, unknown>) }
      : {};
  const name = String(provider.name ?? "").trim();
  if (name) registry[name] = provider;
  writableWindow.NEP21Providers = registry;
  return provider;
}

export function readImmediateNep21Provider(options: {
  preference?: Nep21ProviderPreference;
  targetWindow?: Window;
} = {}): NeoDapiProvider | null {
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

export function extractNep21ProviderFromReadyEvent(
  event: Event,
): unknown {
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

export function waitForNep21Provider(options: {
  timeoutMs?: number;
  preference?: Nep21ProviderPreference;
  targetWindow?: Window;
  request?: boolean;
} = {}): Promise<NeoDapiProvider> {
  const timeoutMs = options.timeoutMs ?? 3000;
  const preference = options.preference ?? "any";
  const win = getTargetWindow(options.targetWindow);
  if (!win) return Promise.reject(new Error("NEP-21 dAPI provider not detected."));
  const immediate = readImmediateNep21Provider({ preference, targetWindow: win });
  if (immediate) return Promise.resolve(immediate);

  return new Promise((resolve, reject) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout>;
    const finish = (provider: NeoDapiProvider | null, error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      win.removeEventListener("Neo.DapiProvider.ready", onReady);
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
    timeout = setTimeout(
      () => finish(null, new Error("NEP-21 dAPI provider not detected.")),
      timeoutMs,
    );
    win.addEventListener("Neo.DapiProvider.ready", onReady);
    if (options.request ?? true) requestNep21Provider(win);
  });
}

export function resetNep21ProviderCacheForTests(): void {
  cachedProvider = null;
  cachedWindow = null;
  cachedHostBridgeProvider = null;
  cachedHostBridgeWindow = null;
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
    const raw = String(new URLSearchParams(win.location.search).get("network") || "")
      .trim()
      .toLowerCase();
    if (raw.includes("mainnet")) return MAINNET_MAGIC;
  } catch {
    // Default to testnet for local embedded validation.
  }
  return TESTNET_MAGIC;
}

function hostBridgeRequest<T>(
  win: Nep21Window,
  method: string,
  payload?: HostBridgeRequestPayload,
): Promise<T> {
  const target = win.parent;
  if (!target) {
    return Promise.reject(new Error("MiniApp host wallet bridge is not available."));
  }

  const id = `host-wallet-${Date.now()}-${hostBridgeRequestId += 1}`;
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
      const data = event.data as HostBridgeResponse;
      if (!isRecord(data)) return;
      if (data.type !== HOST_WALLET_BRIDGE_RESPONSE || data.id !== id) return;
      cleanup();
      if (data.ok === true) {
        resolve(data.result as T);
        return;
      }
      const error = data.error;
      const message = typeof error === "string"
        ? error
        : String(error?.message || "MiniApp host wallet bridge request failed.");
      reject(new Error(message));
    };

    win.addEventListener("message", onMessage);
    target.postMessage(
      {
        type: HOST_WALLET_BRIDGE_REQUEST,
        id,
        method,
        payload,
        version: 1,
      },
      "*",
    );
  });
}

function getHostWalletBridgeProvider(win: Nep21Window): NeoDapiProvider | null {
  if (!isEmbeddedHostLaunch(win)) return null;
  if (cachedHostBridgeProvider && cachedHostBridgeWindow === win) {
    return cachedHostBridgeProvider;
  }
  const provider: NeoDapiProvider = {
    name: "Yiwu Host Wallet",
    dapiVersion: "1.0.0",
    compatibility: ["NEP-21"],
    network: networkMagicFromLocation(win),
    supportedNetworks: [MAINNET_MAGIC, TESTNET_MAGIC],
    getAccounts: () =>
      hostBridgeRequest<ReturnType<NeoDapiProvider["getAccounts"]> extends Promise<infer T> ? T : never>(
        win,
        "getAccounts",
      ),
    authenticate: (payload) =>
      hostBridgeRequest(win, "authenticate", payload),
    call: (invocation) =>
      hostBridgeRequest(win, "call", { invocation }),
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
    signMessage: (message, account) =>
      hostBridgeRequest(win, "signMessage", { message, account }),
  };
  cachedHostBridgeProvider = provider;
  cachedHostBridgeWindow = win;
  return provider;
}
