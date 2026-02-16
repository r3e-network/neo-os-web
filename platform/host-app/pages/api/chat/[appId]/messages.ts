import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { apiError, sendError, ErrorCodes } from "@/lib/api-response";
import { withCsrfProtection } from "@/lib/csrf";

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: string;
  type: "text" | "system" | "tip";
  tipAmount?: string;
}

// In-memory store for demo (replace with Supabase in production)
const chatRooms: Map<string, ChatMessage[]> = new Map();
const participants: Map<string, Set<string>> = new Map();

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
    return getMessages(appId, req, res);
  }

  if (req.method === "POST") {
    return postMessage(appId, req, res);
  }

  return apiError.methodNotAllowed(res);
}

function getMessages(appId: string, req: NextApiRequest, res: NextApiResponse) {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const messages = chatRooms.get(appId) || [];
  const participantSet = participants.get(appId) || new Set();

  return res.status(200).json({
    messages: messages.slice(-limit),
    participantCount: participantSet.size,
  });
}

function postMessage(appId: string, req: NextApiRequest, res: NextApiResponse) {
  const { wallet, content } = req.body;

  if (!wallet || typeof wallet !== "string" || !/^N[A-Za-z0-9]{33}$/.test(wallet)) {
    return apiError.badRequest(res, "Invalid wallet address");
  }
  if (!content || typeof content !== "string" || !content.trim()) {
    return apiError.badRequest(res, "Missing or empty content");
  }

  if (content.length > 500) {
    return apiError.badRequest(res, "Message too long");
  }

  // Initialize room if needed
  if (!chatRooms.has(appId)) {
    chatRooms.set(appId, []);
  }
  if (!participants.has(appId)) {
    participants.set(appId, new Set());
  }

  // Add participant
  participants.get(appId)!.add(wallet);

  // Create message
  const message: ChatMessage = {
    id: `msg-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`,
    userId: wallet,
    userName: `${wallet.slice(0, 6)}...${wallet.slice(-4)}`,
    content: content.trim(),
    timestamp: new Date().toISOString(),
    type: "text",
  };

  // Add to room (keep last 200 messages)
  const messages = chatRooms.get(appId)!;
  messages.push(message);
  if (messages.length > 200) {
    messages.shift();
  }

  return res.status(201).json({ message });
}

export default withCsrfProtection(handler);
