import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { requireMiniAppAdmin } from "@/lib/admin-auth";
import { standardLimit } from "@/lib/rate-limit";

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (standardLimit(req, res)) return;

  if (String(req.method || "").toUpperCase() !== "POST") {
    return apiError.methodNotAllowed(res);
  }

  if (!(await requireMiniAppAdmin(req, res))) return;

  return apiError.forbidden(
    res,
    "TrustAnchor agent-return is deprecated. PlatformAnchor only supports user-witnessed stake withdrawal and vote-only admin updates.",
  );
}
