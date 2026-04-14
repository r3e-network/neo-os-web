/**
 * Lottery Components
 * Specialized components for lottery templates
 */

import { useMemo } from "react";

export type LotteryData = {
  prizePool: string;
  ticketPrice: string;
  ticketsSold: number;
  maxTickets: number;
  ticketsPerUser: number;
  drawDate?: string;
  isDrawn: boolean;
  winningTicket?: string;
};

type LotteryPoolProps = {
  data: LotteryData;
};

export function LotteryPool({ data }: LotteryPoolProps) {
  const progressPercentage = (data.ticketsSold / data.maxTickets) * 100;

  return (
    <div className="rounded-xl border border-neo/30 bg-gradient-to-br from-neo/5 to-transparent p-6">
      <div className="text-center mb-4">
        <p className="text-sm text-gray-500">Prize Pool</p>
        <p className="text-4xl font-extrabold text-neo">{data.prizePool}</p>
        <p className="text-xs text-gray-400 mt-1">50% to winner • 50% burned</p>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-500">Tickets Sold</span>
          <span className="text-gray-900 font-semibold">
            {data.ticketsSold.toLocaleString()} / {data.maxTickets.toLocaleString()}
          </span>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-neo transition-all duration-300"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-lg bg-white p-3 border border-gray-200">
          <p className="text-xs text-gray-500">Ticket Price</p>
          <p className="font-bold text-gray-900">{data.ticketPrice}</p>
        </div>
        <div className="rounded-lg bg-white p-3 border border-gray-200">
          <p className="text-xs text-gray-500">Max Per User</p>
          <p className="font-bold text-gray-900">{data.ticketsPerUser}</p>
        </div>
      </div>
    </div>
  );
}

type LotteryCountdownProps = {
  drawDate: string;
  onEnd?: () => void;
};

export function LotteryCountdown({ drawDate }: LotteryCountdownProps) {
  const { days, hours, minutes, seconds, isEnded } = useMemo(() => {
    const end = new Date(drawDate).getTime();
    const now = Date.now();
    const diff = Math.max(0, end - now);

    return {
      days: Math.floor(diff / (1000 * 60 * 60 * 24)),
      hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
      minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
      seconds: Math.floor((diff % (1000 * 60)) / 1000),
      isEnded: diff <= 0,
    };
  }, [drawDate]);

  if (isEnded) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center">
        <p className="text-lg font-bold text-gray-900">Draw Complete</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <p className="text-xs text-gray-500 text-center mb-3">Time Until Draw</p>
      <div className="grid grid-cols-4 gap-2 text-center">
        <div>
          <div className="text-2xl font-bold text-neo">{days.toString().padStart(2, "0")}</div>
          <div className="text-xs text-gray-500">Days</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-neo">{hours.toString().padStart(2, "0")}</div>
          <div className="text-xs text-gray-500">Hours</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-neo">{minutes.toString().padStart(2, "0")}</div>
          <div className="text-xs text-gray-500">Mins</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-neo">{seconds.toString().padStart(2, "0")}</div>
          <div className="text-xs text-gray-500">Secs</div>
        </div>
      </div>
    </div>
  );
}

type UserTicketsProps = {
  tickets: Array<{ id: string; purchasedAt: string }>;
  totalTickets: number;
};

export function UserTickets({ tickets, totalTickets }: UserTicketsProps) {
  if (totalTickets === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center">
        <p className="text-sm text-gray-500">You haven't bought any tickets yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="flex justify-between items-center mb-3">
        <h4 className="text-sm font-semibold text-gray-900">Your Tickets</h4>
        <span className="text-sm font-bold text-neo">{totalTickets} tickets</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {tickets.slice(0, 20).map((ticket) => (
          <div
            key={ticket.id}
            className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-neo/10 text-neo text-xs font-mono"
            title={`Purchased: ${ticket.purchasedAt}`}
          >
            #{ticket.id.slice(-4)}
          </div>
        ))}
        {tickets.length > 20 && (
          <div className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-gray-200 text-gray-500 text-xs">
            +{tickets.length - 20}
          </div>
        )}
      </div>
    </div>
  );
}

type PastDrawsProps = {
  draws: Array<{
    id: string;
    date: string;
    prizePool: string;
    winner: string;
    ticketsSold: number;
  }>;
};

export function PastDraws({ draws }: PastDrawsProps) {
  if (!draws.length) {
    return (
      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 text-center">
        <p className="text-sm text-gray-500">No past draws yet</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <h4 className="text-sm font-semibold text-gray-900 mb-3">Past Draws</h4>
      <div className="space-y-2">
        {draws.map((draw) => (
          <div key={draw.id} className="flex justify-between items-center py-2 border-b border-gray-200 last:border-b-0">
            <div>
              <p className="text-sm text-gray-900">{draw.date}</p>
              <p className="text-xs text-gray-500">
                Winner: {draw.winner.slice(0, 8)}...{draw.winner.slice(-6)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-neo">{draw.prizePool}</p>
              <p className="text-xs text-gray-500">{draw.ticketsSold} tickets</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
