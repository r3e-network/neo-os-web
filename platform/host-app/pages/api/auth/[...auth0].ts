import { handleAuth, handleCallback, Session } from "@auth0/nextjs-auth0";
import type { NextApiRequest, NextApiResponse } from "next";

export default handleAuth({
  callback: handleCallback({
    afterCallback: async (
      _req: NextApiRequest,
      _res: NextApiResponse,
      session: Session,
    ) => {
      if (session?.user?.sub) {
        const edgeUrl =
          process.env.SUPABASE_EDGE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey = process.env.SERVICE_AUTH_KEY;
        if (edgeUrl && serviceKey) {
          try {
            await fetch(`${edgeUrl}/functions/v1/auth-social-sync`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-Service-Key": serviceKey,
              },
              body: JSON.stringify({
                sub: session.user.sub,
                email: session.user.email,
                name: session.user.name,
                avatar: session.user.picture,
              }),
              signal: AbortSignal.timeout(10000),
            });
          } catch (e) {
            // Best-effort sync - don't block login on failure
            console.warn(
              "[auth0] social sync failed:",
              e instanceof Error ? e.message : String(e),
            );
          }
        }
      }
      return session;
    },
  }),
});
