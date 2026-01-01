/**
 * API middleware utilities
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { apiRateLimiter } from "@/lib/security/ratelimit";

type Handler = (req: NextApiRequest, res: NextApiResponse) => Promise<void>;

export function withRateLimit(handler: Handler): Handler {
  return async (req, res) => {
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
    const key = typeof ip === "string" ? ip : ip[0];

    const { allowed, remaining } = apiRateLimiter.check(key);

    res.setHeader("X-RateLimit-Remaining", remaining.toString());

    if (!allowed) {
      return res.status(429).json({ error: "Too many requests" });
    }

    return handler(req, res);
  };
}
