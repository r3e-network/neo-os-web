import type { NextApiRequest, NextApiResponse } from "next";

export function handlePublicReadCors(
  req: NextApiRequest,
  res: NextApiResponse,
  options: { methods?: readonly string[] } = {},
): boolean {
  const methods = Array.from(
    new Set([
      ...(options.methods ?? ["GET"]).map((method) => method.toUpperCase()),
      "OPTIONS",
    ]),
  );
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", methods.join(","));
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return true;
  }

  return false;
}
