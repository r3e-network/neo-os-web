import type { NextApiRequest, NextApiResponse } from "next";
import { timingSafeEqual } from "crypto";
import { apiError } from "@/lib/api-response";
import { loadMiniAppDefinitions } from "@/lib/miniapp-definitions";
import {
  evaluateCountdownLifecycleTarget,
  findCountdownLifecycleApps,
  type CountdownLifecycleInvoke,
  type LifecycleNetwork,
} from "@/lib/miniapp-lifecycle";
import { logger } from "@/lib/logger";

type LifecycleSubmitResult = {
  submitted: boolean;
  txid?: string;
  error?: string;
  skippedReason?: string;
};

type LifecycleApiResult = {
  appId: string;
  contractHash: string;
  decision: Awaited<ReturnType<typeof evaluateCountdownLifecycleTarget>>["decision"];
  invoke: CountdownLifecycleInvoke | null;
} & LifecycleSubmitResult;

function isAuthorized(req: NextApiRequest): boolean {
  const cronSecret = String(process.env.CRON_SECRET || "");
  const authHeader = String(req.headers.authorization || "");
  const expected = `Bearer ${cronSecret}`;
  return Boolean(cronSecret)
    && authHeader.length === expected.length
    && timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}

function getNetwork(value: unknown): LifecycleNetwork {
  return String(value || "").toLowerCase() === "mainnet" ? "mainnet" : "testnet";
}

function getDryRun(value: unknown): boolean {
  const raw = String(value ?? "").trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

async function submitLifecycleInvoke(
  network: LifecycleNetwork,
  invoke: CountdownLifecycleInvoke,
): Promise<LifecycleSubmitResult> {
  const relayerUrl = String(process.env.MINIAPP_LIFECYCLE_RELAYER_URL || "").trim();
  if (!relayerUrl) {
    return {
      submitted: false,
      skippedReason: "MINIAPP_LIFECYCLE_RELAYER_URL is not configured",
    };
  }

  const response = await fetch(relayerUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.MINIAPP_LIFECYCLE_RELAYER_TOKEN || ""}`,
    },
    body: JSON.stringify({
      network,
      scriptHash: invoke.scriptHash,
      operation: invoke.operation,
      args: invoke.args,
      reason: "miniapp-countdown-lifecycle",
    }),
    signal: AbortSignal.timeout(15000),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      submitted: false,
      error: typeof payload?.error === "string" ? payload.error : `relayer returned ${response.status}`,
    };
  }
  return {
    submitted: true,
    txid: String(payload?.txid || payload?.hash || ""),
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== "GET" && req.method !== "POST") {
    return apiError.methodNotAllowed(res);
  }
  if (!isAuthorized(req)) {
    return apiError.unauthorized(res, "Unauthorized");
  }

  const network = getNetwork(req.query.network ?? req.body?.network);
  const dryRun = getDryRun(req.query.dry_run ?? req.body?.dry_run);

  try {
    const apps = await loadMiniAppDefinitions();
    const targets = findCountdownLifecycleApps(apps, network);
    const evaluated = await Promise.all(targets.map(evaluateCountdownLifecycleTarget));
    const results: LifecycleApiResult[] = [];

    for (const item of evaluated) {
      if (!item.invoke || dryRun) {
        results.push({
          appId: item.appId,
          contractHash: item.contractHash,
          decision: item.decision,
          invoke: item.invoke,
          submitted: false,
          skippedReason: dryRun && item.invoke ? "dry_run" : undefined,
        });
        continue;
      }

      const submitted = await submitLifecycleInvoke(network, item.invoke);
      results.push({
        appId: item.appId,
        contractHash: item.contractHash,
        decision: item.decision,
        invoke: item.invoke,
        ...submitted,
      });
    }

    res.status(200).json({
      success: true,
      network,
      dryRun,
      targetCount: targets.length,
      actionCount: results.filter((result) => Boolean(result.invoke)).length,
      submittedCount: results.filter((result) => result.submitted).length,
      results,
      timestamp: new Date().toISOString(),
    });
    return;
  } catch (error) {
    logger.error(
      "[miniapp-lifecycle] cron failed:",
      error instanceof Error ? error.message : String(error),
    );
    return apiError.internal(res, "MiniApp lifecycle cron failed");
  }
}
