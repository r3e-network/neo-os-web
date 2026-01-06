import type { NextApiRequest, NextApiResponse } from "next";

// Verify Auth0 is configured at startup
const isAuth0Configured = Boolean(
  process.env.AUTH0_SECRET &&
  process.env.AUTH0_BASE_URL &&
  process.env.AUTH0_ISSUER_BASE_URL &&
  process.env.AUTH0_CLIENT_ID &&
  process.env.AUTH0_CLIENT_SECRET,
);

if (!isAuth0Configured) {
  console.error(
    "Auth0 environment variables are required. " +
      "Please set AUTH0_SECRET, AUTH0_BASE_URL, AUTH0_ISSUER_BASE_URL, AUTH0_CLIENT_ID, AUTH0_CLIENT_SECRET.",
  );
}

// Lazy load handleAuth
let auth0Handler: ReturnType<typeof import("@auth0/nextjs-auth0").handleAuth> | null = null;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isAuth0Configured) {
    return res.status(503).json({
      error: "Auth0 not configured",
      message: "Authentication service is not available. Please configure Auth0 environment variables.",
    });
  }

  // Lazy initialize Auth0 handler
  if (!auth0Handler) {
    const { handleAuth } = await import("@auth0/nextjs-auth0");
    auth0Handler = handleAuth();
  }

  return auth0Handler(req, res);
}
