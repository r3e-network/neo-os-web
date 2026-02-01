/**
 * API: Neo council member check
 * GET /api/neo/council-members?chain_id=neo-n3-testnet&address=...
 *
 * Note: Council members only exist on Neo N3 chains
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { wallet } from "@cityofzion/neon-js";
import { rpcCall } from "../../../lib/chain/rpc-client";
import { getChainRegistry } from "../../../lib/chains/registry";
import type { ChainId } from "../../../lib/chains/types";
import { isNeoN3Chain } from "../../../lib/chains/types";

type CommitteeResponse = string[] | { committee?: string[] } | Array<{ publicKey?: string; publickey?: string }>;

/** Validate chain ID and ensure it's a Neo N3 chain */
function validateNeoN3ChainId(value: string | undefined): ChainId | null {
  if (!value) return null;
  const registry = getChainRegistry();
  const chain = registry.getChain(value as ChainId);
  if (!chain || !isNeoN3Chain(chain)) return null;
  return chain.id;
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

  const rawChainId = String(req.query.chain_id || req.query.network || "");
  const chainId = validateNeoN3ChainId(rawChainId);

  if (!chainId) {
    const registry = getChainRegistry();
    const neoChains = registry.getChainsByType("neo-n3").map((c) => c.id);
    return res.status(400).json({
      error: "Invalid or missing chain_id. Council members only exist on Neo N3 chains.",
      availableChains: neoChains,
    });
  }

  try {
    const result = await rpcCall<CommitteeResponse>("getcommittee", [], chainId);
    const publicKeys = extractPublicKeys(result);
    const committeeAddresses = publicKeys.map((key) => {
      const scriptHash = wallet.getScriptHashFromPublicKey(normalizePublicKey(key));
      return wallet.getAddressFromScriptHash(scriptHash);
    });

    return res.status(200).json({
      chainId,
      isCouncilMember: committeeAddresses.includes(address),
    });
  } catch (error) {
    console.error("Council member check failed:", error);
    return res.status(500).json({
      error: "Failed to check council membership",
      chainId,
      isCouncilMember: null,
    });
  }
}
