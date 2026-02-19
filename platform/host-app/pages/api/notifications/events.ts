import type { NextApiRequest, NextApiResponse } from "next";
import { getEvents, markAsRead, getUnreadCount } from "@/lib/notifications/supabase-service";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { withCsrfProtection } from "@/lib/csrf";
import { standardLimit } from "@/lib/rate-limit";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (standardLimit(req, res)) return;
  res.setHeader("Cache-Control", "no-store, private");

  const { wallet } = req.query;

  if (!wallet || typeof wallet !== "string") {
    return apiError.badRequest(res, "Wallet address required");
  }

  try {
    if (req.method === "GET") {
      const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 50, 1), 100);
      const unreadOnly = req.query.unreadOnly === "true";

      const events = await getEvents(wallet, limit, unreadOnly);
      const unreadCount = await getUnreadCount(wallet);

      return res.status(200).json({ events, unreadCount });
    }

    if (req.method === "POST") {
      const { eventId } = req.body;
      if (!eventId || typeof eventId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(eventId)) {
        return apiError.badRequest(res, "Valid event ID required");
      }

      const success = await markAsRead(eventId);
      if (!success) return apiError.internal(res, "Failed to mark as read");
      return res.status(200).json({ success });
    }

    return apiError.methodNotAllowed(res);
  } catch (err) {
    logger.error("Notification events error:", err instanceof Error ? err.message : "unknown error");
    return apiError.internal(res, "Failed to process notification events");
  }
}

export default withCsrfProtection(handler);
