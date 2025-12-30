import type { NextApiRequest, NextApiResponse } from "next";

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { appId } = req.query;

  if (!appId || typeof appId !== "string") {
    return res.status(400).json({ error: "Missing appId" });
  }

  if (req.method === "GET") {
    return getMessages(appId, req, res);
  }

  if (req.method === "POST") {
    return postMessage(appId, req, res);
  }

  return res.status(405).json({ error: "Method not allowed" });
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

  if (!wallet || !content) {
    return res.status(400).json({ error: "Missing wallet or content" });
  }

  if (content.length > 500) {
    return res.status(400).json({ error: "Message too long" });
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
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
