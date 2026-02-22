import { useMemo } from "react";

/**
 * Prediction Market Components
 * Specialized components for prediction market templates
 */

export type PredictionOutcome = {
  id: string;
  label: string;
  probability: number;
  volume: string;
  price: string;
};

export type PredictionMarketData = {
  outcomes: PredictionOutcome[];
  totalVolume: string;
  endDate?: string;
  isResolved: boolean;
  winningOutcome?: string;
};

type PredictionOutcomesProps = {
  data: PredictionMarketData;
  onOutcomeSelect?: (outcomeId: string) => void;
  selectedOutcome?: string;
};

export function PredictionOutcomes({ data, onOutcomeSelect, selectedOutcome }: PredictionOutcomesProps) {
  const sortedOutcomes = useMemo(() => {
    return [...data.outcomes].sort((a, b) => b.probability - a.probability);
  }, [data.outcomes]);

  return (
    <div className="space-y-3">
      {sortedOutcomes.map((outcome) => (
        <button
          key={outcome.id}
          type="button"
          onClick={() => onOutcomeSelect?.(outcome.id)}
          className={`w-full text-left rounded-xl border p-4 transition-all ${
            selectedOutcome === outcome.id
              ? "border-neo bg-neo/5"
              : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-300 dark:hover:border-gray-600"
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-gray-900 dark:text-white">{outcome.label}</span>
            <span className="text-lg font-bold text-neo">{(outcome.probability * 100).toFixed(1)}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-neo transition-all duration-300"
              style={{ width: `${outcome.probability * 100}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span>Price: {outcome.price}</span>
            <span>Volume: {outcome.volume}</span>
          </div>
        </button>
      ))}

      {data.isResolved && data.winningOutcome && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-900/70 dark:bg-emerald-900/20 p-4">
          <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
            ✓ Resolved: {data.outcomes.find((o) => o.id === data.winningOutcome)?.label}
          </p>
        </div>
      )}
    </div>
  );
}

type PredictionStatsProps = {
  totalVolume: string;
  totalTrades: number;
  uniqueTraders: number;
  endDate?: string;
};

export function PredictionStats({ totalVolume, totalTrades, uniqueTraders, endDate }: PredictionStatsProps) {
  const timeRemaining = useMemo(() => {
    if (!endDate) return null;
    const end = new Date(endDate).getTime();
    const now = Date.now();
    const diff = end - now;
    if (diff <= 0) return "Ended";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return `${days}d ${hours}h remaining`;
  }, [endDate]);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/70 p-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">Total Volume</p>
        <p className="text-lg font-bold text-gray-900 dark:text-white">{totalVolume}</p>
      </div>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/70 p-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">Total Trades</p>
        <p className="text-lg font-bold text-gray-900 dark:text-white">{totalTrades.toLocaleString()}</p>
      </div>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/70 p-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">Unique Traders</p>
        <p className="text-lg font-bold text-gray-900 dark:text-white">{uniqueTraders.toLocaleString()}</p>
      </div>
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/70 p-3">
        <p className="text-xs text-gray-500 dark:text-gray-400">Time Remaining</p>
        <p className="text-lg font-bold text-gray-900 dark:text-white">{timeRemaining || "N/A"}</p>
      </div>
    </div>
  );
}

type PriceHistoryProps = {
  data: Array<{ timestamp: number; yesPrice: number; noPrice: number }>;
  height?: number;
};

export function PriceHistory({ data, height = 200 }: PriceHistoryProps) {
  if (!data.length) {
    return (
      <div
        className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/70 flex items-center justify-center"
        style={{ height }}
      >
        <p className="text-sm text-gray-500 dark:text-gray-400">No price history available</p>
      </div>
    );
  }

  const maxPrice = 1;
  const width = 100;
  const points = data.length;

  const yesPath = data
    .map((d, i) => {
      const x = (i / (points - 1)) * width;
      const y = (1 - d.yesPrice / maxPrice) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  const noPath = data
    .map((d, i) => {
      const x = (i / (points - 1)) * width;
      const y = (1 - d.noPrice / maxPrice) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/70 p-4">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Price History</h4>
      <svg viewBox={`0 0 ${width} 100`} preserveAspectRatio="none" style={{ height, width: "100%" }}>
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((y) => (
          <line key={y} x1="0" y1={y} x2={width} y2={y} stroke="currentColor" className="text-gray-200 dark:text-gray-700" strokeWidth="0.5" />
        ))}

        {/* YES line */}
        <polyline
          points={yesPath}
          fill="none"
          stroke="#00e599"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* NO line */}
        <polyline
          points={noPath}
          fill="none"
          stroke="#ef4444"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div className="flex justify-center gap-6 mt-2">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-neo" />
          <span className="text-xs text-gray-500 dark:text-gray-400">YES</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span className="text-xs text-gray-500 dark:text-gray-400">NO</span>
        </div>
      </div>
    </div>
  );
}

type UserPositionProps = {
  yesShares: string;
  noShares: string;
  avgYesPrice: string;
  avgNoPrice: string;
  pnl: string;
  pnlPercent: string;
};

export function UserPosition({ yesShares, noShares, avgYesPrice, avgNoPrice, pnl, pnlPercent }: UserPositionProps) {
  const hasPosition = parseFloat(yesShares) > 0 || parseFloat(noShares) > 0;

  if (!hasPosition) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/70 p-4">
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center">No position held</p>
      </div>
    );
  }

  const isPositive = parseFloat(pnl) >= 0;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/70 p-4">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Your Position</h4>

      {parseFloat(yesShares) > 0 && (
        <div className="mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500 dark:text-gray-400">YES Shares</span>
            <span className="font-semibold text-neo">{yesShares}</span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-gray-400">Avg Price</span>
            <span className="text-xs text-gray-600 dark:text-gray-300">{avgYesPrice}</span>
          </div>
        </div>
      )}

      {parseFloat(noShares) > 0 && (
        <div className="mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-500 dark:text-gray-400">NO Shares</span>
            <span className="font-semibold text-red-500">{noShares}</span>
          </div>
          <div className="flex justify-between items-center mt-1">
            <span className="text-xs text-gray-400">Avg Price</span>
            <span className="text-xs text-gray-600 dark:text-gray-300">{avgNoPrice}</span>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center">
        <span className="text-sm text-gray-500 dark:text-gray-400">P&L</span>
        <span className={`font-semibold ${isPositive ? "text-emerald-500" : "text-red-500"}`}>
          {isPositive ? "+" : ""}{pnl} ({isPositive ? "+" : ""}{pnlPercent}%)
        </span>
      </div>
    </div>
  );
}
