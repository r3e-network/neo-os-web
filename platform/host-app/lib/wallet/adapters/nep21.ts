/**
 * NEP-21 dAPI Wallet Adapter for Neo N3.
 *
 * NEP-21 providers expose a common `IDapiProvider` via the
 * `Neo.DapiProvider.ready` browser event. This adapter makes that standard a
 * first-class wallet option in the host while preserving the legacy wallet
 * adapters as fallbacks.
 */

import {
  WalletAdapter,
  WalletAccount,
  WalletBalance,
  TransactionResult,
  SignedMessage,
  InvokeParams,
  WalletNotInstalledError,
  WalletConnectionError,
  WalletTransactionError,
} from "./base";
import {
  MAINNET_MAGIC,
  TESTNET_MAGIC,
  normalizeNeoNetwork,
  type NeoNetwork,
} from "@/lib/neo-network";

const NEO_CONTRACT = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const GAS_CONTRACT = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

type DapiEventName = "accountchanged" | "accountschanged" | "networkchanged";

type DapiAccount = {
  hash: string;
  address?: string;
  label?: string;
  isDefault?: boolean;
};

type DapiInvocation = {
  hash: string;
  operation: string;
  args?: Array<{ type: string; value: unknown }>;
  abortOnFail?: boolean;
};

type DapiProvider = {
  name?: string;
  dapiVersion?: string;
  network?: number;
  supportedNetworks?: number[];
  compatibility?: string[];
  on?: (event: DapiEventName, listener: () => void) => void;
  removeListener?: (event: DapiEventName, listener: () => void) => void;
  authenticate?: (payload: {
    action: "Authentication";
    grant_type: "Signature";
    allowed_algorithms: ["ECDSA-P256"];
    domain: string;
    networks: number[];
    nonce: string;
    timestamp: number;
  }) => Promise<{
    network?: number;
    address?: string;
    pubkey?: string;
    signature?: string;
  }>;
  getAccounts: () => Promise<DapiAccount[]>;
  getBalance?: (asset: string, account?: string) => Promise<unknown>;
  invoke?: (invocations: DapiInvocation[], signers?: Array<Record<string, unknown>>, suggestedSystemFee?: string) => Promise<unknown>;
  call?: (invocation: DapiInvocation) => Promise<unknown>;
  send?: (asset: string, from: string, to: string, amount: string, data?: { type: string; value: unknown }) => Promise<unknown>;
  signMessage?: (message: string, account?: string) => Promise<{
    signature: string;
    account: string;
    pubkey: string;
  }>;
};

type DapiWindow = Window & {
  Neo?: { DapiProvider?: unknown };
  OneGateDapiProvider?: unknown;
  neoDapiProvider?: unknown;
  neoDapi?: unknown;
};

function isDapiProvider(value: unknown): value is DapiProvider {
  if (!value || typeof value !== "object") return false;
  const provider = value as Partial<DapiProvider>;
  return typeof provider.getAccounts === "function" && (
    typeof provider.invoke === "function" ||
    typeof provider.call === "function" ||
    typeof provider.send === "function" ||
    typeof provider.signMessage === "function"
  );
}

function getImmediateProvider(): DapiProvider | null {
  if (typeof window === "undefined") return null;
  const win = window as DapiWindow;
  const candidates = [
    win.Neo?.DapiProvider,
    win.OneGateDapiProvider,
    win.neoDapiProvider,
    win.neoDapi,
  ];
  return candidates.find(isDapiProvider) ?? null;
}

function waitForProvider(timeoutMs = 3000): Promise<DapiProvider> {
  const immediate = getImmediateProvider();
  if (immediate) return Promise.resolve(immediate);

  return new Promise((resolve, reject) => {
    let timeout: ReturnType<typeof setTimeout>;
    const onReady = (event: Event) => {
      const provider = (event as CustomEvent<{ provider?: unknown }>).detail?.provider;
      if (!isDapiProvider(provider)) return;
      clearTimeout(timeout);
      window.removeEventListener("Neo.DapiProvider.ready", onReady);
      resolve(provider);
    };
    timeout = setTimeout(() => {
      window.removeEventListener("Neo.DapiProvider.ready", onReady);
      reject(new WalletNotInstalledError("NEP-21 dAPI"));
    }, timeoutMs);
    window.addEventListener("Neo.DapiProvider.ready", onReady);
    window.dispatchEvent(new CustomEvent("Neo.DapiProvider.request", {
      detail: { version: "1.0" },
    }));
  });
}

function encodeBase64Utf8(value: string): string {
  if (typeof btoa !== "function") return value;
  return btoa(unescape(encodeURIComponent(value)));
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

function normalizeOperationName(operation: string): string {
  const raw = String(operation || "").trim();
  return raw ? raw.charAt(0).toLowerCase() + raw.slice(1) : raw;
}

function scopeToDapi(scope: string | number): string {
  if (typeof scope === "number") {
    if (scope === 0) return "None";
    if (scope === 1) return "CalledByEntry";
    if (scope === 16) return "CustomContracts";
    if (scope === 32) return "CustomGroups";
    if (scope === 64) return "WitnessRules";
    if (scope === 128) return "Global";
  }
  const raw = String(scope || "").trim();
  if (/^\d+$/.test(raw)) return scopeToDapi(Number(raw));
  return raw || "CalledByEntry";
}

function normalizeTxResult(result: unknown): TransactionResult {
  if (typeof result === "string") return { txid: result };
  if (result && typeof result === "object") {
    const record = result as Record<string, unknown>;
    const txid = String(record.txid ?? record.tx ?? record.hash ?? "");
    if (txid) return { txid, nodeUrl: typeof record.nodeUrl === "string" ? record.nodeUrl : undefined };
  }
  throw new WalletTransactionError("NEP-21 wallet did not return a transaction hash");
}

function normalizeBalance(value: unknown, assetHash: string): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const direct = record.amount ?? record[assetHash] ?? record[assetHash.toLowerCase()] ?? record[assetHash.toUpperCase()];
    if (typeof direct === "string" || typeof direct === "number") return String(direct);
    if (Array.isArray(direct)) {
      const item = direct.find((entry) => entry && typeof entry === "object" && (entry as Record<string, unknown>).contract === assetHash);
      const amount = (item as Record<string, unknown> | undefined)?.amount;
      if (typeof amount === "string" || typeof amount === "number") return String(amount);
    }
  }
  return "0";
}

function mapDapiArgs(
  args?: Array<{ type: string; value: unknown }>,
  accountHash?: string | null,
  currentAddress?: string | null,
) {
  if (!args?.length) return args ?? [];
  return args.map((arg) => {
    if (
      accountHash &&
      currentAddress &&
      String(arg.type).toLowerCase() === "hash160" &&
      arg.value === currentAddress
    ) {
      return { ...arg, value: accountHash };
    }
    return arg;
  });
}

export class Nep21Adapter implements WalletAdapter {
  readonly name = "NEP-21 dAPI";
  readonly icon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%2300e599'/%3E%3Ctext x='32' y='38' text-anchor='middle' font-size='17' font-weight='800' font-family='Arial,sans-serif' fill='%2307111a'%3EN21%3C/text%3E%3C/svg%3E";
  readonly downloadUrl = "https://developers.neo.org/docs/n3/develop/tools/wallets";

  private provider: DapiProvider | null = null;
  private accountHash: string | null = null;
  private address: string | null = null;

  private subscribe(events: DapiEventName[], listener: () => void | Promise<void>): () => void {
    const provider = this.provider;
    if (!provider?.on) return () => undefined;
    const wrapped = () => {
      void listener();
    };
    events.forEach((event) => provider.on?.(event, wrapped));
    return () => {
      events.forEach((event) => provider.removeListener?.(event, wrapped));
    };
  }

  isInstalled(): boolean {
    return !!getImmediateProvider();
  }

  private async getProvider(): Promise<DapiProvider> {
    if (this.provider) return this.provider;
    this.provider = await waitForProvider();
    return this.provider;
  }

  async connect(): Promise<WalletAccount> {
    const provider = await this.getProvider();
    try {
      let accounts: DapiAccount[] = [];
      try {
        accounts = await provider.getAccounts();
      } catch {
        // Some dAPI wallets only expose accounts after an explicit auth request.
        accounts = [];
      }
      const account = accounts.find((entry) => entry.isDefault) ?? accounts[0];
      if (account?.hash) {
        this.accountHash = account.hash;
        this.address = account.address || account.hash;
        return {
          address: this.address,
          publicKey: "",
          label: account.label,
          network: normalizeNeoNetwork(provider.network),
        };
      }

      if (!provider.authenticate) {
        throw new WalletConnectionError("NEP-21 wallet did not return any account");
      }
      const authenticated = await provider.authenticate({
        action: "Authentication",
        grant_type: "Signature",
        allowed_algorithms: ["ECDSA-P256"],
        domain: getAuthenticationDomain(),
        networks: provider.supportedNetworks?.length ? provider.supportedNetworks : [MAINNET_MAGIC, TESTNET_MAGIC],
        nonce: createNonce(),
        timestamp: Date.now(),
      });
      if (!authenticated.address) throw new WalletConnectionError("NEP-21 wallet authentication did not return an address");
      this.accountHash = null;
      this.address = authenticated.address;
      return {
        address: authenticated.address,
        publicKey: authenticated.pubkey || "",
        network: normalizeNeoNetwork(authenticated.network ?? provider.network),
      };
    } catch (error) {
      if (error instanceof WalletConnectionError) throw error;
      throw new WalletConnectionError(`Failed to connect NEP-21 wallet: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async disconnect(): Promise<void> {
    this.accountHash = null;
    this.address = null;
  }

  async getNetwork(): Promise<NeoNetwork | null> {
    const provider = await this.getProvider();
    return normalizeNeoNetwork(provider.network);
  }

  onAccountChanged(listener: () => void | Promise<void>): () => void {
    return this.subscribe(["accountchanged", "accountschanged"], listener);
  }

  onNetworkChanged(listener: () => void | Promise<void>): () => void {
    return this.subscribe(["networkchanged"], listener);
  }

  async getBalance(_address: string): Promise<WalletBalance> {
    const provider = await this.getProvider();
    if (!provider.getBalance) return { neo: "0", gas: "0" };
    const account = this.accountHash ?? this.address ?? _address;
    try {
      const [neo, gas] = await Promise.all([
        provider.getBalance(NEO_CONTRACT, account).then((result) => normalizeBalance(result, NEO_CONTRACT)),
        provider.getBalance(GAS_CONTRACT, account).then((result) => normalizeBalance(result, GAS_CONTRACT)),
      ]);
      return { neo, gas };
    } catch (error) {
      console.warn("[nep21] getBalance failed:", error instanceof Error ? error.message : String(error));
      return { neo: "0", gas: "0" };
    }
  }

  async signMessage(message: string): Promise<SignedMessage> {
    const provider = await this.getProvider();
    if (!provider.signMessage) throw new WalletTransactionError("NEP-21 wallet does not support signMessage");
    const signed = await provider.signMessage(encodeBase64Utf8(message), this.accountHash ?? this.address ?? undefined);
    return {
      publicKey: signed.pubkey,
      data: signed.signature,
      salt: "",
      message,
    };
  }

  async invoke(params: InvokeParams): Promise<TransactionResult> {
    const provider = await this.getProvider();
    if (!provider.invoke) throw new WalletTransactionError("NEP-21 wallet does not support invoke");
    const invocation: DapiInvocation = {
      hash: params.scriptHash,
      operation: normalizeOperationName(params.operation),
      args: mapDapiArgs(params.args, this.accountHash, this.address),
    };
    const signers = params.signers?.map((signer) => ({
      ...signer,
      account: signer.account === this.address && this.accountHash ? this.accountHash : signer.account,
      scopes: scopeToDapi(signer.scopes),
    }));
    return normalizeTxResult(await provider.invoke([invocation], signers));
  }
}
