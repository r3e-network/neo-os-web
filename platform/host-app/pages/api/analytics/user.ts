import { apiError } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import { standardLimit } from "@/lib/rate-limit";
import {
  getServerSupabaseClient,
  hasServiceRoleSupabase,
} from "@/lib/server-supabase";
import {
  isValidWalletAddress,
  resolveUserIdFromWallet,
} from "@/lib/wallet-user";
import { requireWalletAuth } from "@/lib/require-wallet-auth";
import type { NextApiRequest, NextApiResponse } from "next";
import { loadMiniAppCatalog } from "@/lib/miniapp-catalog";

export interface UserAnalytics {
  wallet: string;
  summary: {
    totalTx: number;
    totalVolume: string;
    appsUsed: number;
    firstActivity: string;
    lastActivity: string;
  };
  activity: ActivityItem[];
  appBreakdown: AppUsage[];
}

interface ActivityItem {
  date: string;
  txCount: number;
  volume: string;
}

interface AppUsage {
  appId: string;
  appName: string;
  txCount: number;
  volume: string;
  lastUsed: string;
}

const GAS_DIVISOR = 100000000;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (standardLimit(req, res)) return;
  if (req.method !== "GET") {
    return apiError.methodNotAllowed(res);
  }

  const { wallet } = req.query;
  if (!wallet || typeof wallet !== "string" || !isValidWalletAddress(wallet)) {
    return apiError.badRequest(res, "Wallet address required");
  }

  let authedWallet: string | null;
  try {
    authedWallet = await requireWalletAuth(req, res);
  } catch (err) {
    logger.error(
      "requireWalletAuth error:",
      err instanceof Error ? err.message : String(err),
    );
    return apiError.internal(res, "Authentication failed");
  }
  if (!authedWallet) return;
  if (wallet !== authedWallet) {
    return apiError.forbidden(res, "Wallet mismatch");
  }

  if (!hasServiceRoleSupabase()) {
    res.status(200).json(emptyAnalytics(wallet));
    return;
  }

  const supabase = getServerSupabaseClient({ requireServiceRole: true });
  if (!supabase) {
    res.status(200).json(emptyAnalytics(wallet));
    return;
  }

  try {
    const [catalog, txResponse] = await Promise.all([
      loadMiniAppCatalog("active"),
      supabase
        .from("miniapp_tx_events")
        .select("app_id,event_date,block_time")
        .ilike("sender_address", wallet)
        .order("block_time", { ascending: false })
        .limit(10000),
    ]);

    if (txResponse.error) {
      logger.error(
        "Failed to fetch user tx analytics:",
        txResponse.error.message,
      );
      return apiError.internal(res, "Failed to fetch analytics");
    }

    const appNameById = new Map<string, string>();
    for (const app of catalog) {
      appNameById.set(app.app_id, app.name);
    }

    const txRows = txResponse.data || [];
    const userId = await resolveUserIdFromWallet(supabase, wallet, {
      createIfMissing: false,
    });
    const usageRows = userId
      ? (
          await supabase
            .from("miniapp_usage")
            .select("app_id,usage_date,gas_used,tx_count")
            .eq("user_id", userId)
            .order("usage_date", { ascending: false })
            .limit(5000)
        ).data || []
      : [];

    const txByDate = new Map<string, number>();
    const txByApp = new Map<string, { txCount: number; lastUsed: string }>();
    let firstTxAt: string | null = null;
    let lastTxAt: string | null = null;

    for (const row of txRows) {
      const day = String(row.event_date || "");
      if (day) {
        txByDate.set(day, (txByDate.get(day) || 0) + 1);
      }

      const appId = String(row.app_id || "");
      if (appId) {
        const lastUsed = String(row.block_time || "");
        const current = txByApp.get(appId) || { txCount: 0, lastUsed };
        current.txCount += 1;
        if (
          !current.lastUsed ||
          (lastUsed &&
            new Date(lastUsed).getTime() > new Date(current.lastUsed).getTime())
        ) {
          current.lastUsed = lastUsed;
        }
        txByApp.set(appId, current);
      }

      const blockTime = String(row.block_time || "");
      if (blockTime) {
        if (
          !lastTxAt ||
          new Date(blockTime).getTime() > new Date(lastTxAt).getTime()
        ) {
          lastTxAt = blockTime;
        }
        if (
          !firstTxAt ||
          new Date(blockTime).getTime() < new Date(firstTxAt).getTime()
        ) {
          firstTxAt = blockTime;
        }
      }
    }

    const gasByDate = new Map<string, number>();
    const gasByApp = new Map<string, number>();
    let totalGasRaw = 0;
    let firstUsageAt: string | null = null;
    let lastUsageAt: string | null = null;

    for (const row of usageRows) {
      const day = String(row.usage_date || "");
      const gasRaw = Number(row.gas_used || 0);
      totalGasRaw += gasRaw;

      if (day) {
        gasByDate.set(day, (gasByDate.get(day) || 0) + gasRaw);
        const dayISO = `${day}T00:00:00.000Z`;
        if (
          !lastUsageAt ||
          new Date(dayISO).getTime() > new Date(lastUsageAt).getTime()
        ) {
          lastUsageAt = dayISO;
        }
        if (
          !firstUsageAt ||
          new Date(dayISO).getTime() < new Date(firstUsageAt).getTime()
        ) {
          firstUsageAt = dayISO;
        }
      }

      const appId = String(row.app_id || "");
      if (appId) {
        gasByApp.set(appId, (gasByApp.get(appId) || 0) + gasRaw);
      }
    }

    const activity: ActivityItem[] = [];
    for (let i = 29; i >= 0; i--) {
      const dayDate = new Date(Date.now() - i * 86400000);
      const key = dayDate.toISOString().slice(0, 10);
      const txCount = txByDate.get(key) || 0;
      const volume = (gasByDate.get(key) || 0) / GAS_DIVISOR;
      activity.push({
        date: key,
        txCount,
        volume: volume.toFixed(2),
      });
    }

    const appIds = new Set<string>([
      ...Array.from(txByApp.keys()),
      ...Array.from(gasByApp.keys()),
    ]);
    const appBreakdown: AppUsage[] = Array.from(appIds)
      .map((appId) => {
        const txInfo = txByApp.get(appId) || { txCount: 0, lastUsed: "" };
        const gas = (gasByApp.get(appId) || 0) / GAS_DIVISOR;
        const lastUsed =
          txInfo.lastUsed || lastUsageAt || new Date().toISOString();
        return {
          appId,
          appName: appNameById.get(appId) || appId,
          txCount: txInfo.txCount,
          volume: gas.toFixed(2),
          lastUsed,
        };
      })
      .sort(
        (a, b) =>
          b.txCount - a.txCount || parseFloat(b.volume) - parseFloat(a.volume),
      );

    const firstActivity = firstTxAt || firstUsageAt || new Date().toISOString();
    const lastActivity = lastTxAt || lastUsageAt || firstActivity;
    const totalTx = txRows.length;

    const analytics: UserAnalytics = {
      wallet,
      summary: {
        totalTx,
        totalVolume: (totalGasRaw / GAS_DIVISOR).toFixed(2),
        appsUsed: appBreakdown.length,
        firstActivity,
        lastActivity,
      },
      activity,
      appBreakdown,
    };

    res.setHeader("Cache-Control", "no-store, private");
    res.status(200).json(analytics);
    return;
  } catch (error) {
    logger.error(
      "User analytics API failed:",
      error instanceof Error ? error.message : "unknown error",
    );
    return apiError.internal(res, "Failed to fetch analytics");
  }
}

function emptyAnalytics(wallet: string): UserAnalytics {
  const now = new Date();
  const activity: ActivityItem[] = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 86400000);
    activity.push({
      date: date.toISOString().split("T")[0],
      txCount: 0,
      volume: "0.00",
    });
  }

  return {
    wallet,
    summary: {
      totalTx: 0,
      totalVolume: "0.00",
      appsUsed: 0,
      firstActivity: now.toISOString(),
      lastActivity: now.toISOString(),
    },
    activity,
    appBreakdown: [],
  };
}
