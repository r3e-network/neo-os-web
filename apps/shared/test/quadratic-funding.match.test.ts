import { describe, expect, it } from "vitest";

import { computeQuadraticMatches } from "../../quadratic-funding/src/composables/quadraticMatch";

/**
 * Quadratic-funding match suggestion logic.
 *
 * Weight = (contributorCount - 1) × totalContributed: the equal-split
 * simplification of the CLR subsidy signal `(Σ√c)² - Σc` from the only
 * aggregates the deployed contract exposes. Largest-remainder allocation uses
 * the whole base-unit pool without exceeding it.
 */
describe("computeQuadraticMatches", () => {
  it("splits the pool proportionally to the estimated CLR subsidy signal", () => {
    // A: (4-1) × 4 GAS = 12 ; B: (2-1) × 4 GAS = 4.
    // Pool 10 GAS → A gets 75%, B gets 25%.
    const matches = computeQuadraticMatches(
      [
        { id: "1", totalContributed: 400000000n, contributorCount: 4n },
        { id: "2", totalContributed: 400000000n, contributorCount: 2n },
      ],
      1000000000n,
    );
    expect(matches.map((m) => m.match)).toEqual([750000000n, 250000000n]);
    // Breadth of donors beats a single equal-sized whale.
    expect(matches[0].match).toBeGreaterThan(matches[1].match);
  });

  it("uses the whole pool without ever exceeding it", () => {
    const pool = 1000000000n;
    const matches = computeQuadraticMatches(
      [
        { id: "1", totalContributed: 100000001n, contributorCount: 3n },
        { id: "2", totalContributed: 100000001n, contributorCount: 3n },
        { id: "3", totalContributed: 100000001n, contributorCount: 3n },
      ],
      pool,
    );
    const distributed = matches.reduce((sum, m) => sum + m.match, 0n);
    expect(distributed).toBe(pool);
  });

  it("returns zero matches when there are no contributions", () => {
    const matches = computeQuadraticMatches(
      [
        { id: "1", totalContributed: 0n, contributorCount: 0n },
        { id: "2", totalContributed: 0n, contributorCount: 0n },
      ],
      1000000000n,
    );
    expect(matches.every((m) => m.match === 0n)).toBe(true);
  });

  it("gives the whole pool to the only project with contributions", () => {
    const matches = computeQuadraticMatches(
      [
        { id: "1", totalContributed: 500000000n, contributorCount: 2n },
        { id: "2", totalContributed: 0n, contributorCount: 0n },
      ],
      1000000000n,
    );
    expect(matches[0].match).toBe(1000000000n);
    expect(matches[1].match).toBe(0n);
  });

  it("treats negative aggregates as zero weight", () => {
    const matches = computeQuadraticMatches(
      [{ id: "1", totalContributed: -5n, contributorCount: -2n }],
      1000000000n,
    );
    expect(matches[0].match).toBe(0n);
  });

  it("does not invent a quadratic subsidy for a single wallet", () => {
    const matches = computeQuadraticMatches(
      [{ id: "1", totalContributed: 500000000n, contributorCount: 1n }],
      1000000000n,
    );
    expect(matches[0]).toMatchObject({ weight: 0n, match: 0n });
  });

  it("keeps inactive projects visible with zero allocation", () => {
    const matches = computeQuadraticMatches(
      [
        { id: "1", totalContributed: 500000000n, contributorCount: 3n, eligible: false },
        { id: "2", totalContributed: 500000000n, contributorCount: 3n },
      ],
      1000000000n,
    );
    expect(matches.map((entry) => entry.match)).toEqual([0n, 1000000000n]);
  });
});
