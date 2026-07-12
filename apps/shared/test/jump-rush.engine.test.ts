import { describe, expect, it } from "vitest";

import {
  evaluateJumpLevel,
  generatePlatforms,
  hexToBytes,
  isPerfectLanding,
  jumpScore,
  landingOffset,
  powerForGap,
} from "../../jump-rush/src/logic/jump-engine";

/**
 * Jump Rush engine tests.
 *
 * The engine generates deterministic platform layouts from TEE seeds and
 * handles charge/landing mechanics for the side-scrolling runner.
 */

function hexSeed(hex: string): Uint8Array {
  return hexToBytes(hex);
}

const SEED_A = "ab".repeat(32); // 32 zero-bytes? no, "ab" repeated 32 times = 32 bytes

describe("jump-rush platform generation", () => {
  it("produces deterministic platforms for the same seed and difficulty", () => {
    const seed = hexSeed(SEED_A);
    const a1 = generatePlatforms(seed, 0);
    const a2 = generatePlatforms(seed, 0);
    expect(a1).toEqual(a2);
  });

  it("generates different platform counts per difficulty level", () => {
    const seed = hexSeed(SEED_A);
    const easy = generatePlatforms(seed, 0);
    const medium = generatePlatforms(seed, 1);
    const hard = generatePlatforms(seed, 2);
    // Starting platform + config count
    expect(easy).toHaveLength(16);  // 1 start + 15
    expect(medium).toHaveLength(26); // 1 start + 25
    expect(hard).toHaveLength(36);   // 1 start + 35
  });

  it("assigns narrower widths and larger gaps for harder difficulties", () => {
    const seed = hexSeed(SEED_A);
    const easy = generatePlatforms(seed, 0);
    const hard = generatePlatforms(seed, 2);
    // Skip the starting platform (index 0) and check the first generated platform
    const e1 = easy[1];
    const h1 = hard[1];
    expect(e1).toBeDefined();
    expect(h1).toBeDefined();
    // Hard should have narrower width range (70-100 vs 100-140)
    expect(h1.width).toBeLessThan(e1.width);
    // Hard should have larger gap range (140-260 vs 60-120)
    expect(h1.gap).toBeGreaterThan(e1.gap);
  });

  it("places platforms sequentially along the x-axis", () => {
    const seed = hexSeed(SEED_A);
    const platforms = generatePlatforms(seed, 0);
    for (let i = 1; i < platforms.length; i += 1) {
      const prev = platforms[i - 1];
      const curr = platforms[i];
      if (prev && curr) {
        expect(curr.x).toBe(prev.x + prev.width + curr.gap);
      }
    }
  });

  it("starts with a fixed starting platform", () => {
    const seed = hexSeed(SEED_A);
    const platforms = generatePlatforms(seed, 0);
    const start = platforms[0];
    expect(start).toBeDefined();
    expect(start.x).toBe(60);
    expect(start.width).toBe(120);
    expect(start.gap).toBe(0);
  });

  it("throws on non-32-byte seeds", () => {
    expect(() => hexToBytes("aabb")).toThrow("seed must be 32 bytes");
  });
});

describe("jump-rush charge and landing mechanics", () => {
  it("evaluates normalized charge with the Morpheus replay landing window", () => {
    const gap = 100;
    const width = 120;
    const centreCharge = ((gap + width / 2) / (gap + width)) * 100;

    expect(evaluateJumpLevel(20, gap, width).landed).toBe(false);
    expect(evaluateJumpLevel(centreCharge, gap, width)).toMatchObject({
      landed: true,
      perfect: true,
    });
    expect(evaluateJumpLevel(100, gap, width)).toMatchObject({
      landed: true,
      perfect: false,
      landingOffset: width,
    });
    expect(evaluateJumpLevel(101, gap, width).landed).toBe(false);
  });

  it("powerForGap returns 0–1000ms scaled by sqrt(gap/50)", () => {
    expect(powerForGap(0)).toBe(0);
    expect(powerForGap(50)).toBe(100);
    expect(powerForGap(200)).toBeGreaterThan(0);
    expect(powerForGap(200)).toBeLessThanOrEqual(1000);
    // Larger gap → larger power
    expect(powerForGap(150)).toBeGreaterThan(powerForGap(50));
  });

  it("landingOffset returns a positive offset when charge matches the gap", () => {
    // For a gap of 100, ideal charge is ~141ms (powerForGap(100))
    const gap = 100;
    const ideal = powerForGap(gap);
    const offset = landingOffset(ideal, gap);
    // With ideal charge, offset should be near 0 (landing at platform start)
    expect(Math.abs(offset)).toBeLessThan(5);
  });

  it("landingOffset returns negative when undercharged and >width when overcharged", () => {
    const gap = 100;
    // Under-charged
    const under = landingOffset(10, gap);
    expect(under).toBeLessThan(0);
    // Over-charged
    const over = landingOffset(1000, gap);
    expect(over).toBeGreaterThan(gap);
  });

  it("isPerfectLanding detects center 30% of the platform", () => {
    const width = 100;
    // Center 30% spans 35–65
    expect(isPerfectLanding(40, width)).toBe(true);
    expect(isPerfectLanding(50, width)).toBe(true);
    // Outside the zone
    expect(isPerfectLanding(20, width)).toBe(false);
    expect(isPerfectLanding(80, width)).toBe(false);
    // At exact boundaries: 35 and 65 should be inclusive
    expect(isPerfectLanding(35, width)).toBe(true);
    expect(isPerfectLanding(65, width)).toBe(true);
  });

  it("jumpScore applies combo multiplier correctly", () => {
    // Non-perfect, no combo: base 1
    expect(jumpScore(false, 0)).toBe(1);
    // Perfect, no combo: base 1 + perfectBonus 1 = 2
    expect(jumpScore(true, 0)).toBe(2);
    // Non-perfect, combo 2: 1 * (1 + 2*0.5) = 2
    expect(jumpScore(false, 2)).toBe(2);
    // Perfect, combo 2: (1+1) * (1 + 2*0.5) = 4
    expect(jumpScore(true, 2)).toBe(4);
    // Perfect, combo 5: (2) * (1 + 5*0.5) = 2 * 3.5 = 7
    expect(jumpScore(true, 5)).toBe(7);
  });
});
