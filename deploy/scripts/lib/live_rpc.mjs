/**
 * Shared RPC plumbing for the single-contract live validators (MP-W3-09).
 *
 * Consolidates the invoke → fee → sign → broadcast → confirm loop, the
 * FAULT-checked read invokes, signer-scoped guard probes, transient-error
 * retry, and RPC endpoint failover that live_validate_{redenvelope,
 * timecapsule,tarot,breakuppact,lastsurvivor,coinflip}.mjs previously each
 * copy-pasted.
 *
 * Endpoint + network-magic resolution goes through lib/neo_network.js
 * getNetworkConfig, so the existing NEO_RPC_TESTNET / NEO_RPC_URL /
 * NEO_TESTNET_MAGIC env overrides keep working. A comma-separated
 * NEO_RPC_ENDPOINTS list additionally enables automatic failover across
 * multiple nodes.
 *
 * Nothing in this module touches the network at import time — clients are
 * created lazily and every collaborator (neon namespace, client factory,
 * sleep, logger) is injectable so the test gate runs fully offline.
 */

import neonDefault from "@cityofzion/neon-js";
import { getNetworkConfig } from "./neo_network.js";

const TRANSIENT_RPC_ERROR_PATTERN =
  /operation was aborted|aborted|timed out|timeout|fetch failed|econnreset|etimedout|eai_again|enotfound|socket hang up|getaddrinfo|502|503|504/i;

export function isTransientRpcError(error) {
  return TRANSIENT_RPC_ERROR_PATTERN.test(String(error?.message || error || ""));
}

function defaultSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveEndpoints({ rpcUrls, env, network }) {
  if (Array.isArray(rpcUrls) && rpcUrls.length > 0) {
    return rpcUrls.map((url) => String(url).trim()).filter(Boolean);
  }
  if (typeof rpcUrls === "string" && rpcUrls.trim()) {
    return rpcUrls.split(",").map((url) => url.trim()).filter(Boolean);
  }
  const fromEnv = String(env.NEO_RPC_ENDPOINTS || "").trim();
  if (fromEnv) {
    return fromEnv.split(",").map((url) => url.trim()).filter(Boolean);
  }
  return [getNetworkConfig(network).rpcUrl];
}

function wrapError(stepLabel, error) {
  const message = error instanceof Error ? error.message : String(error);
  const wrapped = new Error(`${stepLabel}: ${message}`);
  if (error instanceof Error && error.stack) {
    wrapped.stack = `${wrapped.name}: ${wrapped.message}\nCaused by: ${error.stack}`;
  }
  return wrapped;
}

/**
 * @param {object} [options]
 * @param {string} [options.network="testnet"]      lib/neo_network.js network name
 * @param {object} [options.env=process.env]
 * @param {object} [options.neon]                   neon-js namespace (injectable)
 * @param {string} [options.label="live_rpc"]       log prefix
 * @param {string|string[]} [options.rpcUrls]       endpoint(s); defaults to
 *                 NEO_RPC_ENDPOINTS env or getNetworkConfig(network).rpcUrl
 * @param {number} [options.networkMagic]           defaults from getNetworkConfig
 * @param {(url: string) => object} [options.createClient]
 * @param {number} [options.retryAttempts=6]
 * @param {number} [options.retryDelayMs=3000]
 * @param {number} [options.confirmPollMs=4000]
 * @param {number} [options.confirmTimeoutMs=180000]
 * @param {(ms: number) => Promise<void>} [options.sleep]
 * @param {object} [options.logger=console]
 */
export function createLiveRpc(options = {}) {
  const {
    network = "testnet",
    env = process.env,
    neon = neonDefault,
    label = "live_rpc",
    rpcUrls,
    networkMagic = getNetworkConfig(network).networkMagic,
    createClient = (url) => new neon.rpc.RPCClient(url),
    retryAttempts = 6,
    retryDelayMs = 3000,
    confirmPollMs = 4000,
    confirmTimeoutMs = 180000,
    sleep = defaultSleep,
    logger = console,
  } = options;

  const endpoints = resolveEndpoints({ rpcUrls, env, network });
  if (endpoints.length === 0) {
    throw new Error(`${label}: no RPC endpoints configured`);
  }
  let endpointIndex = 0;
  let client = createClient(endpoints[endpointIndex]);

  function rotateEndpoint(reason) {
    if (endpoints.length <= 1) return;
    const failed = endpoints[endpointIndex];
    endpointIndex = (endpointIndex + 1) % endpoints.length;
    client = createClient(endpoints[endpointIndex]);
    logger.warn(`[${label}] rpc-failover ${failed} → ${endpoints[endpointIndex]} (${reason})`);
  }

  // Retries every error (matching the proven validator behavior — testnet
  // nodes intermittently drop connections); rotates the endpoint only on
  // transient network errors so a deterministic FAULT never burns endpoints.
  async function retry(fn, stepLabel = "rpc") {
    let lastError;
    for (let attempt = 1; attempt <= retryAttempts; attempt += 1) {
      try {
        return await fn(client);
      } catch (error) {
        lastError = error;
        if (attempt >= retryAttempts) break;
        if (isTransientRpcError(error)) {
          rotateEndpoint(`${stepLabel}: ${String(error?.message || error).slice(0, 80)}`);
        }
        await sleep(retryDelayMs);
      }
    }
    throw wrapError(stepLabel, lastError);
  }

  async function readInvoke(contractHash, method, params = [], { signers } = {}) {
    return retry((c) => c.invokeFunction(contractHash, method, params, signers), `read.${method}`);
  }

  /** invokeFunction that throws on FAULT and returns the result stack. */
  async function readStack(contractHash, method, params = []) {
    const result = await readInvoke(contractHash, method, params);
    if (result.state !== "HALT") {
      throw new Error(`${method} FAULT: ${result.exception}`);
    }
    return result.stack;
  }

  /** Read-only test-invoke WITH a signer (so CheckWitness passes) to probe guards. */
  async function testInvoke(account, scriptHash, operation, args = []) {
    const script = neon.sc.createScript({ scriptHash, operation, args });
    const signers = [
      neon.tx.Signer.fromJson({ account: `0x${account.scriptHash}`, scopes: "CalledByEntry" }),
    ];
    return retry(
      (c) => c.invokeScript(neon.u.HexString.fromHex(script), signers),
      `testInvoke.${operation}`
    );
  }

  async function nep17BalanceOf(assetHash, accountHash) {
    const result = await readInvoke(assetHash, "balanceOf", [
      { type: "Hash160", value: accountHash },
    ]);
    return BigInt(result.stack?.[0]?.value ?? "0");
  }

  /**
   * Full write path: build script → test-invoke (FAULT check) → system fee →
   * provisional sign (fee-accurate size) → calculateNetworkFee → final sign →
   * broadcast → poll the application log until HALT.
   *
   * @returns {Promise<{txid: string, log: object, execution: object}>}
   */
  async function invokeAndConfirm({
    label: stepLabel,
    account,
    scriptHash,
    operation,
    args = [],
    signers,
    validUntilOffset = 50,
    timeoutMs = confirmTimeoutMs,
  }) {
    const step = stepLabel || operation;
    if (!account) throw new Error(`${step}: account is required`);

    const script = neon.sc.createScript({ scriptHash, operation, args });
    const height = await retry((c) => c.getBlockCount(), `${step}.getBlockCount`);
    const txSigners =
      Array.isArray(signers) && signers.length > 0
        ? signers
        : [neon.tx.Signer.fromJson({ account: `0x${account.scriptHash}`, scopes: "CalledByEntry" })];
    const txn = new neon.tx.Transaction({
      signers: txSigners,
      validUntilBlock: height + validUntilOffset,
      script,
    });

    const preview = await retry(
      (c) => c.invokeScript(neon.u.HexString.fromHex(script), txSigners),
      `${step}.invokeScript`
    );
    if (preview.state !== "HALT") {
      throw new Error(`${step} test-invoke FAULT: ${preview.exception}`);
    }
    txn.systemFee = neon.u.BigInteger.fromNumber(preview.gasconsumed);
    txn.sign(account, networkMagic); // provisional witness so the size is right for fee calc
    txn.networkFee = neon.u.BigInteger.fromNumber(
      await retry((c) => c.calculateNetworkFee(txn), `${step}.calculateNetworkFee`)
    );
    txn.sign(account, networkMagic); // final signature over the real fees

    const txid = await retry((c) => c.sendRawTransaction(txn), `${step}.sendRawTransaction`);

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      await sleep(confirmPollMs);
      let log;
      try {
        log = await client.getApplicationLog(txid);
      } catch (error) {
        if (isTransientRpcError(error)) {
          rotateEndpoint(`${step}.getApplicationLog: ${String(error?.message || error).slice(0, 80)}`);
        }
        continue; // not yet indexed (or node hiccup) — keep polling
      }
      const execution = log?.executions?.[0];
      if (!execution) continue;
      if (execution.vmstate === "HALT") {
        logger.log(`  ${step} ✓ (${String(txid).slice(0, 12)}…)`);
        return { txid, log, execution };
      }
      throw new Error(`${step} FAULT: ${JSON.stringify(execution.exception)}`);
    }
    throw new Error(`${step} not confirmed within ${timeoutMs}ms`);
  }

  return {
    get client() {
      return client;
    },
    get rpcUrl() {
      return endpoints[endpointIndex];
    },
    endpoints: [...endpoints],
    networkMagic,
    retry,
    readInvoke,
    readStack,
    testInvoke,
    nep17BalanceOf,
    invokeAndConfirm,
  };
}
