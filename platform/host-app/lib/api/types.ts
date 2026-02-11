/**
 * API Handler Factory — Type Definitions
 *
 * Shared types for the createHandler factory that eliminates
 * boilerplate across API routes (auth, rate limiting, validation, error handling).
 */

import type { NextApiRequest, NextApiResponse } from "next";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ZodSchema } from "zod";

/** Authentication strategy for the route. */
export type AuthMode = "wallet" | "admin" | "cron" | "none";

/** Rate limiter tier selection. */
export type RateLimitTier = "api" | "write" | "auth";

/**
 * Context object passed to every method handler.
 * `db` is always present; `address` is set when auth is "wallet".
 */
export interface HandlerContext {
  db: SupabaseClient;
  /** Verified Neo N3 wallet address. Present only when auth is "wallet". */
  address?: string;
  /** Zod-validated input (req.body for writes, req.query for reads). Only set when schema is provided. */
  parsedInput?: unknown;
}

/** Signature for individual HTTP method handlers. */
export type MethodHandler = (req: NextApiRequest, res: NextApiResponse, ctx: HandlerContext) => Promise<void> | void;

/**
 * Per-method configuration.
 * Allows overriding rate limit tier and attaching a Zod validation schema.
 */
export interface MethodConfig {
  handler: MethodHandler;
  /** Validates req.body for POST/PUT/PATCH, req.query for GET/DELETE. */
  schema?: ZodSchema;
  /** Override the route-level rate limit for this method. `false` disables. */
  rateLimit?: RateLimitTier | false;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/**
 * Top-level configuration for createHandler.
 */
export interface ApiHandlerConfig {
  /** Authentication strategy applied to all methods on this route. */
  auth: AuthMode;
  /**
   * Default rate limit tier for all methods.
   * Defaults to "api" for authenticated routes, disabled for "none".
   * Per-method config takes precedence.
   */
  rateLimit?: RateLimitTier | false;
  /** Map of HTTP methods to their handler or full config. */
  methods: Partial<Record<HttpMethod, MethodHandler | MethodConfig>>;
}
