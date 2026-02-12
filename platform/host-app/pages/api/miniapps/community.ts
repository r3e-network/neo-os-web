import type { NextApiRequest, NextApiResponse } from "next";
import { fetchCommunityApps, type RegistryStatusFilter } from "@/lib/community-apps";
import { logger } from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const status = ((req.query.status as string) || "active") as RegistryStatusFilter;
    const category = req.query.category as string | undefined;
    const apps = await fetchCommunityApps({ status, category });
    res.status(200).json({ apps });
  } catch (error) {
    // Return empty array on any error
    logger.warn("Fetch community apps error", error);
    res.status(200).json({ apps: [] });
  }
}
