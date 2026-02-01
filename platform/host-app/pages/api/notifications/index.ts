/**
 * Notifications API
 * GET: Fetch user notifications
 * POST: Mark notifications as read
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const wallet = req.headers["x-wallet-address"] as string;

  if (!wallet) {
    return res.status(401).json({ error: "Wallet address required" });
  }

  if (!isSupabaseConfigured) {
    return res.status(503).json({ error: "Database not configured" });
  }

  if (req.method === "GET") {
    return getNotifications(wallet, req, res);
  }

  if (req.method === "POST") {
    return markAsRead(wallet, req, res);
  }

  return res.status(405).json({ error: "Method not allowed" });
}

async function getNotifications(wallet: string, req: NextApiRequest, res: NextApiResponse) {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const unreadOnly = req.query.unread === "true";

  let query = supabase
    .from("notification_events")
    .select("*")
    .eq("wallet_address", wallet)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    query = query.eq("read", false);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Failed to fetch notifications:", error);
    return res.status(500).json({ error: "Failed to fetch notifications" });
  }

  // Get unread count
  const { count } = await supabase
    .from("notification_events")
    .select("*", { count: "exact", head: true })
    .eq("wallet_address", wallet)
    .eq("read", false);

  const notifications: Notification[] = (data || []).map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    content: n.content,
    metadata: n.metadata || {},
    read: n.read,
    created_at: n.created_at,
  }));

  return res.status(200).json({
    notifications,
    unreadCount: count || 0,
  });
}

async function markAsRead(wallet: string, req: NextApiRequest, res: NextApiResponse) {
  const { ids, all } = req.body;

  if (all) {
    // Mark all as read
    const { error } = await supabase
      .from("notification_events")
      .update({ read: true })
      .eq("wallet_address", wallet)
      .eq("read", false);

    if (error) {
      return res.status(500).json({ error: "Failed to mark as read" });
    }
    return res.status(200).json({ success: true });
  }

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "ids array required" });
  }

  const { error } = await supabase
    .from("notification_events")
    .update({ read: true })
    .eq("wallet_address", wallet)
    .in("id", ids);

  if (error) {
    return res.status(500).json({ error: "Failed to mark as read" });
  }

  return res.status(200).json({ success: true });
}
