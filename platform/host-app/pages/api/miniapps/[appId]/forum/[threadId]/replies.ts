import type { NextApiRequest, NextApiResponse } from "next";
import type { ForumReply } from "@/components/features/forum/types";
import crypto from "crypto";
import { apiError, sendError, ErrorCodes } from "@/lib/api-response";
import { withCsrfProtection } from "@/lib/csrf";

// In-memory store
const repliesStore: Map<string, ForumReply[]> = new Map();

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_INMEMORY_STORE) {
    return sendError(res, 503, "In-memory store not available in production", ErrorCodes.INTERNAL_ERROR);
  }

  const { appId, threadId } = req.query;

  if (!appId || !threadId || typeof threadId !== "string") {
    return apiError.badRequest(res, "Missing parameters");
  }
  if (typeof appId === "string" && !/^[a-z0-9][a-z0-9_-]*$/.test(appId)) {
    return apiError.badRequest(res, "Invalid appId format");
  }

  if (req.method === "GET") {
    return getReplies(threadId, req, res);
  }

  if (req.method === "POST") {
    return createReply(threadId, req, res);
  }

  return apiError.methodNotAllowed(res);
}

export default withCsrfProtection(handler);

function getReplies(threadId: string, req: NextApiRequest, res: NextApiResponse) {
  const replies = repliesStore.get(threadId) || [];
  return res.status(200).json({ replies });
}

function createReply(threadId: string, req: NextApiRequest, res: NextApiResponse) {
  const { wallet, content } = req.body;

  if (!wallet || typeof wallet !== "string" || !/^N[A-Za-z0-9]{33}$/.test(wallet)) {
    return apiError.badRequest(res, "Invalid wallet address");
  }
  if (!content || typeof content !== "string" || !content.trim()) {
    return apiError.badRequest(res, "Missing content");
  }

  if (!repliesStore.has(threadId)) {
    repliesStore.set(threadId, []);
  }

  const reply: ForumReply = {
    id: `reply-${crypto.randomUUID()}`,
    thread_id: threadId,
    author_id: wallet,
    author_name: `${wallet.slice(0, 6)}...${wallet.slice(-4)}`,
    content: content.trim().slice(0, 2000),
    is_solution: false,
    upvotes: 0,
    created_at: new Date().toISOString(),
  };

  repliesStore.get(threadId)!.push(reply);

  return res.status(201).json({ reply });
}
