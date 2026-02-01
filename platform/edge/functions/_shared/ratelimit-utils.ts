/**
 * Standardized rate limit handling utilities for edge functions.
 * Provides consistent rate limit response formatting and retry-after headers.
 */

import { json } from "./response.ts";

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfter: number;
}

/**
 * Creates standardized rate limit headers.
 */
export function createRateLimitHeaders(info: RateLimitInfo): Headers {
  const headers = new Headers();
  headers.set("X-RateLimit-Limit", String(info.limit));
  headers.set("X-RateLimit-Remaining", String(Math.max(0, info.remaining)));
  headers.set("X-RateLimit-Reset", String(info.resetAt));
  headers.set("Retry-After", String(info.retryAfter));
  return headers;
}

/**
 * Creates a standardized rate limit exceeded response.
 */
export function rateLimitExceededResponse(
  req: Request,
  info: RateLimitInfo,
  endpoint: string,
): Response {
  const headers = createRateLimitHeaders(info);
  
  return json(
    {
      error: {
        code: "RATE_LIMITED",
        message: `Rate limit exceeded for ${endpoint}`,
        details: {
          limit: info.limit,
          remaining: 0,
          reset_at: info.resetAt,
          retry_after_seconds: info.retryAfter,
        },
      },
    },
    { status: 429, headers },
    req,
  );
}

/**
 * Adds rate limit info headers to a successful response.
 */
export function addRateLimitHeaders(
  response: Response,
  info: RateLimitInfo,
): Response {
  const headers = new Headers(response.headers);
  headers.set("X-RateLimit-Limit", String(info.limit));
  headers.set("X-RateLimit-Remaining", String(info.remaining));
  headers.set("X-RateLimit-Reset", String(info.resetAt));
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
