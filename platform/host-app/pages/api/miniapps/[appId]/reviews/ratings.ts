import type { NextApiRequest, NextApiResponse } from "next";
import type { SocialRating } from "@/components/types";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { appId } = req.query;

  if (!appId || typeof appId !== "string") {
    return res.status(400).json({ error: "Missing appId" });
  }

  if (!isSupabaseConfigured) {
    return res.status(503).json({ error: "Database not configured" });
  }

  if (req.method === "GET") {
    return getRatings(appId, req, res);
  }

  if (req.method === "POST") {
    return submitRating(appId, req, res);
  }

  return res.status(405).json({ error: "Method not allowed" });
}

async function getRatings(appId: string, req: NextApiRequest, res: NextApiResponse) {
  const wallet = req.query.wallet as string | undefined;

  // Fetch all ratings for this app
  const { data: ratings, error } = await supabase
    .from("miniapp_ratings")
    .select("rating_value, review_text, wallet_address")
    .eq("app_id", appId);

  if (error) {
    console.error("Failed to fetch ratings:", error);
    return res.status(500).json({ error: "Failed to fetch ratings" });
  }

  // Calculate distribution
  const distribution: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  let sum = 0;

  for (const r of ratings || []) {
    const key = r.rating_value.toString();
    distribution[key] = (distribution[key] || 0) + 1;
    sum += r.rating_value;
  }

  const total = ratings?.length || 0;
  const avgRating = total > 0 ? sum / total : 0;

  // Find user's rating if wallet provided
  const userRating = wallet ? ratings?.find((r) => r.wallet_address === wallet) : undefined;

  const rating: SocialRating = {
    app_id: appId,
    avg_rating: avgRating,
    weighted_score: avgRating * Math.log10(total + 1),
    total_ratings: total,
    distribution,
    user_rating: userRating
      ? { rating_value: userRating.rating_value, review_text: userRating.review_text }
      : undefined,
  };

  return res.status(200).json({ rating });
}

async function submitRating(appId: string, req: NextApiRequest, res: NextApiResponse) {
  const { wallet, value, review } = req.body;

  if (!wallet || typeof value !== "number" || value < 1 || value > 5) {
    return res.status(400).json({ error: "Invalid rating data" });
  }

  // Upsert rating (insert or update)
  const { error } = await supabase.from("miniapp_ratings").upsert(
    {
      app_id: appId,
      wallet_address: wallet,
      rating_value: value,
      review_text: review?.slice(0, 1000) || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "app_id,wallet_address" },
  );

  if (error) {
    console.error("Failed to submit rating:", error);
    return res.status(500).json({ error: "Failed to submit rating" });
  }

  return res.status(201).json({ success: true });
}
