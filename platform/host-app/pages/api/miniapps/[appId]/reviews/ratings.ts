import type { NextApiRequest, NextApiResponse } from "next";
import type { SocialRating } from "@/components/types";

// In-memory store for demo (replace with Supabase in production)
const ratingsStore: Map<string, Map<string, { value: number; review?: string }>> = new Map();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { appId } = req.query;

  if (!appId || typeof appId !== "string") {
    return res.status(400).json({ error: "Missing appId" });
  }

  if (req.method === "GET") {
    return getRatings(appId, req, res);
  }

  if (req.method === "POST") {
    return submitRating(appId, req, res);
  }

  return res.status(405).json({ error: "Method not allowed" });
}

function getRatings(appId: string, req: NextApiRequest, res: NextApiResponse) {
  const wallet = req.query.wallet as string | undefined;
  const appRatings = ratingsStore.get(appId) || new Map();

  // Calculate distribution
  const distribution: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  let total = 0;
  let sum = 0;

  appRatings.forEach((rating) => {
    distribution[rating.value.toString()] = (distribution[rating.value.toString()] || 0) + 1;
    sum += rating.value;
    total++;
  });

  const avgRating = total > 0 ? sum / total : 0;

  const rating: SocialRating = {
    app_id: appId,
    avg_rating: avgRating,
    weighted_score: avgRating * Math.log10(total + 1),
    total_ratings: total,
    distribution,
    user_rating:
      wallet && appRatings.has(wallet)
        ? { rating_value: appRatings.get(wallet)!.value, review_text: appRatings.get(wallet)!.review || null }
        : undefined,
  };

  return res.status(200).json({ rating });
}

function submitRating(appId: string, req: NextApiRequest, res: NextApiResponse) {
  const { wallet, value, review } = req.body;

  if (!wallet || typeof value !== "number" || value < 1 || value > 5) {
    return res.status(400).json({ error: "Invalid rating data" });
  }

  if (!ratingsStore.has(appId)) {
    ratingsStore.set(appId, new Map());
  }

  ratingsStore.get(appId)!.set(wallet, { value, review: review?.slice(0, 1000) });

  return res.status(201).json({ success: true });
}
