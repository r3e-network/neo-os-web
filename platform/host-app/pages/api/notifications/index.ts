/**
 * Notifications API
 * GET: Fetch user notifications
 * POST: Mark notifications as read
 */

import type { NextApiRequest, NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createHandler } from "@/lib/api";
import { markNotificationsReadBody } from "@/lib/schemas";
import { logger } from "@/lib/logger";

export interface Notification {
  id: string;
  type: string;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  read: boolean;
  created_at: string;
}

export default createHandler({
  auth: "wallet",
  methods: {
    GET: (req, res, ctx) => getNotifications(ctx.db, ctx.address!, req, res),
    POST: {
      handler: (req, res, ctx) => markAsRead(ctx.db, ctx.address!, req, res),
      schema: markNotificationsReadBody,
    },
  },
});

async function getNotifications(db: SupabaseClient, wallet: string, req: NextApiRequest, res: NextApiResponse) {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const unreadOnly = req.query.unread === "true";

  let query = db
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
    logger.error("Failed to fetch notifications", error);
    return res.status(500).json({ error: "Failed to fetch notifications" });
  }

  const { count } = await db
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

  return res.status(200).json({ notifications, unreadCount: count || 0 });
}

async function markAsRead(db: SupabaseClient, wallet: string, req: NextApiRequest, res: NextApiResponse) {
  const { ids, all } = req.body;

  if (all) {
    const { error } = await db
      .from("notification_events")
      .update({ read: true })
      .eq("wallet_address", wallet)
      .eq("read", false);

    if (error) {
      return res.status(500).json({ error: "Failed to mark as read" });
    }
    return res.status(200).json({ success: true });
  }

  const { error } = await db
    .from("notification_events")
    .update({ read: true })
    .eq("wallet_address", wallet)
    .in("id", ids);

  if (error) {
    return res.status(500).json({ error: "Failed to mark as read" });
  }

  return res.status(200).json({ success: true });
}
