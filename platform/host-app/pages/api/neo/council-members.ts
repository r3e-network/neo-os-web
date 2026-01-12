/**
 * API: Neo council member check
 * GET /api/neo/council-members?network=testnet|mainnet&address=...
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { wallet } from "@cityofzion/neon-js";
import { rpcCall, type Network } from "../../../lib/chain/rpc-client";

type CommitteeResponse = string[] | { committee?: string[] } | Array<{ publicKey?: string; publickey?: string }>;

function normalizeNetwork(value: string | undefined): Network {
  return value === "mainnet" ? "mainnet" : "testnet";
}

function normalizePublicKey(raw: string): string {
  const trimmed = raw.trim();
  return trimmed.startsWith("0x") ? trimmed.slice(2) : trimmed;
}

function extractPublicKeys(result: CommitteeResponse): string[] {
  if (Array.isArray(result)) {
    if (result.length === 0) return [];
    if (typeof result[0] === "string") {
      return result as string[];
    }
    return (result as Array<{ publicKey?: string; publickey?: string }>)
      .map((entry) => entry.publicKey || entry.publickey || "")
      .filter(Boolean);
  }
  if (result && typeof result === "object" && Array.isArray(result.committee)) {
    return result.committee;
  }
  return [];
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const address = String(req.query.address || "").trim();
  if (!address) {
    return res.status(400).json({ error: "address is required" });
  }
  if (!wallet.isAddress(address)) {
    return res.status(400).json({ error: "invalid address" });
  }

  const network = normalizeNetwork(String(req.query.network || ""));

  try {
    const result = await rpcCall<CommitteeResponse>("getcommittee", [], network);
    const publicKeys = extractPublicKeys(result);
    const committeeAddresses = publicKeys.map((key) => {
      const scriptHash = wallet.getScriptHashFromPublicKey(normalizePublicKey(key));
      return wallet.getAddressFromScriptHash(scriptHash);
    });

    return res.status(200).json({
      network,
      isCouncilMember: committeeAddresses.includes(address),
    });
  } catch (error) {
    console.error("Council member check failed:", error);
    return res.status(500).json({
      error: "Failed to check council membership",
      network,
      isCouncilMember: null,
    });
  }
}
