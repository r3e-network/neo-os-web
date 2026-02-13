// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";
import "../_shared/deno.d.ts";

import { createHandler } from "../_shared/handler.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError } from "../_shared/error-codes.ts";
import { supabaseClient, tryGetUser } from "../_shared/supabase.ts";

export const handler = createHandler(
  { method: "GET", auth: false, rateLimit: "social-ratings" },
  async ({ req, url }) => {
    const appId = url.searchParams.get("app_id")?.trim();

    if (!appId) {
      return validationError("app_id", "app_id is required", req);
    }

    const supabase = supabaseClient();

    // Get weighted rating via RPC
    const { data: ratingData, error: rpcErr } = await supabase.rpc("calculate_app_rating_weighted", {
      p_app_id: appId,
    });

    if (rpcErr) {
      return errorResponse("SERVER_002", { message: "failed to calculate rating" }, req);
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
      req
    );
  }
);

if (import.meta.main) {
  Deno.serve(handler);
}
