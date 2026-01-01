import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  content: string;
  timestamp: string;
  type: "text" | "system" | "tip";
  tipAmount?: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { appId } = req.query;

  if (!appId || typeof appId !== "string") {
    return res.status(400).json({ error: "Missing appId" });
  }

  if (!isSupabaseConfigured) {
    return res.status(503).json({ error: "Database not configured" });
  }

  if (req.method === "GET") {
    return getMessages(appId, req, res);
  }

  if (req.method === "POST") {
    return postMessage(appId, req, res);
  }

  return res.status(405).json({ error: "Method not allowed" });
}

async function getMessages(appId: string, req: NextApiRequest, res: NextApiResponse) {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

  // Fetch messages
  const { data: messages, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("app_id", appId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return res.status(500).json({ error: "Failed to fetch messages" });
  }

  // Get participant count (active in last 5 minutes)
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("chat_participants")
    .select("*", { count: "exact", head: true })
    .eq("app_id", appId)
    .gte("last_seen_at", fiveMinutesAgo);

  // Transform to ChatMessage format
  const formatted: ChatMessage[] = (messages || []).reverse().map((m) => ({
    id: m.id.toString(),
    userId: m.wallet_address,
    userName: formatWallet(m.wallet_address),
    content: m.content,
    timestamp: m.created_at,
    type: m.message_type || "text",
    tipAmount: m.tip_amount,
  }));

  return res.status(200).json({
    messages: formatted,
    participantCount: count || 0,
  });
}

async function postMessage(appId: string, req: NextApiRequest, res: NextApiResponse) {
  const { wallet, content } = req.body;

  if (!wallet || !content) {
    return res.status(400).json({ error: "Missing wallet or content" });
  }

  if (content.length > 500) {
    return res.status(400).json({ error: "Message too long" });
  }

  // Insert message
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      app_id: appId,
      wallet_address: wallet,
      content: content.trim(),
    })
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: "Failed to send message" });
  }

  // Update participant last seen
  await supabase.from("chat_participants").upsert(
    {
      app_id: appId,
      wallet_address: wallet,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "app_id,wallet_address" },
  );

  const message: ChatMessage = {
    id: data.id.toString(),
    userId: data.wallet_address,
    userName: formatWallet(data.wallet_address),
    content: data.content,
    timestamp: data.created_at,
    type: "text",
  };

  return res.status(201).json({ message });
}

function formatWallet(wallet: string): string {
  if (!wallet || wallet.length < 10) return wallet;
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}
