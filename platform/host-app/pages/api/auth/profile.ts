import { getSession } from "@auth0/nextjs-auth0";
import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";

function hasAuth0Config(): boolean {
  return Boolean(
    process.env.AUTH0_SECRET &&
    process.env.AUTH0_BASE_URL &&
    process.env.AUTH0_ISSUER_BASE_URL &&
    process.env.AUTH0_CLIENT_ID &&
    process.env.AUTH0_CLIENT_SECRET,
  );
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }

  res.setHeader("Cache-Control", "no-store, private");

  if (!hasAuth0Config()) {
    res.status(204).end();
    return;
  }

  try {
    const session = await getSession(req, res);
    if (!session?.user) {
      res.status(204).end();
      return;
    }
    res.status(200).json(session.user);
    return;
  } catch {
    res.status(204).end();
    return;
  }
}
