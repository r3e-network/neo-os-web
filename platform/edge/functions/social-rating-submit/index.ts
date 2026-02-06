// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";

// Deno global type definitions
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Promise<Response>): void;
};

import { handleCorsPreflight } from "../_shared/cors.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError } from "../_shared/error-codes.ts";
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
    return errorResponse("METHOD_NOT_ALLOWED", undefined, req);
  }

  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  let body: RatingRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse("BAD_JSON", undefined, req);
  }

  const { app_id, rating_value, review_text } = body;

  // Validate fields
  if (!app_id?.trim()) {
    return validationError("app_id", "app_id is required", req);
  }
  const validatedRating = validateRatingValue(rating_value);
  if (!validatedRating) {
    return validationError("rating_value", "rating_value must be integer 1-5", req);
  }
  const sanitizedReview = review_text ? sanitizeInput(review_text.trim().slice(0, 1000)) : null;

  const supabase = supabaseClient();
  const userId = auth.userId;

  // Verify proof of interaction
  const proof = await verifyProofOfInteraction(supabase, app_id, userId, req);
  if (proof instanceof Response) return proof;
  if (!proof.can_rate) {
    return errorResponse("AUTH_004", { message: "must interact with app before rating" }, req);
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
      { onConflict: "app_id,rater_user_id" }
    )
    .select()
    .single();

  if (upsertErr) {
    return errorResponse("SERVER_002", { message: "failed to submit rating" }, req);
  }

  return json(data, { status: 201 }, req);
}

if (import.meta.main) {
  Deno.serve(handler);
}
