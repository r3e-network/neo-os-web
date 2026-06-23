/**
 * NEP-21 dAPI Wallet Adapter for Neo N3.
 *
 * NEP-21 providers expose a common `IDapiProvider` via the
 * `Neo.DapiProvider.ready` browser event. This adapter makes that standard a
 * first-class wallet path for OneGate, NeoLine, and compatible wallets.
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
import { neoAddressToScriptHash } from "@/lib/neo-address";
import { getActiveRpcNetwork } from "@/lib/rpc-helpers";
import {
  readImmediateNep21Provider,
  waitForNep21Provider,
  type NeoDapiAccount as DapiAccount,
  type NeoDapiEventName as DapiEventName,
  type NeoDapiInvocation as DapiInvocation,
  type NeoDapiProvider as DapiProvider,
  type Nep21ProviderPreference as DapiProviderPreference,
} from "../../../../sdk/src/nep21-provider";

const NEO_CONTRACT = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const GAS_CONTRACT = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

function normalizeAssetHash(asset: string): string {
  const raw = String(asset || "").trim();
  const key = raw.toLowerCase();
  if (key === "neo") return NEO_CONTRACT;
  if (key === "gas") return GAS_CONTRACT;
  return raw;
}

function transferDecimalsForAsset(assetHash: string): number {
  const normalized = assetHash.toLowerCase();
  if (normalized === NEO_CONTRACT) return 0;
  return 8;
}

function parseTransferAmount(amount: string | number, decimals: number): string {
  const raw = String(amount ?? "").trim();
  const safeDecimals =
    Number.isInteger(decimals) && decimals >= 0 && decimals <= 18 ? decimals : 8;
  if (safeDecimals === 0) {
    if (!/^[1-9]\d*$/.test(raw)) {
      throw new WalletTransactionError("Transfer amount must be a positive whole number");
    }
    return raw;
  }
  const match = raw.match(/^(\d+)(?:\.(\d+))?$/);
  if (!match || (match[2]?.length ?? 0) > safeDecimals) {
    throw new WalletTransactionError(`Transfer amount must be positive with at most ${safeDecimals} decimals`);
  }
  const intPart = match[1] ?? "0";
  const frac = `${match[2] ?? ""}${"0".repeat(safeDecimals)}`.slice(0, safeDecimals);
  const value = BigInt(intPart) * 10n ** BigInt(safeDecimals) + BigInt(frac || "0");
  if (value <= 0n) {
    throw new WalletTransactionError("Transfer amount must be greater than zero");
  }
  return value.toString();
}

function getImmediateProvider(preference: DapiProviderPreference = "any"): DapiProvider | null {
  return readImmediateNep21Provider({ preference }) as DapiProvider | null;
}

function waitForProvider(
  timeoutMs = 3000,
  preference: DapiProviderPreference = "any",
): Promise<DapiProvider> {
  return waitForNep21Provider({ timeoutMs, preference }).catch(() => {
    throw new WalletNotInstalledError("NEP-21 dAPI");
  }) as Promise<DapiProvider>;
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

function getAuthenticationNetworks(): number[] {
  return [
    getActiveRpcNetwork() === "testnet" ? TESTNET_MAGIC : MAINNET_MAGIC,
  ];
}

function forgetRememberedProvider(provider: DapiProvider | null): void {
  if (!provider || typeof window === "undefined") return;
  const writableWindow = window as Window & {
    NEP21Provider?: unknown;
    NEP21Providers?: Record<string, unknown> | unknown[];
  };
  if (writableWindow.NEP21Provider === provider) {
    delete writableWindow.NEP21Provider;
  }
  const registry = writableWindow.NEP21Providers;
  if (Array.isArray(registry)) {
    writableWindow.NEP21Providers = registry.filter((entry) => entry !== provider);
    return;
  }
  if (registry && typeof registry === "object") {
    for (const [key, value] of Object.entries(registry)) {
      if (value === provider) {
        delete (registry as Record<string, unknown>)[key];
      }
    }
  }
}

function normalizeOperationName(operation: string): string {
  const raw = String(operation || "").trim();
  if (!raw) {
    throw new WalletTransactionError("Contract operation name is required");
  }
  return raw;
}

async function readProviderNetwork(provider: DapiProvider): Promise<NeoNetwork | null> {
  if (typeof provider.getNetwork === "function") {
    try {
      return normalizeNeoNetwork(await provider.getNetwork());
    } catch (_e: unknown) {
      return normalizeNeoNetwork(provider.network);
    }
  }
  return normalizeNeoNetwork(provider.network);
}

function getDapiAccountAddress(
  account: Partial<DapiAccount> | Record<string, unknown> | null | undefined,
  fallback = "",
): string {
  if (!account || typeof account !== "object") return fallback;
  const record = account as Record<string, unknown>;
  return String(record.address ?? record.Address ?? fallback).trim();
}

function getDapiAccountHash(
  account: Partial<DapiAccount> | Record<string, unknown> | null | undefined,
): string {
  if (!account || typeof account !== "object") return "";
  const record = account as Record<string, unknown>;
  const direct = String(
    record.accountHash ??
      record.hash ??
      record.scriptHash ??
      record.Hash ??
      record.ScriptHash ??
      "",
  ).trim();
  if (direct) return direct;
  const accountAddress = getDapiAccountAddress(account);
  return /^N/.test(accountAddress) ? neoAddressToScriptHash(accountAddress) : "";
}

function scopeToDapi(scope: string | number): string {
  const scopeByNumber: Record<number, string> = {
    0: "None",
    1: "CalledByEntry",
    16: "CustomContracts",
    32: "CustomGroups",
    64: "WitnessRules",
    128: "Global",
  };
  if (typeof scope === "number" && Number.isFinite(scope)) {
    if (scopeByNumber[scope]) return scopeByNumber[scope];
    const parts = Object.entries(scopeByNumber)
      .filter(
        ([bit]) => Number(bit) !== 0 && (scope & Number(bit)) === Number(bit),
      )
      .map(([, name]) => name);
    return parts.length ? parts.join(", ") : "CalledByEntry";
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
  throw new WalletTransactionError("Connected Neo wallet did not return a transaction hash");
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
  const mapArg = (arg: { type: string; value: unknown }): { type: string; value: unknown } => {
    if (
      accountHash &&
      currentAddress &&
      String(arg.type).toLowerCase() === "hash160" &&
      arg.value === currentAddress
    ) {
      return { ...arg, value: accountHash };
    }
    if (String(arg.type).toLowerCase() === "array" && Array.isArray(arg.value)) {
      return {
        ...arg,
        value: arg.value.map((entry) =>
          entry &&
          typeof entry === "object" &&
          "type" in entry &&
          "value" in entry
            ? mapArg(entry as { type: string; value: unknown })
            : entry,
        ),
      };
    }
    return arg;
  };
  return args.map(mapArg);
}

function mapDapiSigners(
  signers: InvokeParams["signers"],
  accountHash?: string | null,
  currentAddress?: string | null,
) {
  return signers?.map((signer) => ({
    ...signer,
    account: signer.account === currentAddress && accountHash ? accountHash : signer.account,
    scopes: scopeToDapi(signer.scopes),
  }));
}

export class Nep21Adapter implements WalletAdapter {
  readonly name = "NEP-21 dAPI";
  readonly icon = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%2300e599'/%3E%3Ctext x='32' y='38' text-anchor='middle' font-size='17' font-weight='800' font-family='Arial,sans-serif' fill='%2307111a'%3EN21%3C/text%3E%3C/svg%3E";
  readonly downloadUrl = "https://developers.neo.org/docs/n3/develop/tools/wallets";

  private provider: DapiProvider | null = null;
  private accountHash: string | null = null;
  private address: string | null = null;

  constructor(private readonly preference: DapiProviderPreference = "any") {}

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
    return !!getImmediateProvider(this.preference);
  }

  private async getProvider(): Promise<DapiProvider> {
    if (this.provider) return this.provider;
    this.provider = await waitForProvider(3000, this.preference);
    return this.provider;
  }

  private resolveDapiAccount(account?: string | null): string {
    if (account && this.accountHash && this.address && account === this.address) {
      return this.accountHash;
    }
    return account ?? this.accountHash ?? this.address ?? "";
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
      const accountHash = getDapiAccountHash(account);
      if (account && accountHash) {
        this.accountHash = accountHash;
        this.address = getDapiAccountAddress(account, accountHash);
        return {
          address: this.address,
          accountHash: this.accountHash ?? undefined,
          publicKey: "",
          label: account.label,
          network: await readProviderNetwork(provider),
        };
      }

      if (!provider.authenticate) {
        throw new WalletConnectionError("Connected Neo wallet did not return any account");
      }
      const authenticated = await provider.authenticate({
        action: "Authentication",
        grant_type: "Signature",
        allowed_algorithms: ["ECDSA-P256"],
        domain: getAuthenticationDomain(),
        networks: getAuthenticationNetworks(),
        nonce: createNonce(),
        timestamp: Date.now(),
      });
      if (!authenticated.address) throw new WalletConnectionError("Connected Neo wallet authentication did not return an address");
      this.accountHash = getDapiAccountHash(authenticated) || null;
      this.address = authenticated.address;
      return {
        address: authenticated.address,
        accountHash: this.accountHash ?? undefined,
        publicKey: authenticated.pubkey || "",
        network: normalizeNeoNetwork(authenticated.network) ?? await readProviderNetwork(provider),
      };
    } catch (error) {
      if (error instanceof WalletConnectionError) throw error;
      throw new WalletConnectionError(`Failed to connect Neo wallet: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async connectSilently(): Promise<WalletAccount | null> {
    let provider: DapiProvider;
    try {
      provider = await this.getProvider();
    } catch (_e: unknown) {
      return null;
    }
    let accounts: DapiAccount[] = [];
    try {
      accounts = await provider.getAccounts();
    } catch (_e: unknown) {
      // The provider requires an explicit auth prompt; silent restore is not
      // possible, and we intentionally never call authenticate() here.
      return null;
    }
    const account = accounts.find((entry) => entry.isDefault) ?? accounts[0];
    const accountHash = getDapiAccountHash(account);
    if (!account || !accountHash) return null;
    this.accountHash = accountHash;
    this.address = getDapiAccountAddress(account, accountHash);
    return {
      address: this.address,
      accountHash: this.accountHash ?? undefined,
      publicKey: "",
      label: account.label,
      network: await readProviderNetwork(provider),
    };
  }

  async disconnect(): Promise<void> {
    forgetRememberedProvider(this.provider);
    this.provider = null;
    this.accountHash = null;
    this.address = null;
  }

  async getNetwork(): Promise<NeoNetwork | null> {
    const provider = await this.getProvider();
    return readProviderNetwork(provider);
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
    if (!provider.signMessage) throw new WalletTransactionError("Connected Neo wallet does not support message signing");
    const signed = await provider.signMessage(encodeBase64Utf8(message), this.accountHash ?? this.address ?? undefined);
    return {
      publicKey: String(signed.pubkey ?? signed.publicKey ?? ""),
      data: String(signed.signature ?? signed.data ?? ""),
      salt: "",
      message,
    };
  }

  async invoke(params: InvokeParams): Promise<TransactionResult> {
    const provider = await this.getProvider();
    if (!provider.invoke) throw new WalletTransactionError("Connected Neo wallet does not support contract invoke");
    const invocation: DapiInvocation = {
      hash: params.scriptHash,
      operation: normalizeOperationName(params.operation),
      args: mapDapiArgs(params.args, this.accountHash, this.address),
    };
    const signers = mapDapiSigners(params.signers, this.accountHash, this.address);
    return normalizeTxResult(await provider.invoke([invocation], signers));
  }

  async invokeMultiple(
    params: InvokeParams[],
    signers?: InvokeParams["signers"],
  ): Promise<TransactionResult> {
    const provider = await this.getProvider();
    if (!provider.invoke) throw new WalletTransactionError("Connected Neo wallet does not support contract invoke");
    if (!params.length) throw new WalletTransactionError("No NEP-21 invocations to submit");
    const invocations: DapiInvocation[] = params.map((param) => ({
      hash: param.scriptHash,
      operation: normalizeOperationName(param.operation),
      args: mapDapiArgs(param.args, this.accountHash, this.address),
    }));
    const signerList = mapDapiSigners(signers ?? params[0]?.signers, this.accountHash, this.address);
    return normalizeTxResult(await provider.invoke(invocations, signerList));
  }

  async send(
    asset: string,
    amount: string | number,
    to: string,
    from?: string,
  ): Promise<TransactionResult> {
    const provider = await this.getProvider();
    const assetHash = normalizeAssetHash(asset);
    const sender = from || this.address || this.accountHash || "";
    if (!sender) {
      throw new WalletTransactionError("Connected Neo wallet account is required to send assets");
    }

    if (provider.send) {
      return normalizeTxResult(
        await provider.send(
          assetHash,
          this.resolveDapiAccount(sender),
          to,
          String(amount),
        ),
      );
    }

    if (!provider.invoke) {
      throw new WalletTransactionError("Connected Neo wallet does not support asset transfers");
    }

    const rawAmount = parseTransferAmount(amount, transferDecimalsForAsset(assetHash));
    return this.invoke({
      scriptHash: assetHash,
      operation: "transfer",
      args: [
        { type: "Hash160", value: sender },
        { type: "Hash160", value: to },
        { type: "Integer", value: rawAmount },
        { type: "Any", value: null },
      ],
      signers: [{ account: sender, scopes: 1 }],
    });
  }
}
