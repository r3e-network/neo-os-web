// Initialize environment validation at startup (fail-fast)
import "../_shared/init.ts";
import "../_shared/deno.d.ts";

import { createHandler } from "../_shared/handler.ts";
import { json } from "../_shared/response.ts";
import { errorResponse, validationError } from "../_shared/error-codes.ts";
import { supabaseClient } from "../_shared/supabase.ts";
import {
  checkSpamLimit,
  isDeveloperOfApp,
  logSpamAction,
  validateCommentContent,
  verifyProofOfInteraction,
} from "../_shared/community.ts";

interface CreateCommentRequest {
  app_id: string;
  content: string;
  parent_id?: string;
}

export const handler = createHandler({ method: "POST", auth: "user" }, async ({ req, auth }) => {
  // Parse request body
  let body: CreateCommentRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse("BAD_JSON", undefined, req);
  }

  const { app_id, content, parent_id } = body;

  // Validate required fields
  if (!app_id?.trim()) {
    return validationError("app_id", "app_id is required", req);
  }

  // Validate and sanitize content
  const sanitizedContent = validateCommentContent(content);
  if (!sanitizedContent) {
    return validationError("content", "content is required and must be 1-2000 characters", req);
  }

  const supabase = supabaseClient();
  const userId = auth.userId;

  // Verify proof of interaction (user must have used the app)
  const proof = await verifyProofOfInteraction(supabase, app_id, userId, req);
  if (proof instanceof Response) return proof;
  if (!proof.can_comment) {
    return errorResponse("AUTH_004", { message: "you must use this app before commenting" }, req);
  }

  // Check spam rate limit
  const spamCheck = await checkSpamLimit(supabase, userId, "comment", app_id, req);
  if (spamCheck instanceof Response) return spamCheck;

  // Check if user is developer (for developer reply flag)
  const isDev = await isDeveloperOfApp(supabase, userId, app_id);

  // Validate parent_id if provided
  if (parent_id) {
    const { data: parent, error: parentErr } = await supabase
      .from("social_comments")
      .select("id, app_id")
      .eq("id", parent_id)
      .single();

    if (parentErr || !parent) {
      return errorResponse("NOTFOUND_001", { resource: "parent comment" }, req);
    }
    if (parent.app_id !== app_id) {
      return errorResponse("VAL_002", { field: "parent_id", message: "parent comment belongs to different app" }, req);
    }
  }

  // Insert comment
  const { data: comment, error: insertErr } = await supabase
    .from("social_comments")
    .insert({
      app_id,
      author_user_id: userId,
      content: sanitizedContent,
      parent_id: parent_id || null,
      is_developer_reply: isDev,
    })
    .select()
    .single();

  if (insertErr) {
    return errorResponse("SERVER_002", { message: "failed to create comment" }, req);
  }

  // Log spam action for rate limiting
  await logSpamAction(supabase, userId, "comment", app_id);

  return json(comment, { status: 201 }, req);
});

if (import.meta.main) {
  Deno.serve(handler);
}
