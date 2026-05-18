import { apiError } from "@/lib/api-response";
import {
  fetchNeoExplorerCouncilGovernance,
  type NeoExplorerGovernanceNetwork,
} from "@/lib/neo-explorer-governance";
import { logger } from "@/lib/logger";
import { relaxedLimit } from "@/lib/rate-limit";
import type { NextApiRequest, NextApiResponse } from "next";

function readQueryValue(value: unknown): string {
  return String(Array.isArray(value) ? value[0] : value ?? "").trim();
}

function parseNetwork(value: unknown): NeoExplorerGovernanceNetwork | null {
  const network = readQueryValue(value);
  if (network === "mainnet" || network === "testnet") return network;
  return null;
}

function parseNumber(value: unknown, fallback: number) {
  const parsed = Number(Array.isArray(value) ? value[0] : value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }
  if (relaxedLimit(req, res)) return;

  try {
    const network = parseNetwork(req.query.network);
    if (!network) {
      return apiError.badRequest(res, "network must be mainnet or testnet");
    }
    const limit = parseNumber(req.query.limit ?? req.query.pageSize, 21);
    const skip =
      req.query.skip === undefined
        ? Math.max(0, parseNumber(req.query.page, 1) - 1) * limit
        : parseNumber(req.query.skip, 0);

    const governance = await fetchNeoExplorerCouncilGovernance({
      network,
      limit,
      skip,
    });

    res.setHeader("Cache-Control", "s-maxage=15, stale-while-revalidate=60");
    res.status(200).json(governance);
    return;
  } catch (err) {
    logger.error(
      "Neo Explorer council governance error:",
      err instanceof Error ? err.message : String(err),
    );
    return apiError.gatewayError(res, "Failed to fetch council governance data");
  }
}
