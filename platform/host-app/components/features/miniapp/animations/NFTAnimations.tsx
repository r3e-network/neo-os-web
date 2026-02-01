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

// Garden of Neo - Flower grow
export function GardenOfNeoAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="animate-pulse">
        <span className="text-5xl">🌸</span>
      </div>
    </div>
  );
}

// Graveyard - Ghost float
export function GraveyardAnimation() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="animate-bounce">
        <span className="text-5xl">👻</span>
      </div>
    </div>
  );
}
