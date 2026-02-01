import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    res.status(405).end();
    return;
  }

  if (req.method === "HEAD") {
    res.status(200).end();
    return;
  }

  res.status(200).json({ status: "ok" });
}
