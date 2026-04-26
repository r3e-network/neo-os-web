import type { NextApiRequest, NextApiResponse } from "next";
import {
  getEvents,
  markAsRead,
  getUnreadCount,
} from "@/lib/notifications/supabase-service";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { withCsrfProtection } from "@/lib/csrf";
import { standardLimit } from "@/lib/rate-limit";
import { requireWalletAuth } from "@/lib/require-wallet-auth";

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (standardLimit(req, res)) return;
  res.setHeader("Cache-Control", "no-store, private");

  const { wallet } = req.query;

  if (!wallet || typeof wallet !== "string") {
    return apiError.badRequest(res, "Wallet address required");
  }

  let authedWallet: string | null;
  try {
    authedWallet = await requireWalletAuth(req, res);
  } catch (err) {
    logger.error(
      "requireWalletAuth error:",
      err instanceof Error ? err.message : String(err),
    );
    return apiError.internal(res, "Authentication failed");
  }
  if (!authedWallet) return;
  if (wallet !== authedWallet) {
    return apiError.forbidden(res, "Wallet mismatch");
  }

  try {
    if (req.method === "GET") {
      const limit = Math.min(
        Math.max(parseInt(req.query.limit as string) || 50, 1),
        100,
      );
      const unreadOnly = req.query.unreadOnly === "true";

      const events = await getEvents(wallet, limit, unreadOnly);
      const unreadCount = await getUnreadCount(wallet);

      res.status(200).json({ events, unreadCount });
      return;
    }

    if (req.method === "POST") {
      const { eventId } = req.body;
      if (
        !eventId ||
        typeof eventId !== "string" ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          eventId,
        )
      ) {
        return apiError.badRequest(res, "Valid event ID required");
      }

      const success = await markAsRead(eventId, wallet);
      if (!success) return apiError.internal(res, "Failed to mark as read");
      res.status(200).json({ success });
      return;
    }

    return apiError.methodNotAllowed(res);
  } catch (err) {
    logger.error(
      "Notification events error:",
      err instanceof Error ? err.message : "unknown error",
    );
    return apiError.internal(res, "Failed to process notification events");
  }
}

export default withCsrfProtection(handler);
