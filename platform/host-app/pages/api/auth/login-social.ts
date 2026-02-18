import type { NextApiRequest, NextApiResponse } from "next";

const connectionMap: Record<string, string> = {
  google: "google-oauth2",
  twitter: "twitter",
  github: "github",
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method not allowed" });
    return;
  }
  const provider = (req.query.provider as string) || "";
  const connection = connectionMap[provider];
  if (!connection) {
    res.status(400).json({ error: "invalid provider" });
    return;
  }
  res.redirect(`/api/auth/login?connection=${connection}`);
}
