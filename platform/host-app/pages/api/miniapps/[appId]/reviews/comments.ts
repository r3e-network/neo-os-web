import type { NextApiRequest, NextApiResponse } from "next";
import type { SocialComment } from "@/components/types";
import { apiError, sendError, ErrorCodes } from "@/lib/api-response";
import { withCsrfProtection } from "@/lib/csrf";

// In-memory store for demo (replace with Supabase in production)
const commentsStore: Map<string, SocialComment[]> = new Map();
const votesStore: Map<string, Map<string, "upvote" | "downvote">> = new Map();

let commentIdCounter = 1;

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

  switch (req.method) {
    case "GET":
      return getComments(appId, req, res);
    case "POST":
      return createComment(appId, req, res);
    default:
      return apiError.methodNotAllowed(res);
  }
}

function getComments(appId: string, req: NextApiRequest, res: NextApiResponse) {
  const parentId = req.query.parent_id as string | undefined;
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 20, 1), 100);
  const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

  const allComments = commentsStore.get(appId) || [];

  // Filter by parent_id (null for top-level comments)
  const filtered = allComments.filter((c) => (parentId ? c.parent_id === parentId : c.parent_id === null));

  // Sort by upvotes (descending), then by date
  filtered.sort((a, b) => {
    const scoreA = a.upvotes - a.downvotes;
    const scoreB = b.upvotes - b.downvotes;
    if (scoreB !== scoreA) return scoreB - scoreA;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const paginated = filtered.slice(offset, offset + limit);
  const hasMore = offset + limit < filtered.length;

  return res.status(200).json({
    comments: paginated,
    hasMore,
    total: filtered.length,
  });
}

function createComment(appId: string, req: NextApiRequest, res: NextApiResponse) {
  const { wallet, content, parent_id } = req.body;

  if (!wallet || typeof wallet !== "string" || !/^N[A-Za-z0-9]{33}$/.test(wallet)) {
    return apiError.badRequest(res, "Invalid wallet address");
  }
  if (!content?.trim()) {
    return apiError.badRequest(res, "Missing content");
  }

  if (typeof content !== "string" || content.length > 2000) {
    return apiError.badRequest(res, "Comment too long");
  }

  if (!commentsStore.has(appId)) {
    commentsStore.set(appId, []);
  }

  const now = new Date().toISOString();
  const comment: SocialComment = {
    id: `comment-${commentIdCounter++}`,
    app_id: appId,
    author_user_id: wallet,
    parent_id: parent_id || null,
    content: content.trim(),
    is_developer_reply: false,
    upvotes: 0,
    downvotes: 0,
    reply_count: 0,
    created_at: now,
    updated_at: now,
  };

  commentsStore.get(appId)!.push(comment);

  // Update parent reply count
  if (parent_id) {
    const parent = commentsStore.get(appId)!.find((c) => c.id === parent_id);
    if (parent) {
      parent.reply_count++;
    }
  }

  return res.status(201).json({ comment });
}

export default withCsrfProtection(handler);
