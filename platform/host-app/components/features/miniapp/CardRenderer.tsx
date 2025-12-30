"use client";

import { useEffect, useState, useRef } from "react";
import type {
  AnyCardData,
  CountdownData,
  MultiplierData,
  CanvasData,
  StatsData,
  VotingData,
  PriceData,
} from "@/types/card-display";

interface CardRendererProps {
  data: AnyCardData;
  className?: string;
}

export function CardRenderer({ data, className = "" }: CardRendererProps) {
  switch (data.type) {
    case "live_countdown":
      return <CountdownCard data={data} className={className} />;
    case "live_multiplier":
      return <MultiplierCard data={data} className={className} />;
    case "live_canvas":
      return <CanvasCard data={data} className={className} />;
    case "live_stats":
      return <StatsCard data={data} className={className} />;
    case "live_voting":
      return <VotingCard data={data} className={className} />;
    case "live_price":
      return <PriceCard data={data} className={className} />;
    default:
      return null;
  }
}

// Countdown Card (Lottery, Auctions)
function CountdownCard({ data, className }: { data: CountdownData; className: string }) {
  const [now, setNow] = useState(Math.floor(Date.now() / 1000));

  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  const remaining = Math.max(0, data.endTime - now);
  const hours = String(Math.floor(remaining / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((remaining % 3600) / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");

  return (
    <div
      className={`h-full flex flex-col justify-center p-4 text-white text-center bg-gradient-to-br from-emerald-500 to-emerald-700 ${className}`}
    >
      <div className="flex justify-center items-center gap-1 mb-2">
        <span className="text-2xl font-bold bg-black/20 px-2 py-1 rounded">{hours}</span>
        <span className="text-xl">:</span>
        <span className="text-2xl font-bold bg-black/20 px-2 py-1 rounded">{minutes}</span>
        <span className="text-xl">:</span>
        <span className="text-2xl font-bold bg-black/20 px-2 py-1 rounded">{seconds}</span>
      </div>
      <div className="mb-1">
        <span className="text-xs opacity-80 block">Jackpot</span>
        <span className="text-lg font-bold">{data.jackpot} GAS</span>
      </div>
      <div className="text-xs opacity-90">{data.ticketsSold} tickets sold</div>
    </div>
  );
}

// Multiplier Card (Crash Games)
function MultiplierCard({ data, className }: { data: MultiplierData; className: string }) {
  const statusColors = {
    waiting: "from-gray-500 to-gray-700",
    running: "from-emerald-500 to-emerald-700",
    crashed: "from-red-500 to-red-700",
  };
  const statusText = { waiting: "Starting...", running: "LIVE", crashed: "Crashed!" };

  return (
    <div
      className={`h-full flex flex-col justify-center p-4 text-white text-center bg-gradient-to-br ${statusColors[data.status]} ${className}`}
    >
      <div className="mb-2">
        <span className="text-3xl font-bold block">{data.currentMultiplier.toFixed(2)}x</span>
        <span className="text-xs bg-black/20 px-2 py-0.5 rounded">{statusText[data.status]}</span>
      </div>
      <div className="flex justify-around text-xs opacity-90">
        <span>{data.playersCount} players</span>
        <span>{data.totalBets} GAS</span>
      </div>
    </div>
  );
}

// Canvas Card (Pixel Art)
function CanvasCard({ data, className }: { data: CanvasData; className: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scale = 80 / data.width;
    for (let i = 0; i < data.pixels.length / 6; i++) {
      const color = "#" + data.pixels.slice(i * 6, i * 6 + 6);
      const x = (i % data.width) * scale;
      const y = Math.floor(i / data.width) * scale;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, scale, scale);
    }
  }, [data.pixels, data.width]);

  return (
    <div
      className={`h-full flex flex-col justify-center items-center p-3 text-white bg-gradient-to-br from-slate-800 to-slate-900 ${className}`}
    >
      <canvas ref={canvasRef} width={80} height={80} className="rounded border-2 border-white/10 mb-2" />
      <div className="flex justify-between w-full text-xs opacity-90 px-2">
        <span>🎨 {data.activeUsers} active</span>
        <span>
          {data.width}×{data.height}
        </span>
      </div>
    </div>
  );
}

// Stats Card (Red Envelope, Tipping)
function StatsCard({ data, className }: { data: StatsData; className: string }) {
  return (
    <div
      className={`h-full flex flex-col justify-center p-3 text-white bg-gradient-to-br from-red-600 to-red-800 ${className}`}
    >
      {data.stats.slice(0, 3).map((stat, idx) => (
        <div key={idx} className="flex items-center py-1 border-b border-white/10 last:border-0">
          {stat.icon && <span className="text-base mr-2">{stat.icon}</span>}
          <div className="flex-1">
            <span className="text-sm font-bold block">{stat.value}</span>
            <span className="text-xs opacity-80">{stat.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// Voting Card (Governance)
function VotingCard({ data, className }: { data: VotingData; className: string }) {
  const yesPercent = Math.round((data.yesVotes / data.totalVotes) * 100);
  const noPercent = 100 - yesPercent;
  const diff = data.endTime - Math.floor(Date.now() / 1000);
  const timeLeft =
    diff <= 0 ? "Ended" : diff > 86400 ? `${Math.floor(diff / 86400)}d left` : `${Math.floor(diff / 3600)}h left`;

  return (
    <div
      className={`h-full flex flex-col justify-center p-3 text-white bg-gradient-to-br from-violet-600 to-purple-800 ${className}`}
    >
      <p className="text-sm font-semibold truncate mb-2">{data.proposalTitle}</p>
      <div className="space-y-1 mb-2">
        <div className="relative h-4 bg-black/20 rounded overflow-hidden">
          <div className="absolute h-full bg-emerald-500" style={{ width: `${yesPercent}%` }} />
          <span className="absolute left-2 top-0 text-xs font-semibold">Yes {yesPercent}%</span>
        </div>
        <div className="relative h-4 bg-black/20 rounded overflow-hidden">
          <div className="absolute h-full bg-red-500" style={{ width: `${noPercent}%` }} />
          <span className="absolute left-2 top-0 text-xs font-semibold">No {noPercent}%</span>
        </div>
      </div>
      <div className="flex justify-between text-xs opacity-90">
        <span>{data.totalVotes} votes</span>
        <span>{timeLeft}</span>
      </div>
    </div>
  );
}

// Price Card (Trading, DeFi)
function PriceCard({ data, className }: { data: PriceData; className: string }) {
  const min = Math.min(...data.sparkline);
  const max = Math.max(...data.sparkline);
  const range = max - min || 1;
  const normalized = data.sparkline.map((v) => 20 + ((v - min) / range) * 80);
  const isUp = data.change24h >= 0;

  return (
    <div
      className={`h-full flex flex-col justify-center p-3 text-white bg-gradient-to-br from-slate-800 to-slate-950 ${className}`}
    >
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-semibold opacity-90">{data.symbol}</span>
        <span
          className={`text-xs px-1.5 py-0.5 rounded ${isUp ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}
        >
          {isUp ? "+" : ""}
          {data.change24h.toFixed(2)}%
        </span>
      </div>
      <span className="text-xl font-bold block mb-2">${data.price}</span>
      <div className="flex items-end h-10 gap-0.5">
        {normalized.map((h, i) => (
          <div
            key={i}
            className={`flex-1 rounded-sm ${isUp ? "bg-green-500" : "bg-red-500"}`}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}
