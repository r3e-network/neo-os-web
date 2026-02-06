/**
 * Community System Shared Utilities
 * Provides helpers for proof-of-interaction, spam checking, and rating calculations
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { error } from "./response.ts";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

export interface ProofOfInteraction {
  verified: boolean;
  interaction_count: number;
  first_interaction_at?: string;
  can_rate: boolean;
  can_comment: boolean;
}

export interface CommentVoteCounts {
  upvotes: number;
  downvotes: number;
}

export interface WeightedRating {
  avg_rating: number;
  total_ratings: number;
  rating_distribution: Record<string, number>;
  weighted_score: number;
}

// -----------------------------------------------------------------------------
// Proof of Interaction
// -----------------------------------------------------------------------------

/**
 * Verify if user has interacted with an app (via cached proof or tx_events)
 */
export async function verifyProofOfInteraction(
  supabase: SupabaseClient,
  appId: string,
  userId: string,
  req?: Request
): Promise<ProofOfInteraction | Response> {
  // Check cached proof first
  const { data: cached, error: cacheErr } = await supabase
    .from("social_proof_of_interaction")
    .select("tx_hash, verified_at")
    .eq("app_id", appId)
    .eq("user_id", userId)
    .limit(1);

  if (cacheErr) {
    return error(500, "failed to check interaction proof", "DB_ERROR", req);
  }

  if (cached && cached.length > 0) {
    return {
      verified: true,
      interaction_count: cached.length,
      first_interaction_at: cached[0].verified_at,
      can_rate: true,
      can_comment: true,
    };
  }

  // No cached proof - user hasn't been verified yet
  return {
    verified: false,
    interaction_count: 0,
    can_rate: false,
    can_comment: false,
  };
}

// -----------------------------------------------------------------------------
// Spam Prevention
// -----------------------------------------------------------------------------

/**
 * Check if user is within spam rate limits
 */
export async function checkSpamLimit(
  supabase: SupabaseClient,
  userId: string,
  actionType: string,
  appId?: string,
  req?: Request
): Promise<boolean | Response> {
  const { data, error: err } = await supabase.rpc("check_spam_limit", {
    p_user_id: userId,
    p_action_type: actionType,
    p_app_id: appId ?? null,
    p_window_minutes: 5,
    p_max_per_window: 3,
  });

  if (err) {
    return error(500, "spam check failed", "SPAM_CHECK_ERROR", req);
  }

  if (!data) {
    return error(429, "rate limit exceeded, try again later", "RATE_LIMITED", req);
  }

  return true;
}

/**
 * Log spam action for rate limiting tracking
 */
export async function logSpamAction(
  supabase: SupabaseClient,
  userId: string,
  actionType: string,
  appId?: string
): Promise<void> {
  await supabase.rpc("log_spam_action", {
    p_user_id: userId,
    p_action_type: actionType,
    p_app_id: appId ?? null,
  });
}

// -----------------------------------------------------------------------------
// Vote Counting
// -----------------------------------------------------------------------------

/**
 * Get vote counts for a list of comments
 */
export async function getCommentVoteCounts(
  supabase: SupabaseClient,
  commentIds: string[]
): Promise<Map<string, CommentVoteCounts>> {
  if (commentIds.length === 0) {
    return new Map();
  }

  const { data, error: err } = await supabase
    .from("social_comment_votes")
    .select("comment_id, vote_type")
    .in("comment_id", commentIds);

  if (err || !data) {
    return new Map();
  }

  const counts = new Map<string, CommentVoteCounts>();
  for (const id of commentIds) {
    counts.set(id, { upvotes: 0, downvotes: 0 });
  }

  for (const vote of data) {
    const current = counts.get(vote.comment_id);
    if (current) {
      if (vote.vote_type === "upvote") {
        current.upvotes++;
      } else {
        current.downvotes++;
      }
    }
  }

  return counts;
}

// -----------------------------------------------------------------------------
// Developer Check
// -----------------------------------------------------------------------------

/**
 * Check if user is the developer of an app
 */
export async function isDeveloperOfApp(supabase: SupabaseClient, userId: string, appId: string): Promise<boolean> {
  const { data, error: err } = await supabase.from("miniapps").select("developer_user_id").eq("app_id", appId).single();

  if (err || !data) {
    return false;
  }

  return data.developer_user_id === userId;
}

// -----------------------------------------------------------------------------
// Input Sanitization
// -----------------------------------------------------------------------------

/**
 * Sanitize user input to prevent XSS attacks
 * Escapes HTML special characters
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;")
    .replace(/\//g, "&#x2F;");
}

/**
 * Validate and sanitize comment content
 * Returns sanitized content or null if invalid
 */
export function validateCommentContent(content: string, maxLength = 2000): string | null {
  if (!content || typeof content !== "string") {
    return null;
  }
  const trimmed = content.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) {
    return null;
  }
  return sanitizeInput(trimmed);
}

/**
 * Validate rating value (1-5)
 */
export function validateRatingValue(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return null;
  }
  if (value < 1 || value > 5) {
    return null;
  }
  return value;
}
