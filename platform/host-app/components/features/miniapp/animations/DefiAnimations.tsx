/**
 * DeFi MiniApp Animations
 */

"use client";

// Flash Loan - Lightning bolt
export function FlashLoanAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <span className="text-6xl animate-lightning-flash">⚡</span>
        <span className="absolute -right-6 top-0 text-4xl animate-coin-fly">💰</span>
      </div>
    </div>
  );
}

// AI Trader - Chart line draw
export function AITraderAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative w-32 h-20">
        <svg className="w-full h-full" viewBox="0 0 100 60">
          <path
            d="M0,50 Q25,40 40,30 T70,20 T100,10"
            fill="none"
            stroke="#00e599"
            strokeWidth="3"
            className="animate-chart-draw"
          />
        </svg>
        <span className="absolute -top-2 right-0 text-3xl">🤖</span>
      </div>
    </div>
  );
}

// Grid Bot - Grid pattern pulse
export function GridBotAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="grid grid-cols-3 gap-1">
        {[...Array(9)].map((_, i) => (
          <div
            key={i}
            className="w-6 h-6 bg-cyan-400/40 rounded animate-grid-pulse"
            style={{ animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>
      <span className="absolute text-3xl">🤖</span>
    </div>
  );
}

// Bridge Guardian - Bridge connect
export function BridgeGuardianAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-blue-500 animate-pulse" />
        <div className="w-16 h-2 bg-gradient-to-r from-blue-500 to-purple-500 animate-bridge-connect" />
        <div className="w-8 h-8 rounded-full bg-purple-500 animate-pulse" />
      </div>
      <span className="absolute -top-6 text-3xl">🛡️</span>
    </div>
  );
}

// Gas Circle - Circle rotate
export function GasCircleAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative w-24 h-24">
        <div className="absolute inset-0 border-4 border-dashed border-green-400 rounded-full animate-spin-slow" />
        <div className="absolute inset-2 border-4 border-dashed border-cyan-400 rounded-full animate-reverse-spin" />
        <span className="absolute inset-0 flex items-center justify-center text-3xl">⛽</span>
      </div>
    </div>
  );
}

// IL Guard - Shield pulse
export function ILGuardAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <span className="text-6xl animate-shield-pulse">🛡️</span>
        <div className="absolute inset-0 bg-emerald-400/30 rounded-full blur-xl animate-pulse" />
      </div>
    </div>
  );
}

// Compound Capsule - Capsule grow
export function CompoundCapsuleAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <span className="text-5xl animate-capsule-grow">💊</span>
        <span className="absolute -top-4 -right-4 text-2xl animate-bounce">📈</span>
      </div>
    </div>
  );
}

// Dark Pool - Ripple wave
export function DarkPoolAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="absolute inset-0 border-2 border-purple-400/50 rounded-full animate-ripple"
            style={{ animationDelay: `${i * 0.4}s` }}
          />
        ))}
        <span className="relative text-5xl">🌑</span>
      </div>
    </div>
  );
}

// Dutch Auction - Price drop
export function DutchAuctionAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <span className="text-5xl">🔨</span>
        <span className="absolute -right-8 text-3xl animate-price-drop">💰</span>
        <span className="absolute -bottom-4 right-0 text-xl animate-bounce">⬇️</span>
      </div>
    </div>
  );
}

// No Loss Lottery - Safe spin
export function NoLossLotteryAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <div className="animate-spin-slow">
          <span className="text-6xl">🎯</span>
        </div>
        <span className="absolute -bottom-2 -right-2 text-3xl">🔒</span>
      </div>
    </div>
  );
}

// Quantum Swap - Particle orbit
export function QuantumSwapAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative w-24 h-24">
        <span className="absolute inset-0 flex items-center justify-center text-4xl">⚛️</span>
        <div className="absolute w-4 h-4 bg-cyan-400 rounded-full animate-orbit" />
        <div className="absolute w-3 h-3 bg-purple-400 rounded-full animate-orbit-reverse" />
      </div>
    </div>
  );
}

// Self Loan - Self loop
export function SelfLoanAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <span className="text-5xl">🏦</span>
        <div className="absolute -inset-4 border-2 border-dashed border-green-400 rounded-full animate-spin-slow" />
        <span className="absolute -top-2 -right-2 text-2xl animate-bounce">💰</span>
      </div>
    </div>
  );
}

// NeoBurger - Burger stack
export function NeoBurgerAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center animate-burger-stack">
        <div className="text-3xl">🍔</div>
        <div className="flex gap-1 mt-1">
          <span className="text-xl animate-bounce" style={{ animationDelay: "0.1s" }}>
            💰
          </span>
          <span className="text-xl animate-bounce" style={{ animationDelay: "0.2s" }}>
            💰
          </span>
        </div>
      </div>
    </div>
  );
}

// Price Ticker - Ticker scroll
export function PriceTickerAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
      <div className="flex gap-4 animate-ticker-scroll">
        <span className="text-3xl">📈</span>
        <span className="text-2xl text-green-400 font-bold">+5.2%</span>
        <span className="text-3xl">📉</span>
        <span className="text-2xl text-red-400 font-bold">-2.1%</span>
      </div>
    </div>
  );
}
