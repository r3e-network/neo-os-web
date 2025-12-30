import type { NextApiRequest, NextApiResponse } from "next";

// Check if Auth0 is configured
const isAuth0Configured = Boolean(
  process.env.AUTH0_SECRET &&
  process.env.AUTH0_BASE_URL &&
  process.env.AUTH0_ISSUER_BASE_URL &&
  process.env.AUTH0_CLIENT_ID &&
  process.env.AUTH0_CLIENT_SECRET,
);

// Graceful fallback when Auth0 is not configured
function fallbackHandler(req: NextApiRequest, res: NextApiResponse) {
  const route = req.query.auth0?.[0];

  if (route === "me") {
    // Return null user when not configured
    return res.status(200).json(null);
  }

  if (route === "login" || route === "logout" || route === "callback") {
    // Redirect to home for auth routes
    return res.redirect("/");
  }

  return res.status(404).json({ error: "Auth not configured" });
}

// Lazy load handleAuth only when Auth0 is configured
let auth0Handler: ReturnType<typeof import("@auth0/nextjs-auth0").handleAuth> | null = null;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAuth0Configured) {
    return fallbackHandler(req, res);
  }

  // Lazy initialize Auth0 handler
  if (!auth0Handler) {
    const { handleAuth } = await import("@auth0/nextjs-auth0");
    auth0Handler = handleAuth();
  }

  return auth0Handler(req, res);
}
