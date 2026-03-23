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
  const raw = trim(String(account ?? ""));
  return raw.startsWith("0x") ? raw.slice(2) : raw;
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

function resolveSigningKey(account) {
  if (!account) throw new Error("account is required to sign transaction");
  return account.WIF || account.privateKey;
}

async function estimateNetworkFee(rpcClient, transaction) {
  try {
    const result = await rpcClient.inner.calculateNetworkFee({ tx: transaction.serialize(true) });
    return BigInt(result?.networkfee || 0);
  } catch (_error) {
    return 5000000n;
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
    return this.inner.send(query.method, query.params);
  }

  async send(method, params = []) {
    return this.inner.send(method, params);
  }

  async getApplicationLog(txid, trigger) {
    return this.inner.getApplicationLog({ hash: normalizeTxId(txid), trigger });
  }

  async getBlockCount() {
    return this.inner.getBlockCount();
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
    return this.inner.send("invokefunction", params);
  }

  async sendRawTransaction(input) {
    const serialized =
      typeof input === "string"
        ? input
        : typeof input?.serialize === "function"
          ? input.serialize(true)
          : input?.tx;
    return this.inner.sendRawTransaction({ tx: serialized });
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

ContractParam.bool = ContractParam.boolean;

const sc = {
  ContractParam,
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
