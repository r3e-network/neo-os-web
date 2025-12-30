import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";

const CSRF_TOKEN_LENGTH = 32;
const CSRF_HEADER = "x-csrf-token";
const CSRF_COOKIE = "csrf-token";

/**
 * Generates a cryptographically secure CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
}

/**
 * Validates CSRF token from request headers against cookie
 */
export function validateCsrfToken(req: NextApiRequest): boolean {
  // Skip CSRF validation for GET, HEAD, OPTIONS (safe methods)
  if (["GET", "HEAD", "OPTIONS"].includes(req.method || "")) {
    return true;
  }

  const tokenFromHeader = req.headers[CSRF_HEADER] as string;
  const tokenFromCookie = req.cookies[CSRF_COOKIE];

  if (!tokenFromHeader || !tokenFromCookie) {
    return false;
  }

  // Use timing-safe comparison to prevent timing attacks
  return crypto.timingSafeEqual(Buffer.from(tokenFromHeader), Buffer.from(tokenFromCookie));
}

/**
 * Middleware to validate CSRF token for API routes
 */
export function withCsrfProtection(handler: (req: NextApiRequest, res: NextApiResponse) => Promise<void> | void) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    // Validate CSRF token
    if (!validateCsrfToken(req)) {
      return res.status(403).json({ error: "Invalid CSRF token" });
    }

    return handler(req, res);
  };
}

/**
 * Sets CSRF token cookie in response
 */
export function setCsrfCookie(res: NextApiResponse, token: string): void {
  res.setHeader(
    "Set-Cookie",
    `${CSRF_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Strict; Secure=${process.env.NODE_ENV === "production"}`,
  );
}
