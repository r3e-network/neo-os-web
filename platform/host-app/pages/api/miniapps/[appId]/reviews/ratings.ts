import type { NextApiRequest, NextApiResponse } from "next";
import type { SocialRating } from "@/components/types";
import { apiError, sendError, ErrorCodes } from "@/lib/api-response";
import { withCsrfProtection } from "@/lib/csrf";

// In-memory store for demo (replace with Supabase in production)
const ratingsStore: Map<string, Map<string, { value: number; review?: string }>> = new Map();

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { appId } = req.query;

  if (!appId || typeof appId !== "string") {
    return apiError.badRequest(res, "Missing appId");
  }
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(appId)) {
    return apiError.badRequest(res, "Invalid appId format");
  }

  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_INMEMORY_STORE) {
    return sendError(res, 503, "In-memory store not available in production", ErrorCodes.INTERNAL_ERROR);
  }

  if (req.method === "GET") {
    return getRatings(appId, req, res);
  }

  if (req.method === "POST") {
    return submitRating(appId, req, res);
  }

  return apiError.methodNotAllowed(res);
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

  if (!wallet || typeof wallet !== "string" || !/^N[A-Za-z0-9]{33}$/.test(wallet)) {
    return apiError.badRequest(res, "Invalid wallet address");
  }
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) {
    return apiError.badRequest(res, "Invalid rating value");
  }

  if (!ratingsStore.has(appId)) {
    ratingsStore.set(appId, new Map());
  }

  ratingsStore.get(appId)!.set(wallet, { value, review: review?.slice(0, 1000) });

  return res.status(201).json({ success: true });
}

export default withCsrfProtection(handler);
