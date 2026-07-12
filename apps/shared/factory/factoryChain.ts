/**
 * Direct read-only JSON-RPC client for the MiniAppFactory registry.
 *
 * The factory engine needs three chain facts the wallet bridge cannot
 * provide today:
 *
 * 1. Whether a template's NEF/manifest artifact is actually registered
 *    on-chain (getTemplate → HasArtifact) — the execute step is honest
 *    only when this is verified live, never assumed from a local registry.
 * 2. A GAS fee estimate for the deployment call. `invokefunction` only
 *    yields a meaningful `gasconsumed` when the creator witness passes,
 *    which requires a signers entry — the NEP-21 `call` bridge strips
 *    signers, so the estimate goes straight to the public RPC endpoint
 *    (same precedent as useMorpheusDataFeed's rpcCall).
 * 3. The deployments / miniapp registry pages (deploymentCount,
 *    getDeploymentIdByIndex, getDeployment and the miniapp equivalents)
 *    for the "my creations" view.
 *
 * Everything in this module is read-only (`invokefunction` test
 * invocations); no transaction is ever broadcast from here.
 */
import { getRpcUrl, resolveNeoNetwork } from "@shared/constants/rpc";
import {
  fetchWithTimeout,
  HttpResponseError,
  isTransientFetchError,
} from "@shared/utils/fetch-timeout";
import { retryAsync } from "@shared/utils/async-utils";
import { addressToScriptHash, parseStackItem } from "@shared/utils/neo";
import type { FactoryContractArg, FactoryKind, FactoryNetwork } from "./factoryPlan";

const RPC_TIMEOUT_MS = 10_000;
/** Bounded retry for transient factory-registry read blips. */
const RPC_RETRY_ATTEMPTS = 3;
const RPC_RETRY_BASE_DELAY_MS = 300;
const RPC_RETRY_MAX_DELAY_MS = 1500;
const ZERO_HASH = /^0x0{40}$/;

export type TemplateArtifactPresence = "present" | "missing" | "not-registered" | "unknown";

export interface FactoryDeploymentItem {
  packageId: string;
  templateId: string;
  digest: string;
  creator: string;
  /** Deployed contract hash; "" for record-only deployments and miniapp records. */
  deployedHash: string;
  /** Milliseconds since epoch (Runtime.Time); 0 when unavailable. */
  createdAt: number;
}

export type FactoryRecordReadResult =
  | { status: "found"; record: FactoryDeploymentItem }
  | { status: "not-found" }
  | { status: "unavailable"; error: string };

interface RpcInvokeResult {
  state?: string;
  gasconsumed?: string;
  exception?: string | null;
  stack?: unknown[];
}

interface RpcSigner {
  account: string;
  scopes: string;
}

async function rpcInvokeFunction(
  network: FactoryNetwork,
  scriptHash: string,
  operation: string,
  args: FactoryContractArg[],
  signers?: RpcSigner[],
): Promise<RpcInvokeResult> {
  const rpcUrl = getRpcUrl(resolveNeoNetwork(network));
  const params: unknown[] = [scriptHash, operation, args];
  if (signers?.length) params.push(signers);

  // Read-only `invokefunction` test-invocation — idempotent, so a transient RPC
  // node blip (timeout, network drop, 429/5xx) retries with bounded backoff
  // before surfacing to the callers (which already degrade to "unknown"/null).
  // A JSON-RPC-level error is deterministic and rethrown without retry.
  return retryAsync<RpcInvokeResult>(
    async () => {
      const response = await fetchWithTimeout(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "invokefunction", params }),
        timeoutMs: RPC_TIMEOUT_MS,
      });
      if (!response.ok) {
        throw new HttpResponseError(
          `invokefunction failed: rpc HTTP ${response.status}`,
          response.status,
        );
      }
      const payload = (await response.json()) as {
        result?: RpcInvokeResult;
        error?: { message?: string };
      };
      if (payload.error) {
        throw new Error(payload.error.message || "invokefunction failed");
      }
      if (!payload.result) {
        throw new Error("invokefunction returned an empty result");
      }
      return payload.result;
    },
    {
      maxAttempts: RPC_RETRY_ATTEMPTS,
      baseDelayMs: RPC_RETRY_BASE_DELAY_MS,
      maxDelayMs: RPC_RETRY_MAX_DELAY_MS,
      shouldRetry: isTransientFetchError,
    },
  );
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

function asEpochMs(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/**
 * Live HasArtifact check for a registered template.
 *
 * - "present"        → registerTemplateArtifact has run; deployFromTemplate
 *                      performs a real ContractManagement.Deploy.
 * - "missing"        → template metadata exists but no artifact; a deploy
 *                      call would only store a DeploymentRecord.
 * - "not-registered" → the template id is unknown to the factory contract.
 * - "unknown"        → the chain could not be read (network/RPC failure).
 */
export async function fetchTemplateArtifactPresence(
  network: FactoryNetwork,
  scriptHash: string,
  templateId: string,
): Promise<TemplateArtifactPresence> {
  if (!scriptHash || !templateId) return "unknown";
  try {
    const result = await rpcInvokeFunction(network, scriptHash, "getTemplate", [
      { type: "String", value: templateId },
    ]);
    if (result.state === "HALT" && Array.isArray(result.stack) && result.stack.length > 0) {
      const record = parseStackItem(result.stack[0]);
      if (Array.isArray(record) && record.length >= 7) {
        // TemplateRecord: [TemplateId, Standard, Version, NefHash,
        //                  ManifestHash, ConfigSchemaHash, HasArtifact, CreatedAt]
        return record[6] === true ? "present" : "missing";
      }
      return "unknown";
    }
    if (result.state === "FAULT" && (result.exception || "").includes("template not found")) {
      return "not-registered";
    }
    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Test-invoke the deployment call with the creator as a CalledByEntry signer
 * and return the consumed GAS as a display string ("" when no honest estimate
 * is possible). `gasconsumed` is reported in datoshi (1e-8 GAS).
 */
export async function estimateFactoryFeeGas(
  network: FactoryNetwork,
  call: { scriptHash: string; operation: string; args: FactoryContractArg[] },
  signerAccount: string,
): Promise<string> {
  const account = signerAccount.startsWith("0x")
    ? signerAccount
    : addressToScriptHash(signerAccount);
  if (!account || !call.scriptHash) return "";
  try {
    const result = await rpcInvokeFunction(network, call.scriptHash, call.operation, call.args, [
      { account, scopes: "CalledByEntry" },
    ]);
    if (result.state !== "HALT") return "";
    const datoshi = Number(result.gasconsumed ?? 0);
    if (!Number.isFinite(datoshi) || datoshi <= 0) return "";
    const gas = datoshi / 1e8;
    // 4 decimals covers record-only costs (~0.007 GAS) without noise; real
    // contract deployments land in whole-GAS territory and stay readable.
    return gas.toFixed(4).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  } catch {
    return "";
  }
}

function parseRecord(kind: FactoryKind, packageId: string, raw: unknown): FactoryDeploymentItem | null {
  const fields = parseStackItem(raw);
  if (!Array.isArray(fields)) return null;
  if (kind === "miniapp") {
    // MiniAppRecord: [TemplateId, PackageId, Digest, InitParams, Creator, CreatedAt]
    if (fields.length < 6) return null;
    return {
      packageId: asString(fields[1]) || packageId,
      templateId: asString(fields[0]),
      digest: asString(fields[2]),
      creator: asString(fields[4]),
      deployedHash: "",
      createdAt: asEpochMs(fields[5]),
    };
  }
  // DeploymentRecord: [TemplateId, PackageId, Digest, InitParams, Creator, DeployedHash, CreatedAt]
  if (fields.length < 7) return null;
  const deployedHash = asString(fields[5]);
  return {
    packageId: asString(fields[1]) || packageId,
    templateId: asString(fields[0]),
    digest: asString(fields[2]),
    creator: asString(fields[4]),
    deployedHash: ZERO_HASH.test(deployedHash) ? "" : deployedHash,
    createdAt: asEpochMs(fields[6]),
  };
}

async function readHaltValue(
  network: FactoryNetwork,
  scriptHash: string,
  operation: string,
  args: FactoryContractArg[],
): Promise<unknown> {
  const result = await rpcInvokeFunction(network, scriptHash, operation, args);
  if (result.state !== "HALT" || !Array.isArray(result.stack) || result.stack.length === 0) {
    throw new Error(result.exception || `${operation} did not HALT`);
  }
  return result.stack[0];
}

/**
 * Read back one deployment / miniapp record while preserving the difference
 * between an absent package and an RPC/ABI failure. Product recovery surfaces
 * need that distinction so a transient read outage is never presented as
 * authoritative proof that no record exists.
 */
export async function inspectFactoryRecord(
  network: FactoryNetwork,
  scriptHash: string,
  kind: FactoryKind,
  packageId: string,
): Promise<FactoryRecordReadResult> {
  if (!scriptHash || !packageId) return { status: "not-found" };
  const operation = kind === "miniapp" ? "getMiniApp" : "getDeployment";
  try {
    const raw = await readHaltValue(network, scriptHash, operation, [
      { type: "String", value: packageId },
    ]);
    const record = parseRecord(kind, packageId, raw);
    return record
      ? { status: "found", record }
      : {
          status: "unavailable",
          error: `${operation} returned an invalid record`,
        };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error ?? "");
    if (/deployment not found|miniapp not found/i.test(message)) {
      return { status: "not-found" };
    }
    return {
      status: "unavailable",
      error: message || `${operation} could not be read`,
    };
  }
}

/** Backwards-compatible nullable record read for existing factory consumers. */
export async function readFactoryRecord(
  network: FactoryNetwork,
  scriptHash: string,
  kind: FactoryKind,
  packageId: string,
): Promise<FactoryDeploymentItem | null> {
  const result = await inspectFactoryRecord(
    network,
    scriptHash,
    kind,
    packageId,
  );
  return result.status === "found" ? result.record : null;
}

/**
 * Page the factory registry newest-first. The factory keeps an append-only
 * index, so the most recent records sit at the highest indices.
 */
export async function fetchFactoryDeployments(
  network: FactoryNetwork,
  scriptHash: string,
  kind: FactoryKind,
  limit = 8,
): Promise<{ total: number; items: FactoryDeploymentItem[] }> {
  if (!scriptHash) return { total: 0, items: [] };
  const countOp = kind === "miniapp" ? "miniAppCount" : "deploymentCount";
  const idOp = kind === "miniapp" ? "getMiniAppIdByIndex" : "getDeploymentIdByIndex";
  const recordOp = kind === "miniapp" ? "getMiniApp" : "getDeployment";

  const countRaw = parseStackItem(await readHaltValue(network, scriptHash, countOp, []));
  const total = Number(countRaw ?? 0);
  if (!Number.isFinite(total) || total <= 0) return { total: 0, items: [] };

  const first = Math.max(0, total - limit);
  const indices: number[] = [];
  for (let index = total - 1; index >= first; index -= 1) indices.push(index);

  const items = await Promise.all(
    indices.map(async (index) => {
      try {
        const idRaw = parseStackItem(
          await readHaltValue(network, scriptHash, idOp, [
            { type: "Integer", value: String(index) },
          ]),
        );
        const packageId = asString(idRaw);
        if (!packageId) return null;
        const raw = await readHaltValue(network, scriptHash, recordOp, [
          { type: "String", value: packageId },
        ]);
        return parseRecord(kind, packageId, raw);
      } catch {
        return null;
      }
    }),
  );

  return {
    total,
    items: items.filter((item): item is FactoryDeploymentItem => item !== null),
  };
}
