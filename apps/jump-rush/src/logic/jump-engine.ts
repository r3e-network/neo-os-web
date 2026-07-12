/**
 * Deterministic platform generation for Jump Rush.
 *
 * Platforms are generated from seed bytes (from the TEE), producing the same
 * layout deterministically. Gap distances vary by difficulty.
 */

export interface Platform {
  x: number;       // x position in the game world
  width: number;   // platform width in pixels
  gap: number;     // gap from the previous platform's right edge
}

export type Difficulty = 0 | 1 | 2;

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim().toLowerCase().replace(/^0x/, "");
  if (!/^[0-9a-f]*$/.test(clean) || clean.length % 2 !== 0) {
    throw new Error(`invalid hex seed: ${hex}`);
  }
  if (clean.length !== 64) {
    throw new Error("seed must be 32 bytes");
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

interface SeedStream {
  next: () => number;
}

function streamOf(seed: Uint8Array): SeedStream {
  if (seed.length !== 32) throw new Error("seed must be 32 bytes");
  let cursor = 0;
  return {
    next: () => {
      const byte = seed[cursor % 32] ?? 0;
      cursor += 1;
      return byte;
    },
  };
}

/** Generate deterministic platform layout from seed bytes. */
export function generatePlatforms(seed: Uint8Array, difficulty: number): Platform[] {
  const stream = streamOf(seed);

  // Width/gap ranges per difficulty
  const configs: Record<number, { minWidth: number; maxWidth: number; minGap: number; maxGap: number; count: number }> = {
    0: { minWidth: 100, maxWidth: 140, minGap: 60, maxGap: 120, count: 15 },  // Easy: wide, short gaps
    1: { minWidth: 85, maxWidth: 115, minGap: 100, maxGap: 180, count: 25 },  // Medium
    2: { minWidth: 70, maxWidth: 100, minGap: 140, maxGap: 260, count: 35 },  // Hard: narrow, long gaps
  };

  const fallbackConfig = configs[0]!;
  const config = configs[difficulty] ?? fallbackConfig;
  const platforms: Platform[] = [];

  // Starting platform
  platforms.push({ x: 60, width: 120, gap: 0 });

  for (let i = 1; i <= config.count; i += 1) {
    const widthRange = config.maxWidth - config.minWidth;
    const gapRange = config.maxGap - config.minGap;

    const width = config.minWidth + (stream.next() % (widthRange + 1));
    const gap = config.minGap + (stream.next() % (gapRange + 1));

    const prev = platforms[platforms.length - 1];
    if (!prev) continue; // safety check

    const x = prev.x + prev.width + gap;
    platforms.push({ x, width, gap });
  }

  return platforms;
}

/**
 * Calculate the jump power needed to reach a given gap distance.
 * Returns a charge time (0-1000ms) where higher charge = longer jump.
 * The relationship is sqrt-scaled: charge ~ 100 * sqrt(gap / 50)
 */
export function powerForGap(gap: number): number {
  // Map gap distance to required charge (0-1000ms)
  const raw = Math.sqrt(Math.max(0, gap) / 50) * 100;
  return Math.min(1000, Math.round(raw));
}

/**
 * Determine jump landing position given charge time (0-1000) and gap distance.
 * Returns offset from platform start (negative = fell short, > width = overshot)
 */
export function landingOffset(chargeMs: number, gap: number): number {
  // Ideal charge needed
  const ideal = powerForGap(gap);
  // How far the jump goes: base + scaled by charge
  const jumpDistance = (chargeMs / Math.max(1, ideal)) * gap;
  // Offset relative to platform start (0 = left edge)
  return jumpDistance - gap;
}

/**
 * Check if a landing is perfect (within center 30% of platform).
 */
export function isPerfectLanding(offset: number, platformWidth: number): boolean {
  const centerStart = platformWidth * 0.35;
  const centerEnd = platformWidth * 0.65;
  return offset >= centerStart && offset <= centerEnd;
}

export interface JumpEvaluation {
  /** Horizontal landing offset from the target platform's left edge. */
  landingOffset: number;
  /** True when the landing is anywhere on the target platform. */
  landed: boolean;
  /** True when the landing is inside the platform's centre 30%. */
  perfect: boolean;
  /** Charge value surfaced by the enclave engine as its timing hint. */
  idealCharge: number;
}

/**
 * Evaluate the same normalized 0..100 charge level used by the reviewed
 * Morpheus Jump engine. Keeping this formula in the playable scene prevents a
 * jump that looks successful locally from being rejected during replay.
 */
export function evaluateJumpLevel(
  chargeLevel: number,
  gap: number,
  platformWidth: number,
): JumpEvaluation {
  const safeGap = Math.max(0, Number(gap) || 0);
  const safeWidth = Math.max(1, Number(platformWidth) || 1);
  const validCharge = Number.isFinite(chargeLevel) && chargeLevel >= 0 && chargeLevel <= 100;
  const landingOffset = validCharge
    ? (chargeLevel / 100) * (safeGap + safeWidth) - safeGap
    : Number.NaN;
  const landed = validCharge && landingOffset >= 0 && landingOffset <= safeWidth;
  return {
    landingOffset,
    landed,
    perfect: landed && isPerfectLanding(landingOffset, safeWidth),
    idealCharge: Math.min(100, Math.max(0, 50 + safeGap / 4)),
  };
}

/**
 * Calculate score for a jump.
 */
export function jumpScore(perfect: boolean, combo: number): number {
  const base = 1;
  const perfectBonus = perfect ? 1 : 0;
  const comboMultiplier = 1 + (combo > 0 ? combo * 0.5 : 0);
  return Math.round((base + perfectBonus) * comboMultiplier);
}
