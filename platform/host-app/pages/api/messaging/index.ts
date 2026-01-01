import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isSupabaseConfigured) {
    return res.status(503).json({ error: "Database not configured" });
  }

  if (req.method === "GET") {
    return getMessages(req, res);
  }

  if (req.method === "POST") {
    return sendMessage(req, res);
  }

  return res.status(405).json({ error: "Method not allowed" });
}

async function getMessages(req: NextApiRequest, res: NextApiResponse) {
  const { appId, status } = req.query;

  if (!appId || typeof appId !== "string") {
    return res.status(400).json({ error: "Missing appId" });
  }

  let query = supabase
    .from("app_messages")
    .select("*")
    .eq("target_app_id", appId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (status && typeof status === "string") {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return res.status(500).json({ error: "Failed to fetch messages" });
  }

  return res.status(200).json({ messages: data || [] });
}

async function sendMessage(req: NextApiRequest, res: NextApiResponse) {
  const { source_app_id, target_app_id, message_type, payload } = req.body;

  if (!source_app_id || !target_app_id || !message_type) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const { data, error } = await supabase
    .from("app_messages")
    .insert({
      source_app_id,
      target_app_id,
      message_type,
      payload: payload || {},
    })
    .select()
    .single();

  if (error) {
    return res.status(500).json({ error: "Failed to send message" });
  }

  return res.status(201).json({ message: data });
}
