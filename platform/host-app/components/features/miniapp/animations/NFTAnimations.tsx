/**
 * NFT MiniApp Animations
 */

"use client";

// Canvas - Brush stroke
export function CanvasAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <span className="text-5xl animate-brush-stroke">🖌️</span>
        <div className="absolute -bottom-2 left-0 w-16 h-2 bg-gradient-to-r from-red-500 via-yellow-500 to-blue-500 rounded animate-paint-trail" />
      </div>
    </div>
  );
}

// NFT Evolve - Evolution morph
export function NFTEvolveAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <span className="text-5xl animate-evolve-morph">🎨</span>
        <span className="absolute -top-2 -right-2 text-2xl animate-sparkle">✨</span>
        <span className="absolute top-0 right-0 text-xl animate-bounce">⬆️</span>
      </div>
    </div>
  );
}

// NFT Chimera - Chimera merge
export function NFTChimeraAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex items-center">
        <span className="text-4xl animate-merge-left">🦁</span>
        <span className="text-2xl animate-pulse mx-1">➕</span>
        <span className="text-4xl animate-merge-right">🐉</span>
      </div>
    </div>
  );
}

// Schrodinger NFT - Box mystery
export function SchrodingerNFTAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <span className="text-5xl animate-box-shake">📦</span>
        <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-3xl animate-mystery-flicker">❓</span>
        <span className="absolute -bottom-2 -right-2 text-2xl opacity-50 animate-pulse">🐱</span>
      </div>
    </div>
  );
}

// Melting Asset - Melt drip
export function MeltingAssetAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <span className="text-5xl animate-melt">💎</span>
        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-1">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="w-2 h-4 bg-cyan-400 rounded-full animate-drip"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// On Chain Tarot - Card flip
export function OnChainTarotAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="animate-tarot-flip perspective-500">
        <div className="w-16 h-24 bg-gradient-to-br from-purple-600 to-indigo-800 rounded-lg flex items-center justify-center shadow-xl">
          <span className="text-3xl">🔮</span>
        </div>
      </div>
    </div>
  );
}

// Garden of Neo - Plant grow
export function GardenOfNeoAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <span className="text-5xl animate-plant-grow origin-bottom">🌱</span>
        <span className="absolute -top-4 -right-2 text-2xl animate-float-slow">🦋</span>
        <span className="absolute -top-2 -left-2 text-xl animate-pulse">☀️</span>
      </div>
    </div>
  );
}

// Graveyard - Ghost rise
export function GraveyardAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <span className="text-4xl">🪦</span>
        <span className="absolute -top-8 left-1/2 -translate-x-1/2 text-4xl animate-ghost-rise">👻</span>
      </div>
    </div>
  );
}

// Parasite - Parasite attach
export function ParasiteAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="relative">
        <span className="text-5xl">💎</span>
        <span className="absolute -top-2 -right-2 text-3xl animate-parasite-attach">🦠</span>
      </div>
    </div>
  );
}
