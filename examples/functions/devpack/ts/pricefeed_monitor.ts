/**
 * Price Feed Monitor Example
 *
 * This function monitors price feeds and triggers alerts when:
 * 1. Price deviates significantly from previous value
 * 2. Feed becomes stale (no updates within heartbeat interval)
 * 3. Price crosses defined thresholds
 *
 * Designed to run on a schedule via automation.
 *
 * Params:
 *   - feedId: Price feed ID to monitor
 *   - alertThreshold: Deviation % to trigger alert (default: 10%)
 *   - staleMinutes: Minutes without update to consider stale (default: 60)
 *   - priceFloor: Optional minimum price threshold
 *   - priceCeiling: Optional maximum price threshold
 *   - webhookUrl: Optional webhook for alert notifications
 *
 * Secrets:
 *   - webhookSecret: Secret for webhook authentication
 */

interface MonitorParams {
  feedId: string;
  alertThreshold?: number;
  staleMinutes?: number;
  priceFloor?: number;
  priceCeiling?: number;
  webhookUrl?: string;
}

interface Alert {
  type: "deviation" | "stale" | "floor_breach" | "ceiling_breach";
  message: string;
  severity: "warning" | "critical";
  data: Record<string, unknown>;
}

interface DevpackResponse {
  success: boolean;
  data: Record<string, unknown>;
  meta: Record<string, unknown> | null;
}

function minutesSince(timestamp: string): number {
  const then = new Date(timestamp).getTime();
  const now = Date.now();
  return (now - then) / 60000;
}

export default function (
  params: MonitorParams,
  secrets: { webhookSecret?: string }
): DevpackResponse {
  const {
    feedId,
    alertThreshold = 10.0,
    staleMinutes = 60,
    priceFloor,
    priceCeiling,
    webhookUrl,
  } = params;

  if (!feedId) {
    return {
      success: false,
      data: { error: "feedId is required" },
      meta: null,
    };
  }

  const alerts: Alert[] = [];

  // Get feed info and recent snapshots via HTTP action
  const feedResult = Devpack.http.request({
    url: `${Devpack.env.API_URL}/pricefeeds/${feedId}`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${Devpack.env.API_TOKEN}`,
    },
  });

  if (!feedResult || feedResult.status !== 200) {
    return {
      success: false,
      data: { error: "failed to fetch feed info", result: feedResult },
      meta: null,
    };
  }

  const feed = feedResult.body;

  // Get recent snapshots
  const snapshotsResult = Devpack.http.request({
    url: `${Devpack.env.API_URL}/pricefeeds/${feedId}/snapshots?limit=10`,
    method: "GET",
    headers: {
      Authorization: `Bearer ${Devpack.env.API_TOKEN}`,
    },
  });

  const snapshots = snapshotsResult?.body || [];

  if (snapshots.length === 0) {
    alerts.push({
      type: "stale",
      message: "No price data available for feed",
      severity: "critical",
      data: { feedId, pair: feed.Pair },
    });
  } else {
    const latest = snapshots[0];
    const currentPrice = latest.Price;
    const lastUpdate = latest.CollectedAt;

    // Check for stale data
    const minutesAgo = minutesSince(lastUpdate);
    if (minutesAgo > staleMinutes) {
      alerts.push({
        type: "stale",
        message: `Feed has not updated in ${Math.round(minutesAgo)} minutes`,
        severity: minutesAgo > staleMinutes * 2 ? "critical" : "warning",
        data: {
          feedId,
          pair: feed.Pair,
          lastUpdate,
          minutesSinceUpdate: Math.round(minutesAgo),
          threshold: staleMinutes,
        },
      });
    }

    // Check for significant deviation from previous
    if (snapshots.length >= 2) {
      const previousPrice = snapshots[1].Price;
      const deviation =
        Math.abs((currentPrice - previousPrice) / previousPrice) * 100;

      if (deviation >= alertThreshold) {
        alerts.push({
          type: "deviation",
          message: `Price changed by ${deviation.toFixed(2)}%`,
          severity: deviation >= alertThreshold * 2 ? "critical" : "warning",
          data: {
            feedId,
            pair: feed.Pair,
            currentPrice,
            previousPrice,
            deviationPercent: deviation.toFixed(2),
            threshold: alertThreshold,
          },
        });
      }
    }

    // Check floor breach
    if (priceFloor !== undefined && currentPrice < priceFloor) {
      alerts.push({
        type: "floor_breach",
        message: `Price ${currentPrice} below floor ${priceFloor}`,
        severity: "critical",
        data: {
          feedId,
          pair: feed.Pair,
          currentPrice,
          floor: priceFloor,
        },
      });
    }

    // Check ceiling breach
    if (priceCeiling !== undefined && currentPrice > priceCeiling) {
      alerts.push({
        type: "ceiling_breach",
        message: `Price ${currentPrice} above ceiling ${priceCeiling}`,
        severity: "critical",
        data: {
          feedId,
          pair: feed.Pair,
          currentPrice,
          ceiling: priceCeiling,
        },
      });
    }
  }

  // Send webhook notifications if configured
  if (webhookUrl && alerts.length > 0) {
    const criticalAlerts = alerts.filter((a) => a.severity === "critical");

    Devpack.http.request({
      url: webhookUrl,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Secret": secrets.webhookSecret || "",
      },
      body: JSON.stringify({
        feedId,
        pair: feed?.Pair,
        alertCount: alerts.length,
        criticalCount: criticalAlerts.length,
        alerts,
        timestamp: new Date().toISOString(),
      }),
    });
  }

  return {
    success: true,
    data: {
      feedId,
      pair: feed?.Pair,
      active: feed?.Active,
      alertCount: alerts.length,
      criticalAlerts: alerts.filter((a) => a.severity === "critical").length,
      warningAlerts: alerts.filter((a) => a.severity === "warning").length,
      alerts,
      latestPrice: snapshots.length > 0 ? snapshots[0].Price : null,
      latestUpdate: snapshots.length > 0 ? snapshots[0].CollectedAt : null,
    },
    meta: {
      timestamp: new Date().toISOString(),
      webhookSent: webhookUrl && alerts.length > 0,
    },
  };
}
