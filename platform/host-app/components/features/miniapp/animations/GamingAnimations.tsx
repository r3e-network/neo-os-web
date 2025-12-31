/**
 * Custom MiniApp Animations - Unique animations for each MiniApp
 */

"use client";

// ============= Gaming Animations =============

// Lottery - Slot machine spin
export function LotteryAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex gap-2">
        {["7️⃣", "🍀", "💎"].map((emoji, i) => (
          <div key={i} className="w-12 h-16 bg-black/30 rounded-lg flex items-center justify-center overflow-hidden">
            <span className="text-3xl animate-slot-spin" style={{ animationDelay: `${i * 0.2}s` }}>
              {emoji}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Coin Flip - 3D rotating coin
export function CoinFlipAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="animate-coin-flip perspective-500">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center shadow-xl">
          <span className="text-4xl">🪙</span>
        </div>
      </div>
    </div>
  );
}

// Dice Game - Rolling dice
export function DiceAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center gap-4">
      <div className="animate-dice-roll">
        <span className="text-5xl drop-shadow-lg">🎲</span>
      </div>
      <div className="animate-dice-roll" style={{ animationDelay: "0.3s" }}>
        <span className="text-5xl drop-shadow-lg">🎲</span>
      </div>
    </div>
  );
}

// Scratch Card - Reveal effect
export function ScratchCardAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <span className="text-6xl animate-scratch-reveal">🎫</span>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-scratch-shine" />
      </div>
    </div>
  );
}

// Secret Poker - Card shuffle
export function PokerAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative w-32 h-20">
        {["♠️", "♥️", "♦️", "♣️"].map((suit, i) => (
          <div
            key={i}
            className="absolute w-12 h-16 bg-white rounded-lg shadow-lg flex items-center justify-center animate-card-shuffle"
            style={{
              left: `${i * 20}px`,
              animationDelay: `${i * 0.15}s`,
              zIndex: 4 - i,
            }}
          >
            <span className="text-2xl">{suit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Neo Crash - Rocket launch
export function CrashAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <span className="text-6xl animate-rocket-launch">🚀</span>
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-2xl animate-pulse">📈</div>
      </div>
    </div>
  );
}

// Candle Wars - Flickering candles
export function CandleWarsAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center gap-3">
      <div className="flex flex-col items-center">
        <span className="text-4xl animate-candle-green">📈</span>
        <div className="w-4 h-12 bg-green-500 rounded animate-pulse" />
      </div>
      <div className="flex flex-col items-center">
        <span className="text-4xl animate-candle-red">📉</span>
        <div className="w-4 h-8 bg-red-500 rounded animate-pulse" />
      </div>
    </div>
  );
}

// Algo Battle - Robot clash
export function AlgoBattleAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex items-center gap-4">
        <span className="text-5xl animate-battle-left">🤖</span>
        <span className="text-3xl animate-pulse">⚔️</span>
        <span className="text-5xl animate-battle-right">🤖</span>
      </div>
    </div>
  );
}

// Fog Chess - Chess piece slide
export function FogChessAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <div className="absolute inset-0 bg-white/20 blur-xl animate-fog-drift" />
        <span className="text-6xl animate-chess-move relative z-10">♟️</span>
      </div>
    </div>
  );
}

// Fog Puzzle - Puzzle connect
export function FogPuzzleAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex">
        <span className="text-5xl animate-puzzle-left">🧩</span>
        <span className="text-5xl animate-puzzle-right">🧩</span>
      </div>
    </div>
  );
}

// Crypto Riddle - Question bounce
export function CryptoRiddleAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <span className="text-6xl animate-riddle-bounce">❓</span>
        <span className="absolute -right-4 -bottom-2 text-3xl animate-key-appear">🔑</span>
      </div>
    </div>
  );
}

// World Piano - Keys press
export function WorldPianoAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="w-6 h-16 bg-white rounded-b-lg shadow-lg animate-piano-key"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
      <span className="absolute top-4 text-3xl animate-float-slow">🎵</span>
    </div>
  );
}

// Million Piece Map - Map pan
export function MillionPieceMapAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
      <div className="animate-map-pan">
        <span className="text-7xl">🗺️</span>
      </div>
      <span className="absolute text-2xl animate-pin-drop">📍</span>
    </div>
  );
}

// Puzzle Mining - Pickaxe swing
export function PuzzleMiningAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <span className="text-5xl animate-pickaxe-swing origin-bottom-right">⛏️</span>
        <span className="absolute -bottom-2 right-0 text-3xl animate-gem-sparkle">💎</span>
      </div>
    </div>
  );
}

// Scream to Earn - Soundwave
export function ScreamToEarnAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <span className="text-6xl">🗣️</span>
        <div className="absolute left-full top-1/2 -translate-y-1/2 flex gap-1">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-2 bg-white/60 rounded animate-soundwave"
              style={{
                height: `${20 + i * 10}px`,
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
