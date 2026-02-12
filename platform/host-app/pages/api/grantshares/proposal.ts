import type { NextApiRequest, NextApiResponse } from "next";
import { logger } from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== "GET") {
        return res.status(405).json({ error: "Method not allowed" });
    }

    const { id } = req.query;

    if (!id) {
        return res.status(400).json({ error: "Missing proposal ID" });
    }

    try {
        const response = await fetch(`https://api.prod.grantshares.io/api/proposal/${id}`, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch from GrantShares: ${response.status}`);
        }

        const data = await response.json();

        // Cache for 5 minutes server-side, 10 min stale
        res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600");
        return res.json(data);
    } catch (error) {
        logger.error("GrantShares Proposal Detail Error", error);
        return res.status(500).json({ error: "Failed to fetch data" });
    }
}
