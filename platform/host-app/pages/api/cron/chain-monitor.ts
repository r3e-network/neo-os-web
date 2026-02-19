import type { NextApiRequest, NextApiResponse } from "next";
import { timingSafeEqual } from "crypto";
import { checkChainStatus, sendChainAlerts } from "@/lib/chain/monitor";
import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return apiError.methodNotAllowed(res);
  }

  // Verify cron secret (timing-safe to prevent oracle attacks)
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return apiError.unauthorized(res, "Unauthorized");
  }
  const authHeader = String(req.headers.authorization || "");
  const expected = `Bearer ${cronSecret}`;
  if (authHeader.length !== expected.length || !timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected))) {
    return apiError.unauthorized(res, "Unauthorized");
  }

  try {
    const results = {
      testnet: await checkAndAlert("testnet"),
      mainnet: await checkAndAlert("mainnet"),
    };

    return res.status(200).json({ success: true, results });
  } catch (err) {
    logger.error("Monitor check failed:", err instanceof Error ? err.message : "unknown error");
    return apiError.internal(res, "Monitor check failed");
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
