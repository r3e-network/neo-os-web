import { describe, expect, it } from "vitest";

import { computeQuadraticMatches } from "../../quadratic-funding/src/composables/quadraticMatch";

/**
 * Quadratic-funding match suggestion logic.
 *
 * Weight = contributorCount × totalContributed (equal-split estimate of the
 * canonical (Σ√c)² weight from the per-project aggregates the contract exposes).
 * Match = matchingPool × weight / Σweights, floor-divided so the distributed
 * total never exceeds the pool.
 */
describe("computeQuadraticMatches", () => {
  it("splits the pool proportionally to contributorCount × totalContributed", () => {
    // A: 4 donors × 4 GAS = weight 16 ; B: 1 donor × 4 GAS = weight 4.
    // Pool 10 GAS → A gets 16/20, B gets 4/20.
    const matches = computeQuadraticMatches(
      [
        { id: "1", totalContributed: 400000000n, contributorCount: 4n },
        { id: "2", totalContributed: 400000000n, contributorCount: 1n },
      ],
      1000000000n,
    );
    expect(matches.map((m) => m.match)).toEqual([800000000n, 200000000n]);
    // Breadth of donors beats a single equal-sized whale.
    expect(matches[0].match).toBeGreaterThan(matches[1].match);
  });

  it("never distributes more than the matching pool (floor division)", () => {
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
    expect(distributed).toBeLessThanOrEqual(pool);
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
});
