import type { NextApiRequest, NextApiResponse } from "next";
import { checkChainStatus, sendChainAlerts } from "@/lib/chain/monitor";
import { apiError } from "@/lib/api-response";

// Cron secret for authentication
const CRON_SECRET = process.env.CRON_SECRET;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return apiError.methodNotAllowed(res);
  }

  // Verify cron secret
  const authHeader = req.headers.authorization;
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return apiError.unauthorized(res, "Unauthorized");
  }

  try {
    const results = {
      testnet: await checkAndAlert("testnet"),
      mainnet: await checkAndAlert("mainnet"),
    };

    return res.status(200).json({ success: true, results });
  } catch (err) {
    return apiError.internal(res, `Monitor check failed: ${err instanceof Error ? err.message : "Unknown"}`);
  }
}

async function checkAndAlert(network: "testnet" | "mainnet") {
  const status = await checkChainStatus(network);
  let alertsSent = 0;

  if (status.status !== "healthy") {
    alertsSent = await sendChainAlerts(status);
  }

  return {
    network,
    status: status.status,
    blockHeight: status.blockHeight,
    timeSinceBlock: status.timeSinceBlock,
    alerts: status.alerts,
    alertsSent,
  };
}
