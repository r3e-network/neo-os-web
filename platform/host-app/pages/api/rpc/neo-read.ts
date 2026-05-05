import type { NextApiRequest, NextApiResponse } from "next";
import { isNeoNetwork } from "@/lib/neo-network";

const MAINNET_RPC_URL =
  process.env.NEO_MAINNET_RPC_URL || "https://api.n3index.dev/mainnet";
const TESTNET_RPC_URL =
  process.env.NEO_TESTNET_RPC_URL ||
  process.env.NEO_RPC_URL ||
  "https://api.n3index.dev/testnet";

function setSuccessCache(res: NextApiResponse) {
  res.setHeader(
    "Cache-Control",
    "public, s-maxage=10, stale-while-revalidate=30",
  );
}

function setFailureCache(res: NextApiResponse) {
  res.setHeader(
    "Cache-Control",
    "public, s-maxage=5, stale-while-revalidate=10",
  );
}

function readFault(message: string) {
  return {
    jsonrpc: "2.0",
    id: 1,
    result: {
      state: "FAULT",
      gasconsumed: "0",
      exception: message,
      stack: [],
    },
  };
}

/**
 * Proxy for read-only Neo N3 RPC calls (invokefunction).
 * Avoids CORS issues when the browser calls the Neo RPC directly.
 *
 * The "network" field selects mainnet vs testnet. It must be explicit so
 * read state cannot silently fall through to the wrong environment.
 */
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const { contractHash, method, params, network } = req.body;
    if (!contractHash || !method) {
      res.status(400).json({ error: "contractHash and method required" });
      return;
    }
    if (!isNeoNetwork(network)) {
      res.status(400).json({ error: "network must be explicitly set to mainnet or testnet" });
      return;
    }

    const rpcUrl = network === "testnet" ? TESTNET_RPC_URL : MAINNET_RPC_URL;

    const rpcBody = {
      jsonrpc: "2.0",
      id: 1,
      method: "invokefunction",
      params: [contractHash, method, Array.isArray(params) ? params : []],
    };

    const resp = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rpcBody),
      signal: AbortSignal.timeout(10000),
    });

    if (!resp.ok) {
      setFailureCache(res);
      res.status(200).json(readFault(`RPC gateway returned ${resp.status}`));
      return;
    }

    let data: unknown;
    try {
      data = await resp.json();
    } catch {
      setFailureCache(res);
      res.status(200).json(readFault("RPC gateway returned invalid JSON"));
      return;
    }

    setSuccessCache(res);
    res.status(200).json(data);
    return;
  } catch (e) {
    setFailureCache(res);
    res.status(200).json(readFault("RPC request failed"));
    return;
  }
}
