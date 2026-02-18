import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { withCsrfProtection } from "@/lib/csrf";
import { logger } from "@/lib/logger";
import { standardLimit } from "@/lib/rate-limit";
import { getServerSupabaseClient, hasServiceRoleSupabase, isServerSupabaseConfigured } from "@/lib/server-supabase";
import { formatWalletDisplayName, isValidWalletAddress, resolveUserIdFromWallet } from "@/lib/wallet-user";

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: string;
  type: "text" | "system" | "tip";
  tipAmount?: string;
}

type ChatRow = {
  id: string;
  sender_wallet: string;
  sender_name: string;
  content: string;
  created_at: string;
  message_type: "text" | "system" | "tip";
  tip_amount: string | null;
};

function toChatMessage(row: ChatRow): ChatMessage {
  return {
    id: row.id,
    userId: row.sender_wallet,
    userName: row.sender_name,
    content: row.content,
    timestamp: row.created_at,
    type: row.message_type,
    tipAmount: row.tip_amount || undefined,
  };
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (standardLimit(req, res)) return;
  const { appId } = req.query;

  if (!appId || typeof appId !== "string") {
    return apiError.badRequest(res, "Missing appId");
  }
  if (!/^[a-z0-9][a-z0-9._-]*$/.test(appId)) {
    return apiError.badRequest(res, "Invalid appId format");
  }

  if (req.method === "GET") {
    return getMessages(appId, req, res);
  }

  if (req.method === "POST") {
    return postMessage(appId, req, res);
  }

  return apiError.methodNotAllowed(res);
}

async function getMessages(appId: string, req: NextApiRequest, res: NextApiResponse) {
  if (!isServerSupabaseConfigured()) {
    return res.status(200).json({ messages: [], participantCount: 0 });
  }

  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const supabase = getServerSupabaseClient();
  if (!supabase) {
    return res.status(200).json({ messages: [], participantCount: 0 });
  }

  const { data, error } = await supabase
    .from("chat_messages")
    .select("id,sender_wallet,sender_name,content,created_at,message_type,tip_amount")
    .eq("app_id", appId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    logger.error("Failed to fetch chat messages:", error.message);
    return apiError.internal(res, "Failed to fetch chat messages");
  }

  const ordered = ((data || []) as ChatRow[]).reverse().map(toChatMessage);

  const { data: participantRows } = await supabase
    .from("chat_messages")
    .select("sender_wallet")
    .eq("app_id", appId)
    .order("created_at", { ascending: false })
    .limit(500);

  const participantCount = new Set((participantRows || []).map((row) => String(row.sender_wallet || "").trim()).filter(Boolean))
    .size;

  return res.status(200).json({
    messages: ordered,
    participantCount,
  });
}

async function postMessage(appId: string, req: NextApiRequest, res: NextApiResponse) {
  if (!hasServiceRoleSupabase()) {
    return apiError.configError(res, "SUPABASE_SERVICE_ROLE_KEY is required for chat writes");
  }

  const { wallet, content } = req.body;

  if (!isValidWalletAddress(wallet)) {
    return apiError.badRequest(res, "Invalid wallet address");
  }
  if (!content || typeof content !== "string" || !content.trim()) {
    return apiError.badRequest(res, "Missing or empty content");
  }

  if (content.length > 500) {
    return apiError.badRequest(res, "Message too long");
  }

  const supabase = getServerSupabaseClient({ requireServiceRole: true });
  if (!supabase) {
    return apiError.configError(res, "Supabase service role client unavailable");
  }

  const userId = await resolveUserIdFromWallet(supabase, wallet, { createIfMissing: true });
  if (!userId) {
    return apiError.internal(res, "Failed to resolve user");
  }

  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      app_id: appId,
      sender_user_id: userId,
      sender_wallet: wallet,
      sender_name: formatWalletDisplayName(wallet),
      content: content.trim(),
      message_type: "text",
    })
    .select("id,sender_wallet,sender_name,content,created_at,message_type,tip_amount")
    .single();

  if (error || !data) {
    logger.error("Failed to create chat message:", error?.message || "unknown error");
    return apiError.internal(res, "Failed to post message");
  }

  const message = toChatMessage(data as ChatRow);
  return res.status(201).json({ message });
}

export default withCsrfProtection(handler);
