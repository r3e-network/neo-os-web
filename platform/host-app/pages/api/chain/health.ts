import { apiError } from "@/lib/api-response";
import type { NextApiRequest, NextApiResponse } from "next";
import { logger } from "@/lib/logger";
import { normalizeNeoNetwork } from "@/lib/neo-network";
import { standardLimit } from "@/lib/rate-limit";

const DEFAULT_NEO_RPC_URLS = {
  mainnet: [
    "https://api.n3index.dev/mainnet",
    "https://mainnet2.neo.coz.io:443",
    "https://mainnet1.neo.coz.io:443",
  ],
  testnet: [
    "https://api.n3index.dev/testnet",
    "https://testnet1.neo.coz.io:443",
  ],
} as const;

function parseRPCURLs(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((entry) => entry.trim().replace(/\/$/, ""))
    .filter(Boolean);
}

function getNeoRPCURLs(network: "testnet" | "mainnet"): string[] {
  const configured =
    network === "mainnet"
      ? parseRPCURLs(process.env.NEO_RPC_MAINNET)
      : parseRPCURLs(process.env.NEO_RPC_TESTNET || process.env.NEO_RPC_URL);
  return [...new Set([...configured, ...DEFAULT_NEO_RPC_URLS[network]])];
}

interface ChainHealth {
  network: "testnet" | "mainnet";
  lastBlockTime: number;
  blockHeight: number;
  pendingTxCount: number;
  status: "healthy" | "warning" | "critical";
  rpcUrl?: string;
  error?: string;
}

function redactRpcUrl(value: string): string {
  try {
    const url = new URL(value);
    return `${url.protocol}//${url.hostname}`;
  } catch {
    return "<invalid-rpc-url>";
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      const timer = setTimeout(() => {
        clearTimeout(timer);
        reject(new Error(`timeout after ${timeoutMs}ms`));
      }, timeoutMs);
    }),
  ]);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }

  if (standardLimit(req, res)) return;

  const network = normalizeNeoNetwork(req.query.network);
  if (!network) {
    return apiError.badRequest(res, "network must be mainnet or testnet");
  }
  const rpcUrls = getNeoRPCURLs(network);

  const failures: string[] = [];
  const normalizedNetwork = network;
  const perRequestTimeoutMs = normalizedNetwork === "mainnet" ? 3500 : 3000;
  const overallTimeoutMs = normalizedNetwork === "mainnet" ? 12000 : 8000;

  const probes = rpcUrls.map((rpcUrl) =>
    checkChainHealth(rpcUrl, normalizedNetwork, perRequestTimeoutMs).catch(
      (err: unknown) => {
        const message = err instanceof Error ? err.message : "unknown error";
        failures.push(`${redactRpcUrl(rpcUrl)}: ${message}`);
        throw err;
      },
    ),
  );

  try {
    const health = await withTimeout(Promise.any(probes), overallTimeoutMs);
    res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=60");
    res.status(200).json(health);
    return;
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    logger.warn("Chain health RPC failed:", message);
  }

  logger.error("Chain health check failed for all RPC endpoints");
  res.setHeader("Cache-Control", "no-store");
  res.status(200).json({
    network,
    lastBlockTime: 0,
    blockHeight: 0,
    pendingTxCount: 0,
    status: "critical",
    error: "All configured Neo RPC endpoints failed",
  } satisfies ChainHealth);
  return;
}

async function checkChainHealth(
  rpcUrl: string,
  network: "testnet" | "mainnet",
  rpcTimeoutMs: number,
): Promise<ChainHealth> {
  const blockRes = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "getblockcount",
      params: [],
      id: 1,
    }),
    signal: AbortSignal.timeout(rpcTimeoutMs),
  });
  if (!blockRes.ok) {
    throw new Error(`RPC error: ${blockRes.status}`);
  }
  const blockData = await blockRes.json();
  if (blockData.error) {
    throw new Error(`RPC error: ${blockData.error.message || blockData.error.code}`);
  }
  const blockHeight = blockData.result || 0;

  const headerRes = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "getblockheader",
      params: [blockHeight - 1, true],
      id: 2,
    }),
    signal: AbortSignal.timeout(rpcTimeoutMs),
  });
  if (!headerRes.ok) {
    throw new Error(`RPC error: ${headerRes.status}`);
  }
  const headerData = await headerRes.json();
  if (headerData.error) {
    throw new Error(`RPC error: ${headerData.error.message || headerData.error.code}`);
  }
  const rawBlockTime = Number(headerData.result?.time || 0);
  const lastBlockTime = rawBlockTime > 10_000_000_000 ? Math.floor(rawBlockTime / 1000) : rawBlockTime;

  const now = Math.floor(Date.now() / 1000);
  const timeSinceBlock = now - lastBlockTime;

  let status: "healthy" | "warning" | "critical" = "healthy";
  if (timeSinceBlock > 120) status = "critical";
  else if (timeSinceBlock > 60) status = "warning";

  return {
    network,
    lastBlockTime,
    blockHeight,
    pendingTxCount: 0,
    status,
    rpcUrl: redactRpcUrl(rpcUrl),
  };
}
