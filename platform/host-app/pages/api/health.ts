import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return apiError.methodNotAllowed(res);
  }

  if (req.method === "HEAD") {
    res.status(200).end();
    return;
  }

  res.status(200).json({ status: "ok" });
}
