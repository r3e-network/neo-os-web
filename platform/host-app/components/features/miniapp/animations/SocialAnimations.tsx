/**
 * Social MiniApp Animations
 */

"use client";

// Red Envelope - Envelope open
export function RedEnvelopeAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <span className="text-6xl animate-envelope-open">🧧</span>
        <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-2xl animate-coin-burst">💰</span>
      </div>
    </div>
  );
}

// Ex Files - Folder open
export function ExFilesAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <span className="text-6xl animate-folder-open">📁</span>
        <span className="absolute -top-4 left-1/2 text-2xl animate-file-pop">📄</span>
      </div>
    </div>
  );
}

// Time Capsule - Capsule bury
export function TimeCapsuleAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <span className="text-5xl animate-capsule-bury">⏳</span>
        <span className="absolute -bottom-4 text-2xl animate-pulse">📦</span>
      </div>
    </div>
  );
}

// Dev Tipping - Coin toss
export function DevTippingAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="animate-bounce">
        <span className="text-5xl">💸</span>
      </div>
    </div>
  );
}

// Breakup Contract - Heart break
export function BreakupContractAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="animate-pulse">
        <span className="text-5xl">💔</span>
      </div>
    </div>
  );
}
