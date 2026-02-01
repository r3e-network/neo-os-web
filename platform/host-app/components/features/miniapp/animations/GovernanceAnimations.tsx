/**
 * Governance MiniApp Animations
 */

"use client";

// Gov Booster - Rocket launch
export function GovBoosterAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="animate-bounce">
        <span className="text-5xl">🚀</span>
      </div>
    </div>
  );
}

// Burn League - Fire flames
export function BurnLeagueAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center gap-2">
      {["🔥", "🔥", "🔥"].map((emoji, i) => (
        <span key={i} className="text-4xl animate-pulse" style={{ animationDelay: `${i * 0.2}s` }}>
          {emoji}
        </span>
      ))}
    </div>
  );
}

// Doomsday Clock - Ticking clock
export function DoomsdayClockAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="animate-spin" style={{ animationDuration: "3s" }}>
        <span className="text-5xl">⏰</span>
      </div>
    </div>
  );
}

// Masquerade DAO - Mask reveal
export function MasqueradeDAOAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="animate-pulse">
        <span className="text-5xl">🎭</span>
      </div>
    </div>
  );
}

// Gov Merc - Swords clash
export function GovMercAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center gap-1">
      <span className="text-4xl animate-bounce" style={{ animationDelay: "0s" }}>
        ⚔️
      </span>
      <span className="text-4xl animate-bounce" style={{ animationDelay: "0.3s" }}>
        🛡️
      </span>
    </div>
  );
}

// Candidate Vote - Ballot box
export function CandidateVoteAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="animate-bounce">
        <span className="text-5xl">🗳️</span>
      </div>
    </div>
  );
}
