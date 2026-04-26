import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { requireMiniAppAdmin } from "@/lib/admin-auth";
import { listMiniAppBlueprints } from "@/lib/miniapp-admin";
import { standardLimit } from "@/lib/rate-limit";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }
  if (standardLimit(req, res)) return;

  const admin = await requireMiniAppAdmin(req, res);
  if (!admin) return;

  res.setHeader("Cache-Control", "no-store, private");
  res.status(200).json({
    blueprints: listMiniAppBlueprints(),
    actor: admin.kind,
  });
  return;
}
