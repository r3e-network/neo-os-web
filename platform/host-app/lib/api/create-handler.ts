/**
 * API Handler Factory
 *
 * Creates a Next.js API handler with standardized auth, rate limiting,
 * validation, and error handling. Eliminates per-route boilerplate.
 *
 * Usage:
 *   export default createHandler({
 *     auth: "wallet",
 *     methods: {
 *       GET: (req, res, ctx) => { ... },
 *       PUT: { handler: (req, res, ctx) => { ... }, schema: updateSchema },
 *     },
 *   });
 */

import type { NextApiRequest, NextApiResponse } from "next";
import { timingSafeEqual } from "crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { requireWalletAuth } from "@/lib/security/wallet-auth";
import { requireAdmin } from "@/lib/admin-auth";
import { apiRateLimiter, writeRateLimiter, authRateLimiter } from "@/lib/security/ratelimit";
import type { ApiHandlerConfig, HttpMethod, MethodHandler, MethodConfig, HandlerContext, RateLimitTier } from "./types";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WRITE_METHODS = new Set<HttpMethod>(["POST", "PUT", "PATCH", "DELETE"]);

/** Extract a stable client identifier (mirrors ratelimit.ts logic). */
function getClientKey(req: NextApiRequest): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") return forwarded.split(",")[0].trim();
  return req.socket?.remoteAddress ?? "unknown";
}

const rateLimiters = {
  api: apiRateLimiter,
  write: writeRateLimiter,
  auth: authRateLimiter,
} as const;

/** Normalize a method entry to the full MethodConfig shape. */
function normalizeMethod(entry: MethodHandler | MethodConfig): MethodConfig {
  return typeof entry === "function" ? { handler: entry } : entry;
}

/** Resolve which rate limiter to use (per-method override > route-level > default). */
function resolveRateLimitTier(
  methodTier: RateLimitTier | false | undefined,
  routeTier: RateLimitTier | false | undefined,
  authMode: string,
): RateLimitTier | false {
  if (methodTier !== undefined) return methodTier;
  if (routeTier !== undefined) return routeTier;
  return authMode === "none" ? false : "api";
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createHandler(config: ApiHandlerConfig) {
  const { auth, methods } = config;

  // Pre-compute allowed methods for the 405 Allow header.
  const allowedMethods = Object.keys(methods) as HttpMethod[];
  const allowHeader = allowedMethods.join(", ");

  async function handler(req: NextApiRequest, res: NextApiResponse) {
    try {
      // 1. Database availability
      if (!supabaseAdmin) {
        return res.status(503).json({ error: "Database not configured" });
      }

      // 2. Method check
      const method = req.method as HttpMethod;
      const entry = methods[method];
      if (!entry) {
        res.setHeader("Allow", allowHeader);
        return res.status(405).json({ error: `Method ${method} not allowed` });
      }

      const methodConfig = normalizeMethod(entry);

      // 3. Rate limiting
      const tier = resolveRateLimitTier(methodConfig.rateLimit, config.rateLimit, auth);
      if (tier !== false) {
        const limiter = rateLimiters[tier];
        const clientKey = getClientKey(req);
        const { allowed, remaining } = limiter.check(clientKey);
        res.setHeader("X-RateLimit-Remaining", String(remaining));
        if (!allowed) {
          res.setHeader("Retry-After", String(limiter.windowSec));
          return res.status(429).json({ error: "Too many requests" });
        }
      }

      // 4. Authentication
      const ctx: HandlerContext = { db: supabaseAdmin };

      if (auth === "wallet") {
        const result = requireWalletAuth(req.headers);
        if (!result.ok) {
          return res.status(result.status).json({ error: result.error });
        }
        ctx.address = result.address;
      } else if (auth === "admin") {
        const result = requireAdmin(req.headers);
        if (!result.ok) {
          return res.status(result.status).json({ error: result.error });
        }
      } else if (auth === "cron") {
        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
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
      }
      // auth === "none" — skip

      // 5. Input validation
      if (methodConfig.schema) {
        const input = WRITE_METHODS.has(method) ? req.body : req.query;
        const parsed = methodConfig.schema.safeParse(input);
        if (!parsed.success) {
          return res.status(400).json({
            error: "Validation failed",
            details: parsed.error.flatten().fieldErrors,
          });
        }
        ctx.parsedInput = parsed.data;
      }

      // 6. Execute handler
      return await methodConfig.handler(req, res, ctx);
    } catch (err) {
      logger.error("[API] " + req.url, err);
      if (!res.headersSent) {
        return res.status(500).json({ error: "Internal server error" });
      }
    }
  }

  return handler;
}
