/**
 * Auction Components
 * Specialized components for auction templates
 */

import { useMemo } from "react";

export type AuctionBid = {
  bidder: string;
  amount: string;
  timestamp: string;
};

export type AuctionData = {
  currentItem: {
    name: string;
    description: string;
    imageUrl?: string;
  };
  startingPrice: string;
  currentBid: string;
  currentLeader?: string;
  reservePrice?: string;
  minIncrement: string;
  endTime: string;
  bids: AuctionBid[];
  isEnded: boolean;
  isReserveMet: boolean;
};

type AuctionItemProps = {
  data: AuctionData;
};

export function AuctionItem({ data }: AuctionItemProps) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/70 overflow-hidden">
      {data.currentItem.imageUrl && (
        <div className="aspect-video bg-gray-200 dark:bg-gray-800">
          <img
            src={data.currentItem.imageUrl}
            alt={data.currentItem.name}
            className="w-full h-full object-cover"
          />
        </div>
      )}
      <div className="p-4">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">{data.currentItem.name}</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{data.currentItem.description}</p>
      </div>
    </div>
  );
}

type AuctionStatusProps = {
  data: AuctionData;
};

export function AuctionStatus({ data }: AuctionStatusProps) {
  const { hours, minutes, seconds, isEnded } = useMemo(() => {
    const end = new Date(data.endTime).getTime();
    const now = Date.now();
    const diff = Math.max(0, end - now);

    return {
      hours: Math.floor(diff / (1000 * 60 * 60)),
      minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((diff % (1000 * 60)) / 1000),
      isEnded: diff <= 0,
    };
  }, [data.endTime]);

  const isLeading = !isEnded && data.currentBid !== data.startingPrice;

  return (
    <div className="rounded-xl border border-neo/30 bg-gradient-to-br from-neo/5 to-transparent p-6">
      <div className="text-center mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {data.isEnded ? "Final Price" : "Current Bid"}
        </p>
        <p className="text-4xl font-extrabold text-neo">{data.currentBid}</p>
        {data.currentLeader && !data.isEnded && (
          <p className="text-xs text-gray-400 mt-1">
            Leading: {data.currentLeader.slice(0, 8)}...{data.currentLeader.slice(-6)}
          </p>
        )}
      </div>

      {!data.isEnded && (
        <div className="mb-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">{hours.toString().padStart(2, "0")}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Hours</div>
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">{minutes.toString().padStart(2, "0")}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Mins</div>
            </div>
            <div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">{seconds.toString().padStart(2, "0")}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Secs</div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 text-center text-sm">
        <div>
          <p className="text-gray-500 dark:text-gray-400">Starting</p>
          <p className="font-semibold text-gray-900 dark:text-white">{data.startingPrice}</p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-400">Min Increment</p>
          <p className="font-semibold text-gray-900 dark:text-white">{data.minIncrement}</p>
        </div>
      </div>

      {data.reservePrice && (
        <div className={`mt-3 text-center text-sm ${data.isReserveMet ? "text-emerald-500" : "text-amber-500"}`}>
          {data.isReserveMet ? "✓ Reserve met" : "Reserve not met"}
        </div>
      )}

      {data.isEnded && (
        <div className="mt-3 text-center text-sm text-emerald-500 font-semibold">
          Auction Ended
        </div>
      )}
    </div>
  );
}

type BidHistoryProps = {
  bids: AuctionBid[];
  maxDisplay?: number;
};

export function BidHistory({ bids, maxDisplay = 10 }: BidHistoryProps) {
  if (!bids.length) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/70 p-4 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">No bids yet</p>
      </div>
    );
  }

  const displayBids = bids.slice(0, maxDisplay);

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/70 p-4">
      <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Bid History</h4>
      <div className="space-y-2">
        {displayBids.map((bid, index) => (
          <div
            key={`${bid.bidder}-${bid.timestamp}`}
            className={`flex justify-between items-center py-2 ${
              index !== displayBids.length - 1 ? "border-b border-gray-200 dark:border-gray-700" : ""
            }`}
          >
            <div>
              <p className="text-sm font-mono text-gray-900 dark:text-white">
                {bid.bidder.slice(0, 8)}...{bid.bidder.slice(-6)}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{bid.timestamp}</p>
            </div>
            <p className="text-sm font-bold text-neo">{bid.amount}</p>
          </div>
        ))}
      </div>
      {bids.length > maxDisplay && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-3">
          +{bids.length - maxDisplay} more bids
        </p>
      )}
    </div>
  );
}

type DutchAuctionProps = {
  startPrice: string;
  currentPrice: string;
  endPrice: string;
  priceDecrement: string;
  decrementInterval: number; // seconds
  nextDecrementIn: number; // seconds
  quantity: number;
  sold: number;
};

export function DutchAuction({
  startPrice,
  currentPrice,
  endPrice,
  priceDecrement,
  decrementInterval,
  nextDecrementIn,
  quantity,
  sold,
}: DutchAuctionProps) {
  const priceProgress = useMemo(() => {
    const start = parseFloat(startPrice);
    const current = parseFloat(currentPrice);
    const end = parseFloat(endPrice);
    return ((start - current) / (start - end)) * 100;
  }, [startPrice, currentPrice, endPrice]);

  const minutes = Math.floor(nextDecrementIn / 60);
  const seconds = nextDecrementIn % 60;

  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/70 p-4">
      <div className="text-center mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">Current Price</p>
        <p className="text-3xl font-extrabold text-neo">{currentPrice}</p>
        <p className="text-xs text-gray-400 mt-1">
          Next drop in {minutes}m {seconds}s
        </p>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
          <span>{startPrice}</span>
          <span>{endPrice}</span>
        </div>
        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
          <div
            className="h-full bg-neo transition-all duration-300"
            style={{ width: `${priceProgress}%` }}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-neo border-2 border-white dark:border-gray-900"
            style={{ left: `${priceProgress}%` }}
          />
        </div>
        <p className="text-xs text-center text-gray-500 dark:text-gray-400 mt-1">
          -{priceDecrement} every {decrementInterval / 60} minutes
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-center text-sm">
        <div>
          <p className="text-gray-500 dark:text-gray-400">Available</p>
          <p className="font-semibold text-gray-900 dark:text-white">{quantity - sold}</p>
        </div>
        <div>
          <p className="text-gray-500 dark:text-gray-400">Sold</p>
          <p className="font-semibold text-gray-900 dark:text-white">{sold}</p>
        </div>
      </div>
    </div>
  );
}
