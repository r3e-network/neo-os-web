import { apiError } from "@/lib/api-response";
import type { NextApiRequest, NextApiResponse } from "next";
import { logger } from "@/lib/logger";
import { relaxedLimit } from "@/lib/rate-limit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }
  if (relaxedLimit(req, res)) return;

  const network = req.query.network === "mainnet" ? "mainnet" : "testnet";
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

  try {
    const indexerUrl = process.env.INDEXER_SUPABASE_URL;
    const indexerKey = process.env.INDEXER_SUPABASE_SERVICE_KEY;

    if (!indexerUrl || !indexerKey) {
      return apiError.internal(res, "Indexer not configured");
    }

    const response = await fetch(
      `${indexerUrl}/rest/v1/indexer_transactions?network=eq.${network}&order=block_time.desc&limit=${limit}`,
      {
        headers: {
          apikey: indexerKey,
          Authorization: `Bearer ${indexerKey}`,
        },
        signal: AbortSignal.timeout(10000),
      },
    );

    if (!response.ok) {
      return apiError.internal(res, "Indexer request failed");
    }
    const transactions = await response.json();

    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate");
    return res.status(200).json({
      network,
      transactions: transactions || [],
      count: transactions?.length || 0,
    });
  } catch (err) {
    logger.error("Recent transactions error:", err);
    return apiError.internal(res, "Failed to fetch transactions");
  }
}
