import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { standardLimit } from "@/lib/rate-limit";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return apiError.methodNotAllowed(res);
  }

  if (standardLimit(req, res)) return;

  if (req.method === "HEAD") {
    res.status(200).end();
    return;
  }

  res.setHeader("Cache-Control", "s-maxage=10, stale-while-revalidate=30");
  res.status(200).json({ status: "ok" });
  return;
}
