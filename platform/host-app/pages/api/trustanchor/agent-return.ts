import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { standardLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { requireMiniAppAdmin } from "@/lib/admin-auth";
import {
  OpCode,
  PrivateKey,
  RpcClient,
  Tx as CoreTx,
  bytesToHex,
  deserialize,
  hexToBytes,
} from "@r3e/neo-js-sdk/core";
import { sc, tx, u, wallet } from "@r3e/neo-js-sdk/browser";

const RPC_URL = String(process.env.TRUSTANCHOR_RPC_URL || process.env.NEO_RPC_URL || "https://testnet1.neo.coz.io:443").trim();
const NETWORK_MAGIC = parseInt(
  String(process.env.TRUSTANCHOR_NETWORK_MAGIC || process.env.NEXT_PUBLIC_NETWORK_MAGIC || "894710606"),
  10,
);
const TRUSTANCHOR_HASH = String(process.env.TRUSTANCHOR_TESTNET_HASH || "0x57e6e62e0a123ac8bac2ab58636d50b54ef054f2").trim();
const ADMIN_WIF = String(process.env.TRUSTANCHOR_ADMIN_WIF || "").trim();
const SPONSORED_WIF = String(process.env.SPONSORED_WIF || "").trim();
const CHECKSIG_SYSCALL = "System.Crypto.CheckSig";
const MAX_AGENT_ID = 21;
const NEO_TOKEN_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";

type AgentReturnBody = {
  agentId?: number;
  amount?: number | string;
};

interface StackItem {
  type: string;
  value: unknown;
  key?: StackItem;
}

interface MapEntry {
  key?: StackItem;
  value?: StackItem;
}

type InvokeResultLike = {
  state?: string;
  exception?: string;
  gasconsumed?: string | number;
  script?: string;
  stack?: StackItem[];
};

function parsePositiveInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function buildAgentAccount(adminAccount: InstanceType<typeof wallet.Account>, agentId: number) {
  const builder = new sc.ScriptBuilder();
  builder.emitNumber(agentId);
  builder.emit(OpCode.DROP);
  builder.emitPublicKey(String(adminAccount.publicKey));
  builder.emitSyscall(CHECKSIG_SYSCALL);
  const verificationScript = builder.build();
  const scriptHash = u.reverseHex(u.hash160(verificationScript));
  return {
    verificationScript,
    scriptHash: `0x${scriptHash}`,
    address: wallet.getAddressFromScriptHash(scriptHash),
  };
}

function decodeUtf8ByteString(value: string): string {
  return Buffer.from(String(value || ""), "base64").toString("utf8");
}

function decodeHash160ByteString(value: string): string {
  const rawHex = Buffer.from(String(value || ""), "base64").toString("hex");
  return `0x${u.reverseHex(rawHex)}`;
}

function parseAgentDetailsMap(stackItem: StackItem): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (!stackItem || stackItem.type !== "Map" || !Array.isArray(stackItem.value)) return out;

  for (const entry of stackItem.value as MapEntry[]) {
    const keyItem = entry?.key;
    const valueItem = entry?.value;
    if (!keyItem || !valueItem) continue;
    const key = keyItem.type === "ByteString" ? decodeUtf8ByteString(String(keyItem.value ?? "")) : String(keyItem.value || "");
    if (!key) continue;

    if (valueItem.type === "Boolean") {
      out[key] = Boolean(valueItem.value);
    } else if (valueItem.type === "Integer") {
      out[key] = String(valueItem.value || "0");
    } else if (valueItem.type === "ByteString") {
      if (key === "account") {
        out[key] = decodeHash160ByteString(String(valueItem.value ?? ""));
      } else {
        out[key] = decodeUtf8ByteString(String(valueItem.value ?? ""));
      }
    } else {
      out[key] = valueItem.value;
    }
  }

  return out;
}

async function waitForTransaction(rpcClient: InstanceType<typeof RpcClient>, txid: string, maxAttempts = 60) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const log = await rpcClient.getApplicationLog({ hash: txid });
      if (log?.executions?.length) {
        const execution = log.executions[0];
        if (execution.vmstate === "HALT") return execution;
        throw new Error(execution.exception || "transaction fault");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes("Unknown transaction")) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  throw new Error("Timed out waiting for sponsored agent return transaction");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (standardLimit(req, res)) return;

  if (String(req.method || "").toUpperCase() !== "POST") {
    return apiError.methodNotAllowed(res);
  }

  const actor = await requireMiniAppAdmin(req, res);
  if (!actor) return;

  if (!ADMIN_WIF || !SPONSORED_WIF) {
    return apiError.configError(res, "TRUSTANCHOR_ADMIN_WIF and SPONSORED_WIF are required");
  }

  const body = (req.body || {}) as AgentReturnBody;
  const agentId = parsePositiveInteger(body.agentId);
  const amount = parsePositiveInteger(body.amount);

  if (!agentId || agentId < 1 || agentId > MAX_AGENT_ID) {
    return apiError.badRequest(res, "agentId must be an integer between 1 and 21");
  }
  if (!amount) {
    return apiError.badRequest(res, "amount must be a positive integer amount of NEO");
  }

  try {
    const adminAccount = new wallet.Account(ADMIN_WIF);
    const sponsorAccount = new wallet.Account(SPONSORED_WIF);
    const rpcClient = new RpcClient(RPC_URL);

    const agentAccount = buildAgentAccount(adminAccount, agentId);

    const agentDetails = (await rpcClient.send("invokefunction", [
      TRUSTANCHOR_HASH,
      "getAgentDetails",
      [{ type: "Integer", value: String(agentId) }],
    ])) as InvokeResultLike;
    if (agentDetails.state !== "HALT") {
      return apiError.gatewayError(res, "failed to read trustanchor agent details");
    }
    const stackEntry = agentDetails.stack?.[0];
    if (!stackEntry) {
      return apiError.gatewayError(res, "trustanchor agent details stack is empty");
    }
    const parsedAgent = parseAgentDetailsMap(stackEntry);
    if (String(parsedAgent.account || "").toLowerCase() !== agentAccount.scriptHash.toLowerCase()) {
      return apiError.badRequest(res, "derived agent account does not match on-chain configuration");
    }
    if (parsedAgent.active !== true) {
      return apiError.badRequest(res, "agent is not active");
    }

    const transferPreview = (await rpcClient.send("invokefunction", [
      NEO_TOKEN_HASH,
      "transfer",
      [
        { type: "Hash160", value: agentAccount.scriptHash },
        { type: "Hash160", value: TRUSTANCHOR_HASH },
        { type: "Integer", value: String(amount) },
        { type: "Any", value: null },
      ],
      [
        { account: agentAccount.scriptHash.replace(/^0x/, ""), scopes: "CalledByEntry" },
        { account: sponsorAccount.scriptHash, scopes: "None" },
      ],
    ])) as InvokeResultLike;

    if (transferPreview.state !== "HALT") {
      return apiError.badRequest(res, transferPreview.exception || "trustanchor agent return preview failed");
    }
    if (!transferPreview.script) {
      return apiError.badRequest(res, "trustanchor agent return preview did not return a script");
    }

    const currentHeight = await rpcClient.getBlockCount();
    const transaction = new tx.Transaction({
      signers: [
        { account: agentAccount.scriptHash.replace(/^0x/, ""), scopes: tx.WitnessScope.CalledByEntry },
        { account: sponsorAccount.scriptHash, scopes: tx.WitnessScope.None },
      ],
      validUntilBlock: currentHeight + 200,
      script: Buffer.from(String(transferPreview.script), "base64").toString("hex"),
    });

    transaction.systemFee = BigInt(Math.ceil(Number(transferPreview.gasconsumed || 0) * 1.5));
    transaction.networkFee = 5000000n;

    const unsignedTx = deserialize(hexToBytes(transaction.serialize(false)), CoreTx);
    const agentWitness = new PrivateKey(adminAccount.privateKey).signWitness(unsignedTx.getSignData(NETWORK_MAGIC));
    transaction.witnesses.push(
      new tx.Witness({
        invocationScript: bytesToHex(agentWitness.invocationScript),
        verificationScript: agentAccount.verificationScript,
      }),
    );

    transaction.sign(SPONSORED_WIF, NETWORK_MAGIC);

    const result = await rpcClient.sendRawTransaction({ tx: transaction.serialize(true) });
    const txid = typeof result === "string" ? result : String(result.hash || "");
    if (!txid) {
      throw new Error("trustanchor agent return relay did not return a transaction hash");
    }
    await waitForTransaction(rpcClient, txid);

    return res.status(200).json({
      success: true,
      txid,
      trustanchorHash: TRUSTANCHOR_HASH,
      agentId,
      agentAddress: agentAccount.address,
      agentScriptHash: agentAccount.scriptHash,
      amount,
      actor,
    });
  } catch (error) {
    logger.error("trustanchor agent-return failed:", error instanceof Error ? error.message : "unknown error");
    return apiError.internal(res, error instanceof Error ? error.message : "trustanchor agent return failed");
  }
}
