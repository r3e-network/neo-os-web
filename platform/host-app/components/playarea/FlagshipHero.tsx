/**
 * Per-flagship hero band shown above the stats grid in the detail page
 * playfield. Each variant surfaces the most exciting on-chain moment for
 * that miniapp (countdown jackpot, streak fire, gacha lineup, etc.) so
 * users can read the state at a glance and feel pulled to play.
 */

import React from "react";

export type HeroStats = Record<string, string>;

type Props = {
  appId: string;
  stats: HeroStats;
  leader?: string;
  recentWinner?: { address: string; prize: string } | null;
};

export function FlagshipHero({
  appId,
  stats,
  leader,
  recentWinner: _recentWinner,
}: Props) {
  switch (appId) {
    case "miniapp-last-survivor":
      return <LastSurvivorHero stats={stats} leader={leader} />;
    case "miniapp-fogplay":
      return <FogPlayHero stats={stats} />;
    case "miniapp-gasbox":
      return <GasBoxHero stats={stats} />;
    case "miniapp-redenvelope":
      return <RedEnvelopeHero stats={stats} />;
    case "miniapp-dailycheckin":
      return <DailyCheckinHero stats={stats} />;
    case "miniapp-self-loan":
      return <SelfLoanHero stats={stats} />;
    case "miniapp-profitanchor":
      return <AnchorHero stats={stats} mode="profit" />;
    case "miniapp-trustanchor":
      return <AnchorHero stats={stats} mode="trust" />;
    case "miniapp-neo-pay":
      return <NeoPayHero stats={stats} />;
    default:
      return null;
  }
}

/* ────────────────────────────────────────────────────────────────────── */
/* LastSurvivor — big countdown ring + prize pool jackpot */
/* ────────────────────────────────────────────────────────────────────── */

function LastSurvivorHero({
  stats,
  leader,
}: {
  stats: HeroStats;
  leader?: string;
}) {
  const countdown = stats["Countdown"] || "—";
  const prizePool = stats["Prize Pool"] || "0 GAS";
  const round = stats["Round"] || "#0";
  const status = stats["Status"] || "—";
  const live = status.toLowerCase().includes("open");

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50 p-6 sm:p-8 border border-rose-100">
      <div className="absolute -top-12 -right-12 h-48 w-48 rounded-full bg-gradient-to-br from-rose-300/40 to-orange-300/30 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 -left-12 h-56 w-56 rounded-full bg-gradient-to-br from-amber-300/30 to-rose-300/20 blur-3xl pointer-events-none" />
      <div className="relative grid grid-cols-1 sm:grid-cols-[auto,1fr] gap-6 sm:gap-8 items-center">
        <CountdownRing label={countdown} active={live} />
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text-rose-700">
              {round}
            </span>
            <span
              className={`text-[10px] font-black uppercase text px-2 py-0.5 rounded-full ${live ? "bg-rose-600 text-white" : "bg-gray-200 text-gray-600"}`}
            >
              {status}
            </span>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-rose-700/80 uppercase mb-0.5">
              Prize Pool
            </div>
            <div className="text-4xl sm:text-5xl font-black text-gray-900 tabular-nums">
              {prizePool}
            </div>
          </div>
          {leader && (
            <div className="inline-flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2 border border-rose-100 shadow-sm">
              <span className="text-base">👑</span>
              <div className="leading-tight">
                <div className="text-[9px] font-bold uppercase text-rose-700">
                  Current Leader
                </div>
                <div className="text-xs font-semibold text-gray-900 font-mono">
                  {leader}
                </div>
              </div>
            </div>
          )}
          <p className="text-xs text-gray-600 max-w-md leading-relaxed">
            Each GAS transfer buys 1 key, extends the timer, and crowns you as
            the current leader. Be the last bidder when the timer hits zero to
            win the contract-defined payout.
          </p>
        </div>
      </div>
    </div>
  );
}

function CountdownRing({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="relative flex items-center justify-center w-32 h-32 sm:w-40 sm:h-40 shrink-0">
      <div
        className={`absolute inset-0 rounded-full ${active ? "bg-gradient-to-br from-rose-500 via-orange-500 to-amber-400 animate-spin-slow" : "bg-gradient-to-br from-gray-300 to-gray-200"}`}
        style={{ animation: active ? "spin 12s linear infinite" : undefined }}
      />
      <div className="absolute inset-1.5 rounded-full bg-white" />
      <div className="absolute inset-3 rounded-full bg-gradient-to-br from-white to-rose-50/40" />
      <div className="relative z-10 text-center">
        <div className="text-[9px] font-bold uppercase text-rose-600/80">
          Countdown
        </div>
        <div className="text-xl sm:text-2xl font-black text-gray-900 tabular-nums leading-tight mt-1">
          {label}
        </div>
      </div>
      {active && (
        <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-500 opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500" />
        </span>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* FogPlay — animated coin + 2× payout callout */
/* ────────────────────────────────────────────────────────────────────── */

function FogPlayHero({ stats }: { stats: HeroStats }) {
  const minBet = stats["Min Bet"] || "—";
  const maxBet = stats["Max Bet"] || "—";
  const status = stats["Status"] || "—";
  const live = status.toLowerCase() === "active";

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-purple-900 to-violet-900 p-6 sm:p-8 text-white">
      <div className="absolute -top-20 -right-10 h-64 w-64 rounded-full bg-purple-400/20 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-20 -left-10 h-64 w-64 rounded-full bg-indigo-400/20 blur-3xl pointer-events-none" />
      <div className="relative grid grid-cols-1 sm:grid-cols-[auto,1fr] gap-6 sm:gap-8 items-center">
        <FlippingCoin />
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-black uppercase text px-2 py-0.5 rounded-full ${live ? "bg-emerald-400 text-emerald-950" : "bg-white/20 text-white/70"}`}
            >
              {status}
            </span>
            <span className="text-[10px] font-black uppercase text-white/60">
              Coin Flip · VRF
            </span>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-white/60 uppercase mb-0.5">
              Pick a side, double or zero
            </div>
            <div className="text-4xl sm:text-5xl font-black tabular-nums">
              2<span className="text-purple-300">×</span>{" "}
              <span className="text-2xl sm:text-3xl text-white/80">payout</span>
            </div>
          </div>
          <div className="inline-flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2 border border-white/10 backdrop-blur-sm">
            <div className="leading-tight">
              <div className="text-[9px] font-bold uppercase text-white/50">
                Bet range
              </div>
              <div className="text-sm font-semibold tabular-nums">
                {minBet} <span className="text-white/40">–</span> {maxBet}
              </div>
            </div>
          </div>
          <p className="text-xs text-white/70 max-w-md leading-relaxed">
            Pick heads or tails, lock your stake, and wait for the Morpheus VRF
            callback to settle on-chain. Win and double your stake instantly.
          </p>
        </div>
      </div>
    </div>
  );
}

function FlippingCoin() {
  return (
    <div
      className="relative flex items-center justify-center w-32 h-32 sm:w-40 sm:h-40 shrink-0"
      style={{ perspective: "600px" }}
    >
      <div
        className="absolute inset-0 rounded-full bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600 shadow-[0_0_60px_rgba(251,191,36,0.5)]"
        style={{ animation: "coinFlip 4s ease-in-out infinite" }}
      />
      <div
        className="absolute inset-3 rounded-full bg-gradient-to-br from-amber-200 via-yellow-300 to-amber-500"
        style={{ animation: "coinFlip 4s ease-in-out infinite" }}
      />
      <div
        className="relative z-10 text-4xl sm:text-5xl font-black text-amber-900"
        style={{ animation: "coinFlip 4s ease-in-out infinite" }}
      >
        ¢
      </div>
      <style jsx>{`
        @keyframes coinFlip {
          0%,
          100% {
            transform: rotateY(0deg);
          }
          50% {
            transform: rotateY(180deg);
          }
        }
      `}</style>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* GASBox — gacha capsule + machine count */
/* ────────────────────────────────────────────────────────────────────── */

function GasBoxHero({ stats }: { stats: HeroStats }) {
  const machines = stats["Total Machines"] || "0";
  const status = stats["Status"] || "—";
  const live = status.toLowerCase().includes("ready");

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 p-6 sm:p-8 border border-amber-100">
      <div className="absolute -top-12 -right-12 h-56 w-56 rounded-full bg-gradient-to-br from-amber-300/40 to-orange-300/30 blur-3xl pointer-events-none" />
      <div className="relative grid grid-cols-1 sm:grid-cols-[auto,1fr] gap-6 sm:gap-8 items-center">
        <GachaCapsule />
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-black uppercase text px-2 py-0.5 rounded-full ${live ? "bg-amber-500 text-white" : "bg-gray-200 text-gray-600"}`}
            >
              {status}
            </span>
            <span className="text-[10px] font-black uppercase text-amber-700/80">
              Gacha · VRF
            </span>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-amber-700/80 uppercase mb-0.5">
              Live machines on-chain
            </div>
            <div className="flex items-baseline gap-3">
              <div className="text-5xl sm:text-6xl font-black text-gray-900 tabular-nums">
                {machines}
              </div>
              <div className="text-sm font-semibold text-amber-700">
                machine{machines === "1" ? "" : "s"}
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-600 max-w-md leading-relaxed">
            Pick a machine, drop GAS into the slot, and let provably-fair VRF
            randomness reveal your prize. Each machine has its own item pool and
            drop rates.
          </p>
        </div>
      </div>
    </div>
  );
}

function GachaCapsule() {
  return (
    <div className="relative flex items-center justify-center w-32 h-32 sm:w-40 sm:h-40 shrink-0">
      <div className="absolute top-2 left-1/2 -translate-x-1/2 h-3 w-20 rounded-t-xl bg-gradient-to-b from-amber-600 to-amber-700" />
      <div className="absolute inset-x-3 top-5 bottom-3 rounded-3xl bg-gradient-to-b from-amber-400 via-orange-400 to-amber-500 shadow-inner" />
      <div className="absolute inset-x-6 top-9 bottom-10 rounded-2xl bg-white/40 border border-white/60 backdrop-blur-sm overflow-hidden">
        <div className="absolute inset-0 grid grid-cols-3 gap-1 p-1.5 opacity-90">
          <span className="rounded-full bg-rose-400 animate-pulse" />
          <span className="rounded-full bg-emerald-400" />
          <span className="rounded-full bg-sky-400 animate-pulse" />
          <span className="rounded-full bg-violet-400" />
          <span className="rounded-full bg-amber-200 animate-pulse" />
          <span className="rounded-full bg-pink-400" />
        </div>
      </div>
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 h-4 w-14 rounded-b-xl bg-amber-700" />
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* RedEnvelope — opening envelope with floating coins */
/* ────────────────────────────────────────────────────────────────────── */

function RedEnvelopeHero({ stats }: { stats: HeroStats }) {
  const status = stats["Status"] || "—";
  const live = status.toLowerCase() === "active";

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-100 via-red-100 to-pink-100 p-6 sm:p-8 border border-red-200">
      <div className="absolute -top-12 -right-8 h-56 w-56 rounded-full bg-red-300/40 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-amber-300/30 blur-3xl pointer-events-none" />
      <div className="relative grid grid-cols-1 sm:grid-cols-[auto,1fr] gap-6 sm:gap-8 items-center">
        <RedEnvelopeVisual />
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-black uppercase text px-2 py-0.5 rounded-full ${live ? "bg-red-600 text-white" : "bg-gray-200 text-gray-600"}`}
            >
              {status}
            </span>
            <span className="text-[10px] font-black uppercase text-red-700/80">
              Lucky · VRF
            </span>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-red-700/80 uppercase mb-0.5">
              Send GAS the lucky way
            </div>
            <div className="text-3xl sm:text-4xl font-black text-gray-900 leading-tight">
              Wrap. Share. Reveal.
            </div>
          </div>
          <p className="text-xs text-gray-700 max-w-md leading-relaxed">
            Drop GAS into a packet, pick how many recipients, and share the
            envelope ID. Each claimer pulls a random share through VRF until the
            envelope is empty.
          </p>
        </div>
      </div>
    </div>
  );
}

function RedEnvelopeVisual() {
  return (
    <div className="relative flex items-center justify-center w-32 h-32 sm:w-40 sm:h-40 shrink-0">
      {/* Envelope body */}
      <div className="absolute inset-x-2 inset-y-4 rounded-xl bg-gradient-to-b from-red-600 via-red-700 to-red-800 shadow-xl" />
      {/* Flap */}
      <div
        className="absolute top-3 inset-x-2 h-12 rounded-t-xl bg-gradient-to-b from-red-500 via-red-600 to-red-700"
        style={{ clipPath: "polygon(0 0, 50% 80%, 100% 0)" }}
      />
      {/* Gold seal */}
      <div className="absolute top-12 sm:top-14 left-1/2 -translate-x-1/2 h-9 w-9 rounded-full bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-600 shadow-md flex items-center justify-center text-sm font-black text-amber-900">
        福
      </div>
      {/* Floating coins */}
      <span
        className="absolute top-1 left-2 text-base"
        style={{ animation: "floatY 3s ease-in-out infinite" }}
      >
        ✨
      </span>
      <span
        className="absolute top-2 right-3 text-base"
        style={{ animation: "floatY 2.5s ease-in-out 0.7s infinite" }}
      >
        💰
      </span>
      <span
        className="absolute bottom-2 left-3 text-base"
        style={{ animation: "floatY 2.7s ease-in-out 1.2s infinite" }}
      >
        🪙
      </span>
      <style jsx>{`
        @keyframes floatY {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-6px);
          }
        }
      `}</style>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* DailyCheckin — streak fire + 7-day calendar */
/* ────────────────────────────────────────────────────────────────────── */

function DailyCheckinHero({ stats }: { stats: HeroStats }) {
  const totalUsers = stats["Total Users"] || "0";
  const totalCheckins = stats["Total Check-ins"] || "0";
  const totalRewarded = stats["Total Rewarded"] || "0 GAS";
  const weekReward = stats["7-Day Reward"] || "—";

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 p-6 sm:p-8 border border-emerald-100">
      <div className="absolute -top-12 -right-12 h-56 w-56 rounded-full bg-emerald-300/30 blur-3xl pointer-events-none" />
      <div className="relative grid grid-cols-1 sm:grid-cols-[auto,1fr] gap-6 sm:gap-8 items-center">
        <FireRing label={totalCheckins} />
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text px-2 py-0.5 rounded-full bg-emerald-500 text-white">
              Active
            </span>
            <span className="text-[10px] font-black uppercase text-emerald-700/80">
              Streak · Daily
            </span>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-emerald-700/80 uppercase mb-0.5">
              Show up daily, claim {weekReward}
            </div>
            <div className="text-3xl sm:text-4xl font-black text-gray-900 leading-tight">
              {totalUsers}{" "}
              <span className="text-base sm:text-lg text-emerald-700/80 font-semibold">
                users keeping streaks alive
              </span>
            </div>
          </div>
          <div className="inline-flex flex-wrap items-center gap-3">
            <Pill label="Rewarded" value={totalRewarded} />
            <Pill label="Check-ins" value={totalCheckins} />
            <Pill label="7-Day reward" value={weekReward} />
          </div>
          <p className="text-xs text-gray-600 max-w-md leading-relaxed">
            One tap per UTC day, no gas needed. Hit the 7-day milestone to claim
            a GAS bonus and unlock loyalty NFT badges.
          </p>
        </div>
      </div>
    </div>
  );
}

function FireRing({ label }: { label: string }) {
  return (
    <div className="relative flex items-center justify-center w-32 h-32 sm:w-40 sm:h-40 shrink-0">
      <div
        className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-400"
        style={{ animation: "spin 18s linear infinite" }}
      />
      <div className="absolute inset-1.5 rounded-full bg-white" />
      <div className="absolute inset-3 rounded-full bg-gradient-to-br from-emerald-50 to-white" />
      <div className="relative z-10 text-center">
        <div className="text-3xl mb-1">🔥</div>
        <div className="text-2xl font-black text-emerald-700 tabular-nums">
          {label}
        </div>
        <div className="text-[9px] font-bold uppercase text-emerald-700/70 mt-1">
          Total Check-ins
        </div>
      </div>
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 border border-emerald-100 shadow-sm">
      <span className="text-[10px] font-bold uppercase text-emerald-700/70">
        {label}
      </span>
      <span className="text-xs font-black text-gray-900 tabular-nums">
        {value}
      </span>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* SelfLoan — health gauge + collateral / debt summary */
/* ────────────────────────────────────────────────────────────────────── */

function SelfLoanHero({ stats }: { stats: HeroStats }) {
  const totalLoans = stats["Total Loans"] || "0";
  const collateral = stats["Collateral Locked"] || "0 NEO";
  const debt = stats["Outstanding Debt"] || "0 GAS";
  const repaid = stats["Total Repaid"] || "0 GAS";
  const ltvRange = stats["LTV Range"] || "—";

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-50 via-blue-50 to-cyan-50 p-6 sm:p-8 border border-sky-100">
      <div className="absolute -top-12 -right-12 h-56 w-56 rounded-full bg-sky-300/30 blur-3xl pointer-events-none" />
      <div className="relative grid grid-cols-1 sm:grid-cols-[auto,1fr] gap-6 sm:gap-8 items-center">
        <VaultIcon label={totalLoans} />
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text px-2 py-0.5 rounded-full bg-sky-500 text-white">
              Active
            </span>
            <span className="text-[10px] font-black uppercase text-sky-700/80">
              DeFi · No-liquidation
            </span>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-sky-700/80 uppercase mb-0.5">
              Borrow GAS, NEO yield repays it
            </div>
            <div className="text-3xl sm:text-4xl font-black text-gray-900 leading-tight">
              Lock NEO. <span className="text-sky-700">Get GAS today.</span>
            </div>
          </div>
          <div className="inline-flex flex-wrap items-center gap-2">
            <Pill label="Collateral" value={collateral} />
            <Pill label="Debt" value={debt} />
            <Pill label="Repaid" value={repaid} />
            <Pill label="LTV" value={ltvRange} />
          </div>
          <p className="text-xs text-gray-600 max-w-md leading-relaxed">
            Lock NEO, draw GAS, and let staking rewards repay your loan over
            time. NEO unlocks automatically once the debt is cleared — no
            liquidation risk.
          </p>
        </div>
      </div>
    </div>
  );
}

function VaultIcon({ label }: { label: string }) {
  return (
    <div className="relative flex items-center justify-center w-32 h-32 sm:w-40 sm:h-40 shrink-0">
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-sky-500 via-blue-600 to-cyan-600 shadow-xl" />
      <div className="absolute inset-2 rounded-xl border-4 border-white/30 bg-gradient-to-br from-sky-400 to-blue-500" />
      <div className="relative z-10 text-center text-white">
        <div className="text-3xl">🔒</div>
        <div className="text-2xl font-black tabular-nums leading-tight mt-1">
          {label}
        </div>
        <div className="text-[9px] font-bold uppercase text-white/80 mt-0.5">
          Loans
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* Anchors — AA agent voting + protected stake/reward boundary */
/* ────────────────────────────────────────────────────────────────────── */

function AnchorHero({
  stats,
  mode,
}: {
  stats: HeroStats;
  mode: "trust" | "profit";
}) {
  const totalStaked = stats["Total Staked"] || "0 NEO";
  const agents = stats["Agents"] || "0";
  const rewardReserve = stats["Reward Reserve"] || "0 GAS";
  const status = stats["Status"] || "—";
  const isProfit = mode === "profit";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl p-6 sm:p-8 border ${
        isProfit
          ? "bg-gradient-to-br from-emerald-50 via-teal-50 to-lime-50 border-emerald-100"
          : "bg-gradient-to-br from-slate-50 via-teal-50 to-cyan-50 border-teal-100"
      }`}
    >
      <div className="absolute inset-0 opacity-40 pointer-events-none bg-[linear-gradient(135deg,rgba(255,255,255,0.8)_0,rgba(255,255,255,0)_45%)]" />
      <div className="relative grid grid-cols-1 sm:grid-cols-[auto,1fr] gap-6 sm:gap-8 items-center">
        <AnchorMark label={agents} profit={isProfit} />
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span
              className={`text-[10px] font-black uppercase text px-2 py-0.5 rounded-full ${
                isProfit ? "bg-emerald-500 text-white" : "bg-teal-600 text-white"
              }`}
            >
              {status}
            </span>
            <span
              className={`text-[10px] font-black uppercase ${
                isProfit ? "text-emerald-700/80" : "text-teal-700/80"
              }`}
            >
              AA agents · Vote-only admin
            </span>
          </div>
          <div>
            <div
              className={`text-[11px] font-semibold uppercase mb-0.5 ${
                isProfit ? "text-emerald-700/80" : "text-teal-700/80"
              }`}
            >
              {isProfit
                ? "Highest expected GAS route"
                : "Governance routing with custody boundaries"}
            </div>
            <div className="text-3xl sm:text-4xl font-black text-gray-900 leading-tight">
              {isProfit ? "Vote for profit." : "Vote with trust."}
            </div>
          </div>
          <div className="inline-flex flex-wrap items-center gap-2">
            <Pill label="Staked" value={totalStaked} />
            <Pill label="Agents" value={agents} />
            <Pill label="Rewards" value={rewardReserve} />
          </div>
          <p className="text-xs text-gray-600 max-w-md leading-relaxed">
            {isProfit
              ? "ProfitAnchor keeps NEO voting focused on the best recorded GAS yield while preserving user-only withdrawal and reward claims."
              : "TrustAnchor makes governance routing explicit: admins manage AA agent vote routes, not user stake or reward withdrawals."}
          </p>
        </div>
      </div>
    </div>
  );
}

function AnchorMark({ label, profit }: { label: string; profit: boolean }) {
  return (
    <div className="relative flex items-center justify-center w-32 h-32 sm:w-40 sm:h-40 shrink-0">
      <div
        className={`absolute inset-0 rounded-3xl ${
          profit
            ? "bg-gradient-to-br from-emerald-500 via-teal-500 to-lime-400"
            : "bg-gradient-to-br from-slate-600 via-teal-600 to-cyan-500"
        } shadow-xl`}
      />
      <div className="absolute inset-3 rounded-2xl bg-white/90" />
      <div className="relative z-10 text-center">
        <div
          className={`mx-auto mb-2 h-12 w-12 rounded-full border-8 ${
            profit ? "border-lime-400" : "border-teal-500"
          }`}
        />
        <div className="text-2xl font-black text-gray-900 tabular-nums leading-tight">
          {label}
        </div>
        <div className="text-[9px] font-bold uppercase text-gray-500 mt-0.5">
          Agents
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/* NeoPay — streaming pipe + total streams */
/* ────────────────────────────────────────────────────────────────────── */

function NeoPayHero({ stats }: { stats: HeroStats }) {
  const totalStreams = stats["Total Streams"] || "0";

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 via-green-50 to-lime-50 p-6 sm:p-8 border border-emerald-100">
      <div className="absolute -top-12 -right-12 h-56 w-56 rounded-full bg-emerald-300/30 blur-3xl pointer-events-none" />
      <div className="relative grid grid-cols-1 sm:grid-cols-[auto,1fr] gap-6 sm:gap-8 items-center">
        <StreamPipe label={totalStreams} />
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase text px-2 py-0.5 rounded-full bg-emerald-500 text-white">
              Active
            </span>
            <span className="text-[10px] font-black uppercase text-emerald-700/80">
              Payment · Per-second
            </span>
          </div>
          <div>
            <div className="text-[11px] font-semibold text-emerald-700/80 uppercase mb-0.5">
              On-chain payroll, subscriptions, vesting
            </div>
            <div className="text-3xl sm:text-4xl font-black text-gray-900 leading-tight">
              Stream <span className="text-emerald-700">GAS / NEO</span>
            </div>
          </div>
          <p className="text-xs text-gray-600 max-w-md leading-relaxed">
            Configure total amount, cadence, and beneficiary. Funds drip out per
            second on a deterministic schedule. Recipients claim accrued amounts
            whenever they want.
          </p>
        </div>
      </div>
    </div>
  );
}

function StreamPipe({ label }: { label: string }) {
  return (
    <div className="relative flex items-center justify-center w-32 h-32 sm:w-40 sm:h-40 shrink-0">
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-emerald-400 via-green-500 to-lime-400" />
      <div className="absolute inset-2 rounded-full bg-white" />
      <div className="absolute inset-3 rounded-full bg-gradient-to-br from-emerald-50 via-white to-emerald-50" />
      <div className="relative z-10 text-center">
        <div className="text-3xl">💸</div>
        <div className="text-2xl font-black text-emerald-700 tabular-nums leading-tight mt-1">
          {label}
        </div>
        <div className="text-[9px] font-bold uppercase text-emerald-700/70 mt-0.5">
          Streams
        </div>
      </div>
      {/* Drip particles */}
      <span
        className="absolute bottom-1 left-6 text-xs"
        style={{ animation: "drip 2s ease-in 0s infinite" }}
      >
        ·
      </span>
      <span
        className="absolute bottom-1 left-12 text-xs"
        style={{ animation: "drip 2s ease-in 0.6s infinite" }}
      >
        ·
      </span>
      <span
        className="absolute bottom-1 left-20 text-xs"
        style={{ animation: "drip 2s ease-in 1.2s infinite" }}
      >
        ·
      </span>
      <style jsx>{`
        @keyframes drip {
          0% {
            transform: translateY(-30px);
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
          100% {
            transform: translateY(20px);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
