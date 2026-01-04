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

// Compound Capsule - Capsule grow
export function CompoundCapsuleAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="animate-pulse">
        <span className="text-5xl">💊</span>
      </div>
    </div>
  );
}

// Self Loan - Loan cycle
export function SelfLoanAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="animate-spin" style={{ animationDuration: "3s" }}>
        <span className="text-5xl">🔄</span>
      </div>
    </div>
  );
}
