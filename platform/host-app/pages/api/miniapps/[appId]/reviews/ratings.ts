import type { NextApiRequest, NextApiResponse } from "next";
import type { SocialRating } from "@/components/types";
import { apiError } from "@/lib/api-response";
import { withCsrfProtection } from "@/lib/csrf";
import { logger } from "@/lib/logger";
import { standardLimit } from "@/lib/rate-limit";
import { getServerSupabaseClient, hasServiceRoleSupabase, isServerSupabaseConfigured } from "@/lib/server-supabase";
import { isValidWalletAddress, resolveUserIdFromWallet } from "@/lib/wallet-user";

type RatingRow = {
  app_id: string;
  rating_value: number;
  review_text: string | null;
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (standardLimit(req, res)) return;
  const { appId } = req.query;

  if (!appId || typeof appId !== "string") {
    return apiError.badRequest(res, "Missing appId");
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(appId)) {
    return apiError.badRequest(res, "Invalid appId format");
  }

  if (req.method === "GET") {
    return getRatings(appId, req, res);
  }

  if (req.method === "POST") {
    return submitRating(appId, req, res);
  }

  return apiError.methodNotAllowed(res);
}

async function getRatings(appId: string, req: NextApiRequest, res: NextApiResponse) {
  const wallet = typeof req.query.wallet === "string" ? req.query.wallet.trim() : undefined;
  if (wallet && !isValidWalletAddress(wallet)) {
    return apiError.badRequest(res, "Invalid wallet address");
  }
  if (!isServerSupabaseConfigured()) {
    return res.status(200).json({
      rating: {
        app_id: appId,
        avg_rating: 0,
        weighted_score: 0,
        total_ratings: 0,
        distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
      } satisfies SocialRating,
    });
  }

  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return res.status(200).json({
      rating: {
        app_id: appId,
        avg_rating: 0,
        weighted_score: 0,
        total_ratings: 0,
        distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
      } satisfies SocialRating,
    });
  }

  const { data, error } = await supabase.from("social_ratings").select("app_id,rating_value,review_text").eq("app_id", appId).limit(1000);
  if (error) {
    logger.error("Failed to fetch ratings:", error.message);
    return apiError.internal(res, "Failed to fetch ratings");
  }

  const rows = (data || []) as RatingRow[];
  const distribution: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  let total = 0;
  let sum = 0;

  for (const row of rows) {
    const bucket = String(row.rating_value);
    distribution[bucket] = (distribution[bucket] || 0) + 1;
    sum += row.rating_value;
    total++;
  }

  const avgRating = total > 0 ? sum / total : 0;
  const weightedScore = avgRating * Math.log10(total + 1);

  let userRating: SocialRating["user_rating"];
  if (wallet && hasServiceRoleSupabase()) {
    const serviceSupabase = getServerSupabaseClient({ requireServiceRole: true });
    if (serviceSupabase) {
      const userId = await resolveUserIdFromWallet(serviceSupabase, wallet, { createIfMissing: false });
      if (userId) {
        const { data: myRating } = await serviceSupabase
          .from("social_ratings")
          .select("rating_value,review_text")
          .eq("app_id", appId)
          .eq("rater_user_id", userId)
          .maybeSingle();
        if (myRating) {
          userRating = {
            rating_value: myRating.rating_value,
            review_text: myRating.review_text || null,
          };
        }
      }
    }
  }

  const rating: SocialRating = {
    app_id: appId,
    avg_rating: avgRating,
    weighted_score: weightedScore,
    total_ratings: total,
    distribution,
    user_rating: userRating,
  };

  res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=300");
  return res.status(200).json({ rating });
}

async function submitRating(appId: string, req: NextApiRequest, res: NextApiResponse) {
  if (!hasServiceRoleSupabase()) {
    return apiError.configError(res, "SUPABASE_SERVICE_ROLE_KEY is required for rating writes");
  }

  const { wallet, value, review } = req.body;

  if (!isValidWalletAddress(wallet)) {
    return apiError.badRequest(res, "Invalid wallet address");
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) {
    return apiError.badRequest(res, "Invalid rating value");
  }
  if (review && (typeof review !== "string" || review.length > 1000)) {
    return apiError.badRequest(res, "Review is too long");
  }

  const supabase = getServerSupabaseClient({ requireServiceRole: true });
  if (!supabase) {
    return apiError.configError(res, "Supabase service role client unavailable");
  }

  const userId = await resolveUserIdFromWallet(supabase, wallet, { createIfMissing: true });
  if (!userId) {
    return apiError.internal(res, "Failed to resolve user");
  }

  const { error } = await supabase.from("social_ratings").upsert(
    {
      app_id: appId,
      rater_user_id: userId,
      rating_value: value,
      review_text: (typeof review === "string" ? review.trim() : "").slice(0, 1000) || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "app_id,rater_user_id" },
  );

  if (error) {
    logger.error("Failed to submit rating:", error.message);
    return apiError.internal(res, "Failed to submit rating");
  }

  return res.status(201).json({ success: true });
}

export default withCsrfProtection(handler);
