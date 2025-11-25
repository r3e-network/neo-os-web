/**
 * Price Feed Aggregator Example
 *
 * This function demonstrates a complete price feed workflow:
 * 1. Fetch prices from multiple oracle sources
 * 2. Validate and filter outliers
 * 3. Submit aggregated observation to a price feed
 *
 * Params:
 *   - feedId: Target price feed ID
 *   - sources: Array of oracle data source IDs
 *   - outlierThreshold: Maximum deviation from median to consider valid (default: 5%)
 *
 * Secrets:
 *   - apiToken: Service Layer API token
 */

interface PriceFeedParams {
  feedId: string;
  sources: string[];
  outlierThreshold?: number;
}

interface OraclePrice {
  sourceId: string;
  price: number;
  timestamp: string;
}

interface DevpackResponse {
  success: boolean;
  data: Record<string, unknown>;
  meta: Record<string, unknown> | null;
}

// Calculate median of an array of numbers
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Filter outliers based on deviation from median
function filterOutliers(
  prices: OraclePrice[],
  threshold: number
): OraclePrice[] {
  if (prices.length === 0) return [];

  const values = prices.map((p) => p.price);
  const med = median(values);

  return prices.filter((p) => {
    const deviation = Math.abs((p.price - med) / med) * 100;
    return deviation <= threshold;
  });
}

export default function (
  params: PriceFeedParams,
  secrets: { apiToken: string }
): DevpackResponse {
  const { feedId, sources, outlierThreshold = 5.0 } = params;

  if (!feedId) {
    return {
      success: false,
      data: { error: "feedId is required" },
      meta: null,
    };
  }

  if (!sources || sources.length === 0) {
    return {
      success: false,
      data: { error: "at least one source is required" },
      meta: null,
    };
  }

  // Fetch prices from all oracle sources
  const prices: OraclePrice[] = [];
  const errors: string[] = [];

  for (const sourceId of sources) {
    try {
      // Queue oracle request for each source
      const result = Devpack.oracle.request({
        dataSourceId: sourceId,
        payload: JSON.stringify({ action: "get_price" }),
      });

      if (result && result.price) {
        prices.push({
          sourceId,
          price: parseFloat(result.price),
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      errors.push(`${sourceId}: ${err}`);
    }
  }

  if (prices.length === 0) {
    return {
      success: false,
      data: {
        error: "no valid prices collected",
        errors,
      },
      meta: null,
    };
  }

  // Filter outliers
  const validPrices = filterOutliers(prices, outlierThreshold);

  if (validPrices.length === 0) {
    return {
      success: false,
      data: {
        error: "all prices filtered as outliers",
        original: prices,
        threshold: outlierThreshold,
      },
      meta: null,
    };
  }

  // Calculate aggregated price (median)
  const aggregatedPrice = median(validPrices.map((p) => p.price));

  // Submit to price feed
  Devpack.priceFeeds.recordSnapshot({
    feedId,
    price: aggregatedPrice,
    source: `aggregator:${validPrices.length}sources`,
    collectedAt: new Date().toISOString(),
  });

  return {
    success: true,
    data: {
      feedId,
      aggregatedPrice,
      sourcesUsed: validPrices.length,
      sourcesTotal: sources.length,
      outlierThreshold,
      prices: validPrices,
      filtered: prices.length - validPrices.length,
    },
    meta: {
      timestamp: new Date().toISOString(),
      errors: errors.length > 0 ? errors : undefined,
    },
  };
}
