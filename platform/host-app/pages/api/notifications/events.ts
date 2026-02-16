import type { NextApiRequest, NextApiResponse } from "next";
import { getEvents, markAsRead, getUnreadCount } from "@/lib/notifications/supabase-service";
import { apiError } from "@/lib/api-response";
import { withCsrfProtection } from "@/lib/csrf";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { wallet } = req.query;

  if (!wallet || typeof wallet !== "string") {
    return apiError.badRequest(res, "Wallet address required");
  }

  if (req.method === "GET") {
    const limit = parseInt(req.query.limit as string) || 50;
    const unreadOnly = req.query.unreadOnly === "true";

    const events = await getEvents(wallet, limit, unreadOnly);
    const unreadCount = await getUnreadCount(wallet);

    return res.status(200).json({ events, unreadCount });
  }

  if (req.method === "POST") {
    const { eventId } = req.body;
    if (!eventId) {
      return apiError.badRequest(res, "Event ID required");
    }

    const success = await markAsRead(eventId);
    return res.status(success ? 200 : 500).json({ success });
  }

  return apiError.methodNotAllowed(res);
}

export default withCsrfProtection(handler);
