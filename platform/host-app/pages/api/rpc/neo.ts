import type { NextApiRequest, NextApiResponse } from "next";
import { standardLimit } from "@/lib/rate-limit";
import { logger } from "@/lib/logger";
import { isNeoNetwork, type NeoNetwork } from "@/lib/neo-network";

type NeoRpcRequestBody = {
  network?: NeoNetwork;
  method?: string;
  params?: unknown[];
};

const MAINNET_RPC_URL =
  process.env.NEO_MAINNET_RPC_URL ||
  process.env.NEO_RPC_MAINNET ||
  process.env.NEXT_PUBLIC_NEO_RPC_MAINNET ||
  "https://api.n3index.dev/mainnet";

const TESTNET_RPC_URL =
  process.env.NEO_TESTNET_RPC_URL ||
  process.env.NEO_RPC_TESTNET ||
  process.env.NEO_RPC_URL ||
  process.env.NEXT_PUBLIC_NEO_RPC_TESTNET ||
  "https://api.n3index.dev/testnet";

const ALLOWED_METHODS = new Set([
  "getblockcount",
  "getversion",
  "invokefunction",
  "calculatenetworkfee",
  "sendrawtransaction",
]);

const MAX_BODY_SIZE = 128 * 1024;
const FETCH_TIMEOUT_MS = 30_000;

function resolveRpcUrl(network: NeoNetwork): string {
  return network === "testnet" ? TESTNET_RPC_URL : MAINNET_RPC_URL;
}

function payloadSize(body: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(body ?? {}), "utf8");
  } catch {
    return MAX_BODY_SIZE + 1;
  }
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (standardLimit(req, res)) return;

  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (payloadSize(req.body) > MAX_BODY_SIZE) {
    res.status(413).json({ error: "RPC payload too large" });
    return;
  }

  const body = req.body as NeoRpcRequestBody;
  const method = String(body?.method || "").trim().toLowerCase();
  if (!ALLOWED_METHODS.has(method)) {
    res.status(400).json({ error: "RPC method not allowed" });
    return;
  }

  if (!isNeoNetwork(body.network)) {
    res.status(400).json({ error: "network must be explicitly set to mainnet or testnet" });
    return;
  }
  const network = body.network;
  const params = Array.isArray(body.params) ? body.params : [];
  const rpcUrl = resolveRpcUrl(network);

  try {
    const upstream = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method,
        params,
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });

    const text = await upstream.text();
    res.setHeader("Cache-Control", "no-store, private");
    res.setHeader("Content-Type", upstream.headers.get("content-type") || "application/json");

    if (!upstream.ok) {
      res.status(502).send(text || JSON.stringify({ error: "Neo RPC upstream failed" }));
      return;
    }

    res.status(200).send(text);
  } catch (error) {
    logger.error(
      "[neo-rpc] request failed:",
      error instanceof Error ? error.message : String(error),
    );
    res.status(502).json({ error: "Neo RPC request failed" });
  }
}
