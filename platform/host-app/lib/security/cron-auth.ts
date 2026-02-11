/**
 * Cron Authentication Middleware (DEPRECATED)
 *
 * @deprecated Use `createHandler({ auth: "cron" })` from `@/lib/api` instead.
 * This HOF is superseded by the createHandler factory which provides
 * unified auth, rate limiting, and validation. Retained for backward compatibility.
 *
 * Validates Bearer token against CRON_SECRET for all cron endpoints.
 * SECURITY: Always enforces auth in production. Missing CRON_SECRET = 500.
 */

import type { NextApiRequest, NextApiResponse, NextApiHandler } from "next";
import { timingSafeEqual } from "crypto";

export function withCronAuth(handler: NextApiHandler): NextApiHandler {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const cronSecret = process.env.CRON_SECRET;

    // SECURITY: CRON_SECRET must be configured in production
    if (!cronSecret) {
      console.error("[CronAuth] CRON_SECRET not configured");
      return res.status(500).json({ error: "Cron authentication not configured" });
    }

    const authHeader = req.headers.authorization ?? "";
    const expectedHeader = `Bearer ${cronSecret}`;
    if (
      authHeader.length !== expectedHeader.length ||
      !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedHeader))
    ) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    return handler(req, res);
  };
}
