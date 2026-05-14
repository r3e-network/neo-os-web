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

export type Nep21ProviderPreference = "any" | "onegate";

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

let cachedProvider: NeoDapiProvider | null = null;
let cachedWindow: Nep21Window | null = null;

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
  return win.OneGateDapiProvider === provider || name.includes("onegate");
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
  win.NEP21Provider = provider;
  const registry =
    win.NEP21Providers && typeof win.NEP21Providers === "object"
      ? { ...(win.NEP21Providers as Record<string, unknown>) }
      : {};
  const name = String(provider.name ?? "").trim();
  if (name) registry[name] = provider;
  win.NEP21Providers = registry;
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
}
