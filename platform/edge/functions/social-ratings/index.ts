import { handleCorsPreflight } from "../_shared/cors.ts";
import { error, json } from "../_shared/response.ts";
import { requireRateLimit } from "../_shared/ratelimit.ts";
import { supabaseClient, tryGetUser } from "../_shared/supabase.ts";

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "GET") {
    return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);
  }

  const rateLimited = await requireRateLimit(req, "social-ratings");
  if (rateLimited) return rateLimited;

  const url = new URL(req.url);
  const appId = url.searchParams.get("app_id")?.trim();

  if (!appId) {
    return error(400, "app_id is required", "MISSING_APP_ID", req);
  }

  const supabase = supabaseClient();

  // Get weighted rating via RPC
  const { data: ratingData, error: rpcErr } = await supabase.rpc("calculate_app_rating_weighted", { p_app_id: appId });

  if (rpcErr) {
    return error(500, "failed to calculate rating", "DB_ERROR", req);
  }

  const result = ratingData?.[0] || {
    avg_rating: 0,
    total_ratings: 0,
    rating_distribution: {},
    weighted_score: 0,
  };

  // Try to get current user's rating
  const user = await tryGetUser(req);
  let userRating = null;

  if (user) {
    const { data: myRating } = await supabase
      .from("social_ratings")
      .select("rating_value, review_text")
      .eq("app_id", appId)
      .eq("rater_user_id", user.id)
      .single();

    if (myRating) {
      userRating = myRating;
    }
  }

  return json(
    {
      app_id: appId,
      avg_rating: Number(result.avg_rating) || 0,
      weighted_score: Number(result.weighted_score) || 0,
      total_ratings: result.total_ratings || 0,
      distribution: result.rating_distribution || {},
      user_rating: userRating,
    },
    {},
    req,
  );
}

Deno.serve(handler);
