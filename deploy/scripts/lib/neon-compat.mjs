import {
  RpcClient as CoreRpcClient,
  WitnessScope,
  bytesToHex,
  deserialize,
  hexToBytes,
  testNetworkId,
  mainNetworkId,
} from "@r3e/neo-js-sdk";
import { Account } from "@r3e/neo-js-sdk/wallet/browser";
import { ContractParam } from "@r3e/neo-js-sdk/compat/contract-param";
import { HexString } from "@r3e/neo-js-sdk/compat/u";
import { ScriptBuilder } from "@r3e/neo-js-sdk/compat/sc";
import { Transaction, Witness } from "@r3e/neo-js-sdk/compat/tx";
import {
  getAddressFromScriptHash,
  getScriptHashFromAddress,
  isAddress,
  signHex,
} from "@r3e/neo-js-sdk/compat/wallet-helpers";
import { hash160, reverseHex } from "@r3e/neo-js-sdk";
import { Tx as CoreTx } from "@r3e/neo-js-sdk";

function trim(value) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeHash(value) {
  const raw = trim(value);
  if (!raw) return raw;
  return raw.startsWith("0x") ? raw : `0x${raw}`;
}

function normalizeTxId(value) {
  return normalizeHash(value);
}

function normalizeParam(param) {
  if (param && typeof param?.toJSON === "function") return param.toJSON();
  if (param && typeof param?.toJson === "function") return param.toJson();
  return param;
}

function normalizeParams(params = []) {
  return params.map((param) => normalizeParam(param));
}

function normalizeSignerAccount(account) {
  return normalizeHash(account);
}

function normalizeSigners(signers = []) {
  return signers.map((signer) => ({
    ...signer,
    account: normalizeSignerAccount(signer.account),
  }));
}

function defaultSigners(account) {
  if (!account) return [];
  return [{ account: account.scriptHash, scopes: "CalledByEntry" }];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAttempts() {
  const raw = Number(process.env.NEO_RPC_RETRY_ATTEMPTS || "5");
  return Number.isFinite(raw) && raw > 0 ? Math.trunc(raw) : 5;
}

function retryDelayMs() {
  const raw = Number(process.env.NEO_RPC_RETRY_DELAY_MS || "250");
  return Number.isFinite(raw) && raw >= 0 ? Math.trunc(raw) : 250;
}

function isTransientRpcError(error) {
  const message = String(error?.message || error || "");
  return /operation was aborted|aborted|timeout|timed out|fetch failed|econnreset|etimedout|eai_again|502|503|504/i.test(message);
}

async function withTransientRpcRetry(label, fn) {
  const attempts = retryAttempts();
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= attempts || !isTransientRpcError(error)) {
        if (!isTransientRpcError(error)) throw error;
        const message = error instanceof Error ? error.message : String(error);
        const wrapped = new Error(`${label}: ${message}`);
        if (error instanceof Error && error.stack) {
          wrapped.stack = `${wrapped.name}: ${wrapped.message}\nCaused by: ${error.stack}`;
        }
        throw wrapped;
      }
      await sleep(retryDelayMs() * attempt);
    }
  }
  throw lastError || new Error(`${label} failed`);
}

function resolveSigningKey(account) {
  if (!account) throw new Error("account is required to sign transaction");
  return account.WIF || account.privateKey;
}

function toRpcBinaryPayload(value) {
  if (value instanceof Transaction) {
    return hexToBytes(value.serialize(true));
  }
  if (typeof value?.serialize === "function") {
    const serialized = value.serialize(true);
    if (typeof serialized === "string" && /^[0-9a-f]+$/i.test(serialized)) {
      return hexToBytes(serialized);
    }
    return serialized;
  }
  if (typeof value === "string" && /^[0-9a-f]+$/i.test(value)) {
    return hexToBytes(value);
  }
  return value;
}

const NETWORK_FEE_FALLBACK_ENV = "NEON_COMPAT_NETWORK_FEE_FALLBACK";
const DEFAULT_NETWORK_FEE_FALLBACK = 5000000n;

function resolveNetworkFeeFallback(env) {
  const raw = String(env[NETWORK_FEE_FALLBACK_ENV] || "").trim();
  if (!raw) return null;
  if (/^(1|true|yes)$/i.test(raw)) return DEFAULT_NETWORK_FEE_FALLBACK;
  let value;
  try {
    value = BigInt(raw);
  } catch {
    value = null;
  }
  if (value === null || value <= 0n) {
    throw new Error(
      `${NETWORK_FEE_FALLBACK_ENV} must be "1" or a positive datoshi integer, got "${raw}"`
    );
  }
  return value;
}

async function estimateNetworkFee(rpcClient, transaction, { env = process.env } = {}) {
  try {
    const result = await withTransientRpcRetry("rpc.calculatenetworkfee", () =>
      rpcClient.inner.calculateNetworkFee({
        tx: toRpcBinaryPayload(transaction),
      })
    );
    return BigInt(result?.networkfee || 0);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const fallback = resolveNetworkFeeFallback(env);
    if (fallback === null) {
      const wrapped = new Error(
        `calculatenetworkfee failed: ${message} (set ${NETWORK_FEE_FALLBACK_ENV}=1 or a datoshi amount to substitute a flat network fee)`
      );
      if (error instanceof Error && error.stack) {
        wrapped.stack = `${wrapped.name}: ${wrapped.message}\nCaused by: ${error.stack}`;
      }
      throw wrapped;
    }
    console.warn(
      `[neon-compat] calculatenetworkfee failed (${message}); substituting flat network fee ${fallback} datoshi via ${NETWORK_FEE_FALLBACK_ENV}`
    );
    return fallback;
  }
}

class Query {
  constructor({ method, params = [] } = {}) {
    this.method = method;
    this.params = params;
  }
}

class RPCClient {
  constructor(rpcAddress) {
    this.rpcAddress = rpcAddress;
    this.inner = new CoreRpcClient(rpcAddress);
  }

  async execute(query) {
    return this.send(query.method, query.params);
  }

  async send(method, params = []) {
    return withTransientRpcRetry(`rpc.${method}`, () => this.inner.send(method, params));
  }

  async getApplicationLog(txid, trigger) {
    return withTransientRpcRetry("rpc.getApplicationLog", () =>
      this.inner.getApplicationLog({ hash: normalizeTxId(txid), trigger })
    );
  }

  async getBlockCount() {
    return withTransientRpcRetry("rpc.getBlockCount", () => this.inner.getBlockCount());
  }

  async invokeFunction(scriptHash, operation, args = [], signers = undefined) {
    const params = [
      normalizeHash(scriptHash),
      operation,
      normalizeParams(args),
    ];
    if (Array.isArray(signers) && signers.length > 0) {
      params.push(normalizeSigners(signers));
    }
    return this.send("invokefunction", params);
  }

  async sendRawTransaction(input) {
    const payload =
      typeof input === "string" || typeof input?.serialize === "function"
        ? input
        : input?.tx;
    return withTransientRpcRetry("rpc.sendrawtransaction", async () => {
      try {
        return await this.inner.sendRawTransaction({ tx: toRpcBinaryPayload(payload) });
      } catch (error) {
        const message = String(error?.message || error || "");
        const hash = typeof input?.hash === "function" ? input.hash() : input?.hash;
        if (/already exists|alreadyaccepted|already in mempool/i.test(message) && hash) {
          return { hash, alreadyAccepted: true };
        }
        throw error;
      }
    });
  }
}

class SmartContract {
  constructor(scriptHash, { rpcAddress, networkMagic, account } = {}) {
    this.scriptHash = normalizeHash(scriptHash);
    this.rpcAddress = rpcAddress;
    this.networkMagic = Number(networkMagic || testNetworkId());
    this.account = account || null;
    this.rpc = new RPCClient(rpcAddress);
  }

  async testInvoke(operation, params = [], signers = undefined) {
    const invokeSigners = Array.isArray(signers) && signers.length > 0
      ? normalizeSigners(signers)
      : defaultSigners(this.account);
    return this.rpc.invokeFunction(this.scriptHash, operation, params, invokeSigners);
  }

  async invoke(operation, params = [], signers = undefined) {
    const invokeSigners = Array.isArray(signers) && signers.length > 0
      ? normalizeSigners(signers)
      : defaultSigners(this.account);
    const preview = await this.rpc.invokeFunction(this.scriptHash, operation, params, invokeSigners);
    if (String(preview?.state || "").toUpperCase() === "FAULT") {
      throw new Error(preview?.exception || `${operation} preview failed`);
    }
    if (!preview?.script) {
      throw new Error(`${operation} preview did not return a script`);
    }

    const currentHeight = await this.rpc.getBlockCount();
    const baseTx = {
      signers: invokeSigners,
      validUntilBlock: currentHeight + 100,
      script: Buffer.from(preview.script, "base64").toString("hex"),
      systemFee: BigInt(Math.ceil(Number(preview.gasconsumed || 0) * 1.5)),
    };

    const signingKey = resolveSigningKey(this.account);

    const feeProbeTx = new Transaction({
      ...baseTx,
      networkFee: 0n,
    });
    feeProbeTx.sign(signingKey, this.networkMagic);
    const networkFee = await estimateNetworkFee(this.rpc, feeProbeTx);

    const finalTx = new Transaction({
      ...baseTx,
      networkFee,
    });
    finalTx.sign(signingKey, this.networkMagic);

    const result = await this.rpc.sendRawTransaction(finalTx);
    return typeof result === "string" ? result : result?.hash;
  }
}

const wallet = {
  Account,
  getAddressFromScriptHash,
  getScriptHashFromAddress,
  isAddress,
  sign: signHex,
};

const rpc = {
  RPCClient,
  Query,
};

// Local compat alias: ContractParam.bool === ContractParam.boolean.
// Implemented as a subclass so importing this module no longer mutates the
// shared @r3e/neo-js-sdk ContractParam class as a side effect (the previous
// `ContractParam.bool = ContractParam.boolean` patched it process-wide for
// every other consumer).
class CompatContractParam extends ContractParam {}
CompatContractParam.bool = ContractParam.boolean.bind(ContractParam);

const sc = {
  ContractParam: CompatContractParam,
  ScriptBuilder,
};

const u = {
  HexString,
  reverseHex,
  hash160,
  BigInteger: {
    fromNumber(value) {
      return BigInt(Math.trunc(Number(value)));
    },
    fromString(value) {
      return BigInt(String(value));
    },
  },
};

const tx = {
  Transaction,
  Witness,
  WitnessScope,
};

const experimental = {
  SmartContract,
};

export { estimateNetworkFee, NETWORK_FEE_FALLBACK_ENV };

export default {
  wallet,
  rpc,
  sc,
  u,
  tx,
  experimental,
  CONST: {
    MAGIC_NUMBER: {
      TestNet: testNetworkId(),
      MainNet: mainNetworkId(),
    },
  },
  deserializeUnsignedTx(hex) {
    return deserialize(hexToBytes(hex), CoreTx);
  },
  bytesToHex,
  hexToBytes,
};
