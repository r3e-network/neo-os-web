/**
 * Social MiniApp Animations
 */

"use client";

// AI Soulmate - Heart beat
export function AISoulmateAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <span className="text-6xl animate-heartbeat">💕</span>
        <span className="absolute -right-4 -top-2 text-3xl">🤖</span>
      </div>
    </div>
  );
}

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

// Dark Radio - Radio wave
export function DarkRadioAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <span className="text-5xl">📻</span>
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="absolute top-1/2 left-full w-8 h-1 bg-purple-400/60 rounded animate-radio-wave"
            style={{ animationDelay: `${i * 0.2}s`, top: `${40 + i * 10}%` }}
          />
        ))}
      </div>
    </div>
  );
}

// Dev Tipping - Coin rain
export function DevTippingAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
      <span className="text-5xl z-10">👨‍💻</span>
      {[...Array(5)].map((_, i) => (
        <span
          key={i}
          className="absolute text-2xl animate-coin-rain"
          style={{ left: `${20 + i * 15}%`, animationDelay: `${i * 0.3}s` }}
        >
          💸
        </span>
      ))}
    </div>
  );
}

// Bounty Hunter - Target lock
export function BountyHunterAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <div className="w-20 h-20 border-4 border-red-500 rounded-full animate-target-lock" />
        <span className="absolute inset-0 flex items-center justify-center text-4xl">🎯</span>
      </div>
    </div>
  );
}

// Breakup Contract - Paper tear
export function BreakupContractAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex">
        <span className="text-4xl animate-tear-left">📄</span>
        <span className="text-4xl animate-tear-right">📄</span>
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

// Geo Spotlight - Spotlight scan
export function GeoSpotlightAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative w-24 h-24">
        <div className="absolute inset-0 bg-yellow-400/20 rounded-full animate-spotlight-scan" />
        <span className="absolute inset-0 flex items-center justify-center text-5xl">🌍</span>
      </div>
    </div>
  );
}

// Whisper Chain - Whisper bubble
export function WhisperChainAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="w-8 h-8 bg-purple-400/40 rounded-full animate-whisper-chain"
            style={{ animationDelay: `${i * 0.3}s` }}
          />
        ))}
      </div>
      <span className="absolute text-3xl">🤫</span>
    </div>
  );
}

// Pay to View - Eye unlock
export function PayToViewAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <span className="text-6xl animate-eye-open">👁️</span>
        <span className="absolute -bottom-2 -right-2 text-2xl animate-unlock">🔓</span>
      </div>
    </div>
  );
}

// Dead Switch - Switch toggle
export function DeadSwitchAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <div className="w-16 h-8 bg-gray-700 rounded-full p-1">
          <div className="w-6 h-6 bg-red-500 rounded-full animate-switch-toggle" />
        </div>
        <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-3xl">💀</span>
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
