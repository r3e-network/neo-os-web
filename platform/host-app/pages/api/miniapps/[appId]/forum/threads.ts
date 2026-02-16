import type { NextApiRequest, NextApiResponse } from "next";
import type { ForumThread } from "@/components/features/forum/types";
import crypto from "crypto";
import { apiError, sendError, ErrorCodes } from "@/lib/api-response";
import { withCsrfProtection } from "@/lib/csrf";

// In-memory store (replace with Supabase in production)
const threadsStore: Map<string, ForumThread[]> = new Map();

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
    return getThreads(appId, req, res);
  }

  if (req.method === "POST") {
    return createThread(appId, req, res);
  }

  return apiError.methodNotAllowed(res);
}

export default withCsrfProtection(handler);

function getThreads(appId: string, req: NextApiRequest, res: NextApiResponse) {
  const category = req.query.category as string | undefined;
  const limit = Math.max(1, Math.min(parseInt(req.query.limit as string) || 20, 50));
  const offset = Math.max(0, parseInt(req.query.offset as string) || 0);

  let threads = threadsStore.get(appId) || [];

  if (category) {
    threads = threads.filter((t) => t.category === category);
  }

  // Sort: pinned first, then by last activity
  threads.sort((a, b) => {
    if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
    const dateA = new Date(a.last_reply_at || a.created_at).getTime();
    const dateB = new Date(b.last_reply_at || b.created_at).getTime();
    return dateB - dateA;
  });

  const paginated = threads.slice(offset, offset + limit);

  return res.status(200).json({
    threads: paginated,
    hasMore: offset + limit < threads.length,
    total: threads.length,
  });
}

function createThread(appId: string, req: NextApiRequest, res: NextApiResponse) {
  const { wallet, title, content, category } = req.body;

  if (!wallet || typeof wallet !== "string" || !/^N[A-Za-z0-9]{33}$/.test(wallet)) {
    return apiError.badRequest(res, "Invalid wallet address");
  }

  if (!title?.trim() || !content?.trim()) {
    return apiError.badRequest(res, "Missing required fields");
  }

  if (typeof title !== "string" || typeof content !== "string") {
    return apiError.badRequest(res, "Invalid field types");
  }

  const validCategories = ["general", "bug", "feature", "discussion", "announcement"];
  const safeCategory = validCategories.includes(category) ? category : "general";

  if (!threadsStore.has(appId)) {
    threadsStore.set(appId, []);
  }

  const now = new Date().toISOString();
  const thread: ForumThread = {
    id: `thread-${crypto.randomUUID()}`,
    app_id: appId,
    author_id: wallet,
    author_name: `${wallet.slice(0, 6)}...${wallet.slice(-4)}`,
    title: title.trim().slice(0, 200),
    content: content.trim().slice(0, 5000),
    category: safeCategory,
    reply_count: 0,
    view_count: 0,
    is_pinned: false,
    is_locked: false,
    created_at: now,
    updated_at: now,
    last_reply_at: null,
  };

  threadsStore.get(appId)!.push(thread);

  return res.status(201).json({ thread });
}
