import type { NextApiRequest, NextApiResponse } from "next";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const network = (req.query.network as string) || "testnet";
  const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

  try {
    const indexerUrl = process.env.INDEXER_SUPABASE_URL;
    const indexerKey = process.env.INDEXER_SUPABASE_SERVICE_KEY;

    if (!indexerUrl || !indexerKey) {
      return res.status(500).json({ error: "Indexer not configured" });
    }

    const response = await fetch(
      `${indexerUrl}/rest/v1/indexer_transactions?network=eq.${network}&order=block_time.desc&limit=${limit}`,
      {
        headers: {
          apikey: indexerKey,
          Authorization: `Bearer ${indexerKey}`,
        },
      },
    );

    const transactions = await response.json();

    res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate");
    return res.status(200).json({
      network,
      transactions: transactions || [],
      count: transactions?.length || 0,
    });
  } catch (err) {
    console.error("Recent transactions error:", err);
    return res.status(500).json({ error: "Failed to fetch transactions" });
  }
}
