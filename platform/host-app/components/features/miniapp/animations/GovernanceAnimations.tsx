/**
 * Governance MiniApp Animations
 */

"use client";

// Secret Vote - Ballot drop
export function SecretVoteAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <span className="text-5xl">🗳️</span>
        <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-2xl animate-ballot-drop">📝</span>
      </div>
    </div>
  );
}

// Gov Booster - Boost rocket
export function GovBoosterAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <span className="text-5xl animate-boost-launch">🚀</span>
        <span className="absolute -bottom-4 text-2xl">🗳️</span>
      </div>
    </div>
  );
}

// Prediction Market - Crystal ball
export function PredictionMarketAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <span className="text-6xl animate-crystal-glow">🔮</span>
        <div className="absolute inset-0 bg-purple-400/30 rounded-full blur-xl animate-pulse" />
      </div>
    </div>
  );
}

// Burn League - Fire blaze
export function BurnLeagueAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <span className="text-6xl animate-fire-blaze">🔥</span>
        <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-2xl animate-bounce">🏆</span>
      </div>
    </div>
  );
}

// Doomsday Clock - Clock tick
export function DoomsdayClockAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <span className="text-6xl animate-clock-tick">⏰</span>
        <span className="absolute -bottom-2 -right-2 text-2xl animate-pulse text-red-500">☢️</span>
      </div>
    </div>
  );
}

// Masquerade DAO - Mask reveal
export function MasqueradeDAOAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <span className="text-6xl animate-mask-reveal">🎭</span>
      </div>
    </div>
  );
}

// Gov Merc - Handshake
export function GovMercAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex items-center gap-2">
        <span className="text-4xl animate-shake-left">🏛️</span>
        <span className="text-3xl animate-handshake">🤝</span>
        <span className="text-4xl animate-shake-right">💰</span>
      </div>
    </div>
  );
}
