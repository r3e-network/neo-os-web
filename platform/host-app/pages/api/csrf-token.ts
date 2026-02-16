import type { NextApiRequest, NextApiResponse } from "next";
import { generateCsrfToken, setCsrfCookie } from "@/lib/csrf";
import { apiError } from "@/lib/api-response";
import { standardLimit } from "@/lib/rate-limit";

/**
 * GET /api/csrf-token
 * Returns a CSRF token and sets it as an HttpOnly cookie
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }
  if (standardLimit(req, res)) return;

  const token = generateCsrfToken();
  setCsrfCookie(res, token);

  return res.status(200).json({ csrfToken: token });
}
