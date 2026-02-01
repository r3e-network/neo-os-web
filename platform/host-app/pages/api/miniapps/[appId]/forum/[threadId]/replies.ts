import type { NextApiRequest, NextApiResponse } from "next";
import type { ForumReply } from "@/components/features/forum/types";

// In-memory store
const repliesStore: Map<string, ForumReply[]> = new Map();
let replyIdCounter = 1;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { appId, threadId } = req.query;

  if (!appId || !threadId || typeof threadId !== "string") {
    return res.status(400).json({ error: "Missing parameters" });
  }

  if (req.method === "GET") {
    return getReplies(threadId, req, res);
  }

  if (req.method === "POST") {
    return createReply(threadId, req, res);
  }

  return res.status(405).json({ error: "Method not allowed" });
}

function getReplies(threadId: string, req: NextApiRequest, res: NextApiResponse) {
  const replies = repliesStore.get(threadId) || [];
  return res.status(200).json({ replies });
}

function createReply(threadId: string, req: NextApiRequest, res: NextApiResponse) {
  const { wallet, content } = req.body;

  if (!wallet || !content?.trim()) {
    return res.status(400).json({ error: "Missing fields" });
  }

  if (!repliesStore.has(threadId)) {
    repliesStore.set(threadId, []);
  }

  const reply: ForumReply = {
    id: `reply-${replyIdCounter++}`,
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
