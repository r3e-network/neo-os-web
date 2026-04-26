/**
 * Direct WIF wallet adapter for local and testnet validation.
 *
 * The private key stays in browser memory only. RPC calls go through the host
 * API with signed transaction payloads; the WIF is never sent to the server.
 */

import type * as NeoSdk from "@r3e/neo-js-sdk/browser";
import { getRpcNetwork } from "@/lib/rpc-helpers";
import { logger } from "@/lib/logger";
import {
  InvokeParams,
  SignedMessage,
  TransactionResult,
  WalletAccount,
  WalletAdapter,
  WalletBalance,
  WalletConnectionError,
  WalletTransactionError,
} from "./base";

type NeoBrowserSdk = typeof NeoSdk;
type NeoAccount = ReturnType<NeoBrowserSdk["Account"]["fromWIF"]>;
type ContractParamInput = Parameters<NeoBrowserSdk["sc"]["ContractParam"]["fromJson"]>[0];
type NeoNetwork = "mainnet" | "testnet";

type NeoRpcEnvelope<T> = {
  jsonrpc?: string;
  id?: number | string;
  result?: T;
  error?: { code?: number; message?: string };
};

type NeoRpcStackItem = {
  type?: string;
  value?: unknown;
};

type NeoRpcInvokeResult = {
  state?: string;
  exception?: string | null;
  gasconsumed?: string;
  stack?: NeoRpcStackItem[];
};

type NeoRpcNetworkFeeResult = {
  networkfee?: string;
};

type NeoRpcSendResult = {
  hash?: string;
};

type NeoRpcVersionResult = {
  protocol?: {
    network?: number | string;
  };
};

type RpcSigner = {
  account: string;
  scopes: string;
  allowedcontracts?: string[];
};

type TxSigner = {
  account: string;
  scopes: number;
  allowedcontracts?: string[];
};

type NormalizedInvocation = {
  script: Uint8Array;
  rpcArgs: unknown[];
  rpcSigners: RpcSigner[];
  txSigners: TxSigner[];
};

const NEO_CONTRACT = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const GAS_CONTRACT = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const DEFAULT_NETWORK_FEE = 5_000_000n;
const VALID_UNTIL_BLOCK_DELTA = 5_760;
const DEFAULT_MAX_SYSTEM_FEE_GAS = "20";

let sdkPromise: Promise<NeoBrowserSdk> | null = null;

function loadSdk(): Promise<NeoBrowserSdk> {
  if (!sdkPromise) {
    sdkPromise = import("@r3e/neo-js-sdk/browser");
  }
  return sdkPromise;
}

function textToHex(value: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < value.length; i += 1) {
    let codePoint = value.codePointAt(i);
    if (codePoint === undefined) continue;
    if (codePoint > 0xffff) i += 1;

    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function with0x(value: string): string {
  return value.startsWith("0x") || value.startsWith("0X") ? value : `0x${value}`;
}

function strip0x(value: string): string {
  return value.replace(/^0x/i, "");
}

function normalizeHash160(value: string): string {
  const hash = strip0x(value.trim()).toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(hash)) {
    throw new Error("expected a 20-byte script hash");
  }
  return with0x(hash);
}

function normalizeTxId(value: string): string {
  const hash = strip0x(value.trim()).toLowerCase();
  return /^[0-9a-f]{64}$/.test(hash) ? with0x(hash) : value;
}

function scopeName(scopes: number): string {
  if (scopes === 0) return "None";
  if (scopes === 1) return "CalledByEntry";
  if (scopes === 16) return "CustomContracts";
  if (scopes === 32) return "CustomGroups";
  if (scopes === 64) return "WitnessRules";
  if (scopes === 128) return "Global";

  const names: string[] = [];
  if (scopes & 1) names.push("CalledByEntry");
  if (scopes & 16) names.push("CustomContracts");
  if (scopes & 32) names.push("CustomGroups");
  if (scopes & 64) names.push("WitnessRules");
  if (scopes & 128) names.push("Global");
  return names.length > 0 ? names.join(",") : "CalledByEntry";
}

function parseFixed8(value: unknown): bigint {
  const raw = String(value ?? "0").trim();
  if (!raw) return 0n;
  const sign = raw.startsWith("-") ? -1n : 1n;
  const unsigned = raw.replace(/^[+-]/, "");
  if (/^\d+$/.test(unsigned)) return sign * BigInt(unsigned);
  if (!/^\d+\.\d+$/.test(unsigned)) {
    throw new Error(`invalid fixed-8 amount: ${raw}`);
  }

  const [whole, fraction] = unsigned.split(".");
  const padded = `${fraction.slice(0, 8)}${"0".repeat(Math.max(0, 8 - fraction.length))}`;
  return sign * (BigInt(whole || "0") * 100_000_000n + BigInt(padded || "0"));
}

function parseGasAmount(value: unknown): bigint {
  const raw = String(value ?? "0").trim();
  if (!raw) return 0n;
  const sign = raw.startsWith("-") ? -1n : 1n;
  const unsigned = raw.replace(/^[+-]/, "");
  if (/^\d+$/.test(unsigned)) return sign * BigInt(unsigned) * 100_000_000n;
  if (!/^\d+\.\d+$/.test(unsigned)) {
    throw new Error(`invalid GAS amount: ${raw}`);
  }

  const [whole, fraction] = unsigned.split(".");
  const padded = `${fraction.slice(0, 8)}${"0".repeat(Math.max(0, 8 - fraction.length))}`;
  return sign * (BigInt(whole || "0") * 100_000_000n + BigInt(padded || "0"));
}

function formatFixed8(value: bigint): string {
  const sign = value < 0n ? "-" : "";
  const absolute = value < 0n ? -value : value;
  const whole = absolute / 100_000_000n;
  const fraction = (absolute % 100_000_000n).toString().padStart(8, "0").replace(/0+$/, "");
  return fraction ? `${sign}${whole}.${fraction}` : `${sign}${whole}`;
}

function getMaxSystemFee(): bigint {
  return parseGasAmount(
    process.env.NEXT_PUBLIC_WIF_MAX_SYSTEM_FEE_GAS || DEFAULT_MAX_SYSTEM_FEE_GAS,
  );
}

function randomNonce(): number {
  if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0] >>> 0;
  }
  return Math.floor(Math.random() * 0x100000000) >>> 0;
}

function getNetworkMagic(
  sdk: NeoBrowserSdk,
  network: NeoNetwork,
  version: NeoRpcVersionResult | undefined,
): number {
  const rpcMagic = Number(version?.protocol?.network);
  if (Number.isFinite(rpcMagic) && rpcMagic > 0) return rpcMagic;
  return network === "testnet" ? sdk.testNetworkId() : sdk.mainNetworkId();
}

async function neoRpc<T>(
  network: NeoNetwork,
  method: string,
  params: unknown[] = [],
): Promise<T> {
  const response = await fetch("/api/rpc/neo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ network, method, params }),
    signal: AbortSignal.timeout(30_000),
  });

  const envelope = (await response.json().catch(() => null)) as NeoRpcEnvelope<T> | { error?: unknown } | null;
  if (!response.ok) {
    const message = envelope && typeof envelope === "object" && "error" in envelope
      ? typeof envelope.error === "string"
        ? envelope.error
        : "Neo RPC request failed"
      : "Neo RPC request failed";
    throw new Error(message);
  }
  if (!envelope || typeof envelope !== "object") {
    throw new Error("Neo RPC returned an invalid response");
  }
  if ("error" in envelope && envelope.error) {
    const error = envelope.error;
    if (typeof error === "object" && error !== null && "message" in error) {
      throw new Error(String(error.message || "Neo RPC error"));
    }
    throw new Error(String(error));
  }
  if (!("result" in envelope)) {
    throw new Error("Neo RPC response did not include a result");
  }
  return envelope.result as T;
}

async function accountToScriptHash(
  sdk: NeoBrowserSdk,
  accountOrHash: string,
): Promise<string> {
  const raw = accountOrHash.trim();
  if (/^(0x)?[0-9a-fA-F]{40}$/.test(raw)) return normalizeHash160(raw);
  if (sdk.wallet.isAddress(raw)) return normalizeHash160(sdk.wallet.getScriptHashFromAddress(raw));
  throw new Error("signer account must be a Neo address or script hash");
}

function toContractParamJson(arg: { type: string; value: unknown }): ContractParamInput {
  // The runtime SDK validates the concrete Neo parameter type. Miniapp
  // definitions keep this field as a string so catalog data can be parsed first.
  if (arg.value === undefined) return { type: arg.type } as ContractParamInput;
  return { type: arg.type, value: arg.value } as ContractParamInput;
}

async function normalizeInvocation(
  sdk: NeoBrowserSdk,
  account: NeoAccount,
  params: InvokeParams,
): Promise<NormalizedInvocation> {
  const contractParams = params.args.map((arg) =>
    sdk.sc.ContractParam.fromJson(toContractParamJson(arg)),
  );
  const script = new sdk.sc.ScriptBuilder()
    .emitContractCall(
      normalizeHash160(params.scriptHash),
      params.operation,
      sdk.sc.CallFlags.All,
      contractParams,
    )
    .toBytes();

  const requestedSigners = params.signers?.length
    ? params.signers
    : [{ account: account.address, scopes: sdk.tx.WitnessScope.CalledByEntry }];

  const txSigners: TxSigner[] = [];
  const rpcSigners: RpcSigner[] = [];
  for (const signer of requestedSigners) {
    const accountHash = await accountToScriptHash(sdk, signer.account);
    const scopes = Number(signer.scopes);
    const allowedcontracts = signer.allowedContracts?.map(normalizeHash160);
    txSigners.push({
      account: accountHash,
      scopes,
      ...(allowedcontracts?.length ? { allowedcontracts } : {}),
    });
    rpcSigners.push({
      account: accountHash,
      scopes: scopeName(scopes),
      ...(allowedcontracts?.length ? { allowedcontracts } : {}),
    });
  }

  return {
    script,
    rpcArgs: params.args.map(toContractParamJson),
    rpcSigners,
    txSigners,
  };
}

function serializeTransactionBase64(sdk: NeoBrowserSdk, transaction: InstanceType<NeoBrowserSdk["tx"]["Transaction"]>): string {
  return sdk.bytesToBase64(sdk.hexToBytes(transaction.serialize(true)));
}

function createTransaction(
  sdk: NeoBrowserSdk,
  init: {
    script: Uint8Array;
    signers: TxSigner[];
    systemFee: bigint;
    networkFee: bigint;
    validUntilBlock: number;
    networkMagic: number;
    wif: string;
  },
) {
  const transaction = new sdk.tx.Transaction({
    nonce: randomNonce(),
    systemFee: init.systemFee,
    networkFee: init.networkFee,
    validUntilBlock: init.validUntilBlock,
    script: init.script,
    signers: init.signers,
  });
  transaction.sign(init.wif, init.networkMagic);
  return transaction;
}

export class WifAdapter implements WalletAdapter {
  readonly name = "Direct WIF";
  readonly icon = "";
  readonly downloadUrl = "";

  private wif: string | null = null;
  private account: NeoAccount | null = null;

  isInstalled(): boolean {
    return true;
  }

  async connect(): Promise<WalletAccount> {
    if (!this.account) {
      throw new WalletConnectionError("Paste a WIF before connecting the direct wallet");
    }
    return {
      address: this.account.address,
      publicKey: String(this.account.publicKey),
      label: "Direct WIF",
    };
  }

  async connectWithWif(wif: string): Promise<WalletAccount> {
    const normalized = wif.trim();
    if (!normalized) {
      throw new WalletConnectionError("WIF is required");
    }

    try {
      const sdk = await loadSdk();
      const account = sdk.Account.fromWIF(normalized);
      this.wif = normalized;
      this.account = account;
      return {
        address: account.address,
        publicKey: String(account.publicKey),
        label: "Direct WIF",
      };
    } catch (error) {
      this.wif = null;
      this.account = null;
      throw new WalletConnectionError(
        `Invalid WIF: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async disconnect(): Promise<void> {
    this.wif = null;
    this.account = null;
  }

  async getBalance(address: string): Promise<WalletBalance> {
    try {
      const sdk = await loadSdk();
      const network = getRpcNetwork();
      const accountHash = await accountToScriptHash(sdk, address);
      const [neo, gas] = await Promise.all([
        this.getNep17Balance(network, NEO_CONTRACT, accountHash),
        this.getNep17Balance(network, GAS_CONTRACT, accountHash),
      ]);
      return {
        neo: String(neo),
        gas: formatFixed8(gas),
      };
    } catch (error) {
      logger.warn(
        "[wif-wallet] balance lookup failed:",
        error instanceof Error ? error.message : String(error),
      );
      return { neo: "0", gas: "0" };
    }
  }

  async signMessage(message: string): Promise<SignedMessage> {
    if (!this.account) {
      throw new WalletConnectionError("Direct WIF wallet is not connected");
    }
    return {
      publicKey: String(this.account.publicKey),
      data: this.account.sign(textToHex(message)),
      salt: "",
      message,
    };
  }

  async invoke(params: InvokeParams): Promise<TransactionResult> {
    if (!this.account || !this.wif) {
      throw new WalletConnectionError("Direct WIF wallet is not connected");
    }

    try {
      const sdk = await loadSdk();
      const network = getRpcNetwork();
      const [blockCount, version] = await Promise.all([
        neoRpc<number>(network, "getblockcount"),
        neoRpc<NeoRpcVersionResult>(network, "getversion"),
      ]);
      const networkMagic = getNetworkMagic(sdk, network, version);
      const invocation = await normalizeInvocation(sdk, this.account, params);

      const preflight = await neoRpc<NeoRpcInvokeResult>(network, "invokefunction", [
        normalizeHash160(params.scriptHash),
        params.operation,
        invocation.rpcArgs,
        invocation.rpcSigners,
      ]);
      if (preflight.state && preflight.state !== "HALT") {
        throw new Error(preflight.exception || `contract preflight failed with state=${preflight.state}`);
      }

      const systemFee = parseFixed8(preflight.gasconsumed || "0");
      const maxSystemFee = getMaxSystemFee();
      if (systemFee > maxSystemFee) {
        throw new Error(
          `estimated system fee ${formatFixed8(systemFee)} GAS exceeds direct WIF limit ${formatFixed8(maxSystemFee)} GAS`,
        );
      }

      const validUntilBlock = Number(blockCount) + VALID_UNTIL_BLOCK_DELTA;
      const draft = createTransaction(sdk, {
        script: invocation.script,
        signers: invocation.txSigners,
        systemFee,
        networkFee: 0n,
        validUntilBlock,
        networkMagic,
        wif: this.wif,
      });

      let networkFee = DEFAULT_NETWORK_FEE;
      try {
        const fee = await neoRpc<NeoRpcNetworkFeeResult>(network, "calculatenetworkfee", [
          serializeTransactionBase64(sdk, draft),
        ]);
        networkFee = parseFixed8(fee.networkfee || "0");
      } catch (error) {
        logger.warn(
          "[wif-wallet] calculatenetworkfee failed, using fallback:",
          error instanceof Error ? error.message : String(error),
        );
      }

      const finalTransaction = createTransaction(sdk, {
        script: invocation.script,
        signers: invocation.txSigners,
        systemFee,
        networkFee,
        validUntilBlock,
        networkMagic,
        wif: this.wif,
      });
      const txBase64 = serializeTransactionBase64(sdk, finalTransaction);
      const relayResult = await neoRpc<NeoRpcSendResult | boolean | string>(network, "sendrawtransaction", [
        txBase64,
      ]);
      const txid = typeof relayResult === "object" && relayResult && "hash" in relayResult
        ? relayResult.hash
        : finalTransaction.hash();

      return {
        txid: normalizeTxId(String(txid || finalTransaction.hash())),
      };
    } catch (error) {
      throw new WalletTransactionError(
        error instanceof Error ? error.message : "Direct WIF transaction failed",
      );
    }
  }

  private async getNep17Balance(
    network: NeoNetwork,
    contractHash: string,
    accountHash: string,
  ): Promise<bigint> {
    const result = await neoRpc<NeoRpcInvokeResult>(network, "invokefunction", [
      contractHash,
      "balanceOf",
      [{ type: "Hash160", value: accountHash }],
    ]);
    const value = result.stack?.[0]?.value;
    return BigInt(String(value ?? "0"));
  }
}
