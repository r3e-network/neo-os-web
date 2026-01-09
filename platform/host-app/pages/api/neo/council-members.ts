/**
 * Neo Council Members API
 * GET: Fetch top 21 council candidates from Neo native contract
 * Query params: network (mainnet|testnet), address (optional - check if specific address is council member)
 */
import type { NextApiRequest, NextApiResponse } from "next";

const NEO_RPC_TESTNET = "https://testnet1.neo.coz.io:443";
const NEO_RPC_MAINNET = "https://mainnet1.neo.coz.io:443";

// Neo native contract for committee/candidates
const NEO_CONTRACT_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";

interface Candidate {
  publicKey: string;
  votes: string;
  address?: string;
}

interface CouncilResponse {
  network: string;
  councilMembers: Candidate[];
  isCouncilMember?: boolean;
  timestamp: number;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<CouncilResponse | { error: string }>) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const network = (req.query.network as string) || "testnet";
  const checkAddress = req.query.address as string | undefined;

  if (network !== "mainnet" && network !== "testnet") {
    return res.status(400).json({ error: "Invalid network. Use 'mainnet' or 'testnet'" });
  }

  const rpcUrl = network === "mainnet" ? NEO_RPC_MAINNET : NEO_RPC_TESTNET;

  try {
    // Get candidates from Neo native contract
    const candidates = await getCandidates(rpcUrl);

    // Sort by votes and take top 21
    const sortedCandidates = candidates.sort((a, b) => (BigInt(b.votes) > BigInt(a.votes) ? 1 : -1)).slice(0, 21);

    let isCouncilMember: boolean | undefined;

    if (checkAddress) {
      // Check if the address is in top 21
      isCouncilMember = sortedCandidates.some((c) => c.address?.toLowerCase() === checkAddress.toLowerCase());
    }

    // Cache for 60 seconds
    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate");

    return res.status(200).json({
      network,
      councilMembers: sortedCandidates,
      isCouncilMember,
      timestamp: Date.now(),
    });
  } catch (err) {
    console.error("Council members API error:", err);
    return res.status(500).json({
      error: err instanceof Error ? err.message : "Failed to fetch council members",
    });
  }
}

async function getCandidates(rpcUrl: string): Promise<Candidate[]> {
  const response = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "invokefunction",
      params: [NEO_CONTRACT_HASH, "getCandidates", []],
      id: 1,
    }),
  });

  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message || "RPC error");
  }

  const stack = data.result?.stack?.[0];
  if (!stack || stack.type !== "Array") {
    return [];
  }

  return stack.value.map((item: any) => {
    const struct = item.value;
    const publicKey = struct[0]?.value || "";
    const votes = struct[1]?.value || "0";

    // Convert public key to address
    const address = publicKeyToAddress(publicKey);

    return { publicKey, votes, address };
  });
}

function publicKeyToAddress(publicKey: string): string {
  // For now, return the public key as identifier
  // In production, use proper Neo address derivation
  // The actual conversion requires crypto libraries
  return publicKey.slice(0, 40);
}
