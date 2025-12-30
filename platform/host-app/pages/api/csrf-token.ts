import type { NextApiRequest, NextApiResponse } from "next";
import { generateCsrfToken, setCsrfCookie } from "@/lib/csrf";

/**
 * GET /api/csrf-token
 * Returns a CSRF token and sets it as an HttpOnly cookie
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const token = generateCsrfToken();
  setCsrfCookie(res, token);

  return res.status(200).json({ csrfToken: token });
}
