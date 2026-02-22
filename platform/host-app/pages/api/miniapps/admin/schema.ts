import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { requireMiniAppAdmin } from "@/lib/admin-auth";
import { standardLimit } from "@/lib/rate-limit";
import schema from "@/public/miniapp-definitions/miniapp-config.schema.json";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }
  if (standardLimit(req, res)) return;

  const admin = await requireMiniAppAdmin(req, res);
  if (!admin) return;

  res.setHeader("Cache-Control", "no-store, private");
  return res.status(200).json({
    schema,
    actor: admin.kind,
  });
}
