import type { NextApiRequest, NextApiResponse } from "next";
import { apiError } from "@/lib/api-response";
import { requireMiniAppAdmin } from "@/lib/admin-auth";
import { standardLimit } from "@/lib/rate-limit";
import { listMiniAppBlueprints } from "@/lib/miniapp-admin";

const contractTemplateCatalog = [
  {
    template_id: "prediction-binary",
    name: "Prediction Binary",
    category: "governance",
    version: "1.0.0",
    parameters: [
      { key: "oracle", type: "hash160", required: true },
      { key: "settlement_timestamp", type: "integer", required: true },
      { key: "fee_bps", type: "integer", required: false },
    ],
  },
  {
    template_id: "lottery-scheduled",
    name: "Lottery Scheduled",
    category: "gaming",
    version: "1.0.0",
    parameters: [
      { key: "ticket_price", type: "amount", required: true },
      { key: "draw_interval", type: "integer", required: true },
      { key: "max_tickets_per_user", type: "integer", required: false },
    ],
  },
  {
    template_id: "utility-gas-sponsor",
    name: "Gas Sponsor",
    category: "utility",
    version: "1.0.0",
    parameters: [
      { key: "max_sponsorship_per_tx", type: "amount", required: true },
      { key: "daily_limit", type: "amount", required: true },
      { key: "whitelist_enabled", type: "boolean", required: false },
    ],
  },
];

const frontendTemplateCatalog = [
  {
    template_id: "default",
    name: "Default Detail",
    category: "utility",
    layout: "default",
    version: "1.0.0",
  },
  {
    template_id: "prediction",
    name: "Prediction Detail",
    category: "governance",
    layout: "prediction",
    version: "1.0.0",
  },
  {
    template_id: "gaming",
    name: "Gaming Detail",
    category: "gaming",
    layout: "default",
    version: "1.0.0",
  },
  {
    template_id: "defi",
    name: "DeFi Detail",
    category: "defi",
    layout: "default",
    version: "1.0.0",
  },
  {
    template_id: "nft",
    name: "NFT Detail",
    category: "nft",
    layout: "default",
    version: "1.0.0",
  },
];

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
    actor: admin.kind,
    frontend_templates: frontendTemplateCatalog,
    contract_templates: contractTemplateCatalog,
    blueprints: listMiniAppBlueprints(),
    note: "This endpoint is the backend-driven catalog source for a future visual miniapp/template builder and template marketplace.",
  });
  return;
}
