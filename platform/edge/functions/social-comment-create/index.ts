import { handleCorsPreflight } from "../_shared/cors.ts";
import { error, json } from "../_shared/response.ts";
import { requireAuth, supabaseClient } from "../_shared/supabase.ts";
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

export async function handler(req: Request): Promise<Response> {
  const preflight = handleCorsPreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") {
    return error(405, "method not allowed", "METHOD_NOT_ALLOWED", req);
  }

  // Require authentication
  const auth = await requireAuth(req);
  if (auth instanceof Response) return auth;

  // Parse request body
  let body: CreateCommentRequest;
  try {
    body = await req.json();
  } catch {
    return error(400, "invalid JSON body", "INVALID_JSON", req);
  }

  const { app_id, content, parent_id } = body;

  // Validate required fields
  if (!app_id?.trim()) {
    return error(400, "app_id is required", "MISSING_APP_ID", req);
  }

  // Validate and sanitize content
  const sanitizedContent = validateCommentContent(content);
  if (!sanitizedContent) {
    return error(400, "content is required and must be 1-2000 characters", "INVALID_CONTENT", req);
  }

  const supabase = supabaseClient();
  const userId = auth.userId;

  // Verify proof of interaction (user must have used the app)
  const proof = await verifyProofOfInteraction(supabase, app_id, userId, req);
  if (proof instanceof Response) return proof;
  if (!proof.can_comment) {
    return error(403, "you must use this app before commenting", "NO_INTERACTION", req);
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
      return error(404, "parent comment not found", "PARENT_NOT_FOUND", req);
    }
    if (parent.app_id !== app_id) {
      return error(400, "parent comment belongs to different app", "INVALID_PARENT", req);
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
    return error(500, "failed to create comment", "DB_ERROR", req);
  }

  // Log spam action for rate limiting
  await logSpamAction(supabase, userId, "comment", app_id);

  return json(comment, { status: 201 }, req);
}

Deno.serve(handler);
