import type { NextApiRequest, NextApiResponse } from "next";

const NEO_RPC_URL = process.env.NEO_RPC_URL || "https://mainnet1.neo.coz.io:443";

/**
 * Proxy for read-only Neo N3 RPC calls (invokefunction).
 * Avoids CORS issues when the browser calls the Neo RPC directly.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { contractHash, method, params } = req.body;
    if (!contractHash || !method) {
      return res.status(400).json({ error: "contractHash and method required" });
    }

    const rpcBody = {
      jsonrpc: "2.0",
      id: 1,
      method: "invokefunction",
      params: [contractHash, method, Array.isArray(params) ? params : []],
    };

    const resp = await fetch(NEO_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(rpcBody),
      signal: AbortSignal.timeout(10000),
    });

    const data = await resp.json();

    res.setHeader("Cache-Control", "public, s-maxage=10, stale-while-revalidate=30");
    return res.status(200).json(data);
  } catch (e) {
    return res.status(502).json({ error: "RPC request failed" });
  }
}
