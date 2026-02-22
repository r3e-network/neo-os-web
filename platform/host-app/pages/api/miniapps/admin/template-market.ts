import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { requireMiniAppAdmin } from "@/lib/admin-auth";
import { standardLimit } from "@/lib/rate-limit";

const mockTemplates = {
  frontend: [
    {
      template_id: "prediction",
      version: "1.0.0",
      owner: "builtin",
      name: "Prediction Layout",
      category: "governance",
      usage_count: 21,
      verified: true,
    },
    {
      template_id: "defi",
      version: "1.0.0",
      owner: "builtin",
      name: "DeFi Layout",
      category: "defi",
      usage_count: 15,
      verified: true,
    },
  ],
  contract: [
    {
      template_id: "prediction-binary",
      version: "1.2.0",
      owner: "builtin",
      name: "Binary Prediction",
      category: "governance",
      usage_count: 18,
      verified: true,
    },
    {
      template_id: "lottery-scheduled",
      version: "1.0.0",
      owner: "builtin",
      name: "Scheduled Lottery",
      category: "gaming",
      usage_count: 9,
      verified: true,
    },
  ],
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }
  if (standardLimit(req, res)) return;

  const admin = await requireMiniAppAdmin(req, res);
  if (!admin) return;

  res.setHeader("Cache-Control", "no-store, private");
  return res.status(200).json({
    actor: admin.kind,
    templates: mockTemplates,
    note: "Temporary endpoint for template marketplace shape; switch to DB-backed catalog in next iteration.",
  });
}
