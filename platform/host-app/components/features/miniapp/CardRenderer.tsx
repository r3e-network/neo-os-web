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
  const endTime = data.endTime ?? 0;
  const jackpot = data.jackpot ?? 0;
  const ticketsSold = data.ticketsSold ?? 0;

  useEffect(() => {
    const timer = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(timer);
  }, []);

  const remaining = Math.max(0, endTime - now);
  const hours = String(Math.floor(remaining / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((remaining % 3600) / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");

  return (
    <div className={`h-full flex flex-col justify-center p-4 text-black text-center bg-neo ${className}`}>
      <div className="flex justify-center items-center gap-1 mb-2">
        <span className="text-2xl font-black bg-white border-2 border-black px-2 py-1 shadow-[2px_2px_0_#000]">
          {hours}
        </span>
        <span className="text-xl font-black">:</span>
        <span className="text-2xl font-black bg-white border-2 border-black px-2 py-1 shadow-[2px_2px_0_#000]">
          {minutes}
        </span>
        <span className="text-xl font-black">:</span>
        <span className="text-2xl font-black bg-white border-2 border-black px-2 py-1 shadow-[2px_2px_0_#000]">
          {seconds}
        </span>
      </div>
      <div className="mb-1">
        <span className="text-xs font-bold uppercase tracking-wide block">Jackpot</span>
        <span className="text-xl font-black bg-white border-2 border-black px-2 inline-block transform -rotate-1 shadow-[3px_3px_0_#000]">
          {jackpot} GAS
        </span>
      </div>
      <div className="text-xs font-bold mt-2">{ticketsSold} tickets sold</div>
    </div>
  );
}

// Multiplier Card (Crash Games)
function MultiplierCard({ data, className }: { data: MultiplierData; className: string }) {
  const statusColors = {
    waiting: "bg-brutal-yellow text-black",
    running: "bg-neo text-black",
    crashed: "bg-brutal-red text-white",
  };
  const statusText = { waiting: "Starting...", running: "LIVE", crashed: "CRASHED" };
  const multiplier = data.currentMultiplier ?? 1;
  const status = data.status ?? "waiting";

  return (
    <div
      className={`h-full flex flex-col justify-center p-4 text-center ${statusColors[status]} ${className} relative overflow-hidden`}
    >
      <div className="absolute inset-0 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:8px_8px] opacity-10" />
      <div className="relative z-10">
        <div className="mb-2">
          <span className="text-4xl font-black block tracking-tighter drop-shadow-[3px_3px_0_rgba(0,0,0,0.2)]">
            {multiplier.toFixed(2)}x
          </span>
          <span className="text-xs font-black uppercase bg-black text-white px-2 py-0.5 border-2 border-black">
            {statusText[status]}
          </span>
        </div>
        <div className="flex justify-around text-xs font-bold uppercase mt-3 border-t-2 border-black/20 pt-2">
          <span>{data.playersCount} players</span>
          <span>{data.totalBets} GAS</span>
        </div>
      </div>
    </div>
  );
}

// Canvas Card (Pixel Art)
function CanvasCard({ data, className }: { data: CanvasData; className: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pixels = data.pixels ?? "";
  const width = data.width ?? 10;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !pixels) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const scale = 80 / width;
    for (let i = 0; i < pixels.length / 6; i++) {
      const color = "#" + pixels.slice(i * 6, i * 6 + 6);
      const x = (i % width) * scale;
      const y = Math.floor(i / width) * scale;
      // Pixel art style: fill rects with no anti-aliasing (simulated by full block fill)
      ctx.fillStyle = color;
      ctx.fillRect(x, y, scale, scale);
    }
  }, [pixels, width]);

  return (
    <div
      className={`h-full flex flex-col justify-center items-center p-3 text-black bg-white ${className}`}
    >
      <div className="border-4 border-black shadow-[4px_4px_0_#000] bg-white p-1">
        <canvas
          ref={canvasRef}
          width={80}
          height={80}
          className="image-pixelated bg-gray-200"
          style={{ imageRendering: "pixelated" }}
        />
      </div>
      <div className="flex justify-between w-full text-xs font-bold uppercase px-2 mt-3">
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
  const stats = data.stats ?? [];

  return (
    <div className={`h-full flex flex-col justify-center p-3 text-black bg-brutal-pink ${className}`}>
      <div className="bg-white border-2 border-black shadow-[4px_4px_0_#000] p-2">
        {stats.slice(0, 3).map((stat, idx) => (
          <div key={idx} className="flex items-center py-1 border-b-2 border-black last:border-0 border-dashed">
            {stat.icon && <span className="text-base mr-2">{stat.icon}</span>}
            <div className="flex-1">
              <span className="text-sm font-black block leading-none">{stat.value}</span>
              <span className="text-[10px] font-bold uppercase text-gray-500">{stat.label}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Voting Card (Governance)
function VotingCard({ data, className }: { data: VotingData; className: string }) {
  const totalVotes = data.totalVotes || 1;
  const yesPercent = Math.round((data.yesVotes / totalVotes) * 100);
  const noPercent = 100 - yesPercent;
  const diff = data.endTime - Math.floor(Date.now() / 1000);
  const timeLeft =
    diff <= 0 ? "Ended" : diff > 86400 ? `${Math.floor(diff / 86400)}d left` : `${Math.floor(diff / 3600)}h left`;

  return (
    <div className={`h-full flex flex-col justify-center p-3 text-white bg-brutal-blue ${className}`}>
      <p className="text-sm font-black truncate mb-2 uppercase italic text-black bg-white px-1 border-2 border-black shadow-[2px_2px_0_#000]">
        {data.proposalTitle}
      </p>
      <div className="space-y-2 mb-2">
        <div className="relative h-5 bg-white border-2 border-black shadow-[2px_2px_0_rgba(0,0,0,0.5)]">
          <div className="absolute h-full bg-neo border-r-2 border-black" style={{ width: `${yesPercent}%` }} />
          <span className="absolute left-1 top-0 text-[10px] font-black text-black z-10 leading-4">
            YES {yesPercent}%
          </span>
        </div>
        <div className="relative h-5 bg-white border-2 border-black shadow-[2px_2px_0_rgba(0,0,0,0.5)]">
          <div className="absolute h-full bg-brutal-red border-r-2 border-black" style={{ width: `${noPercent}%` }} />
          <span className="absolute left-1 top-0 text-[10px] font-black text-black z-10 leading-4">
            NO {noPercent}%
          </span>
        </div>
      </div>
      <div className="flex justify-between text-[10px] font-bold uppercase text-black bg-white/50 px-1">
        <span>{data.totalVotes} votes</span>
        <span>{timeLeft}</span>
      </div>
    </div>
  );
}

// Price Card (Trading, DeFi)
function PriceCard({ data, className }: { data: PriceData; className: string }) {
  const sparkline = data.sparkline ?? [];
  const hasData = sparkline.length > 0;
  const min = hasData ? Math.min(...sparkline) : 0;
  const max = hasData ? Math.max(...sparkline) : 1;
  const range = max - min || 1;
  const normalized = sparkline.map((v) => 20 + ((v - min) / range) * 80);
  const change = data.change24h ?? 0;
  const isUp = change >= 0;

  return (
    <div className={`h-full flex flex-col justify-center p-3 text-black bg-white ${className}`}>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs font-black uppercase bg-black text-white px-1">{data.symbol}</span>
        <span
          className={`text-xs font-black px-1.5 py-0.5 border-2 border-black ${isUp ? "bg-neo text-black" : "bg-brutal-red text-white"
            } shadow-[2px_2px_0_#000]`}
        >
          {isUp ? "+" : ""}
          {change.toFixed(2)}%
        </span>
      </div>
      <span className="text-2xl font-black block mb-2 tracking-tighter">${data.price}</span>
      <div className="flex items-end h-10 gap-0.5 border-b-2 border-black">
        {normalized.map((h, i) => (
          <div
            key={i}
            className={`flex-1 border-t-2 border-black ${isUp ? "bg-neo" : "bg-brutal-red"}`}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
    </div>
  );
}
