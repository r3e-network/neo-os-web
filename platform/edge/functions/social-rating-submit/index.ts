import { handleCorsPreflight } from "../_shared/cors.ts";
import { error, json } from "../_shared/response.ts";
import { requireAuth, supabaseClient } from "../_shared/supabase.ts";
import { verifyProofOfInteraction, validateRatingValue, sanitizeInput } from "../_shared/community.ts";

interface RatingRequest {
  app_id: string;
  rating_value: number;
  review_text?: string;
}

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") {
    return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  let body: RatingRequest;
  try {
    body = await req.json();
  } catch {
    return error(400, "invalid JSON body", "INVALID_JSON", req);
  }

  const { app_id, rating_value, review_text } = body;

  // Validate fields
  if (!app_id?.trim()) {
    return error(400, "app_id is required", "MISSING_APP_ID", req);
  }
  const validatedRating = validateRatingValue(rating_value);
  if (!validatedRating) {
    return error(400, "rating_value must be integer 1-5", "INVALID_RATING", req);
  }
  const sanitizedReview = review_text ? sanitizeInput(review_text.trim().slice(0, 1000)) : null;

  const supabase = supabaseClient();
  const userId = auth.user.id;

  // Verify proof of interaction
  const proof = await verifyProofOfInteraction(supabase, app_id, userId, req);
  if (proof instanceof Response) return proof;
  if (!proof.can_rate) {
    return error(403, "must interact with app before rating", "NO_INTERACTION", req);
  }

  // Upsert rating (one per user per app)
  const { data, error: upsertErr } = await supabase
    .from("social_ratings")
    .upsert(
      {
        app_id,
        rater_user_id: userId,
        rating_value: validatedRating,
        review_text: sanitizedReview,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "app_id,rater_user_id" },
    )
    .select()
    .single();

  if (upsertErr) {
    return error(500, "failed to submit rating", "DB_ERROR", req);
  }

  return json(data, { status: 201 }, req);
}

Deno.serve(handler);
