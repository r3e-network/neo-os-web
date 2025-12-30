/**
 * API Protection Middleware for Auth0 v3
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { getSession } from "@auth0/nextjs-auth0";

export type ProtectedHandler = (
  req: NextApiRequest,
  res: NextApiResponse,
  user: Record<string, unknown>,
) => Promise<void> | void;

export function withAuth(handler: ProtectedHandler) {
  return async (req: NextApiRequest, res: NextApiResponse) => {
    const session = await getSession(req, res);
    if (!session?.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    return handler(req, res, session.user);
  };
}
