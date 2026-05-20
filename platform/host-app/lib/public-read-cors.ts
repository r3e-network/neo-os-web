import type { NextApiRequest, NextApiResponse } from "next";

export function handlePublicReadCors(
  req: NextApiRequest,
  res: NextApiResponse,
): boolean {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }

  return false;
}
