import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { standardLimit } from "@/lib/rate-limit";

const connectionMap: Record<string, string> = {
  google: "google-oauth2",
  twitter: "twitter",
  github: "github",
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }
  if (standardLimit(req, res)) return;
  const provider = (req.query.provider as string) || "";
  const connection = connectionMap[provider];
  if (!connection) {
    return apiError.badRequest(res, "invalid provider");
  }
  res.redirect(`/api/auth/login?connection=${connection}`);
}
