/**
 * Client-side quadratic-funding match suggestion.
 *
 * The canonical CLR weight is `weight_i = (Σ_j √c_ij)²` over each donor j's
 * contribution to project i. The deployed contract only exposes per-project
 * aggregates (totalContributed `T_i`, contributorCount `n_i`), not the
 * per-donor breakdown, so we apply the equal-split estimate: assuming each of
 * the `n_i` donors gave `T_i / n_i`, `Σ√c = n_i · √(T_i/n_i) = √(n_i · T_i)`,
 * hence `weight_i = n_i · T_i`. This rewards breadth (more unique donors) over a
 * single whale, which is the core quadratic-funding property, while staying
 * computable from on-chain data. Operators can still override any suggested
 * amount before finalizing.
 *
 * All arithmetic is integer (base units / BigInt) to match the contract, with
 * floor division so the distributed total never exceeds the matching pool.
 */

export interface MatchInputProject {
  id: string;
  totalContributed: bigint;
  contributorCount: bigint;
}

export interface SuggestedMatch {
  id: string;
  /** Relative quadratic weight (n_i · T_i). */
  weight: bigint;
  /** Suggested match in asset base units. */
  match: bigint;
}

/**
 * Compute suggested matches for the projects in a round.
 *
 * @param projects     project aggregates in the round
 * @param matchingPool the round's matching pool, in asset base units
 * @returns one entry per input project (same order); empty match amounts are 0
 */
export function computeQuadraticMatches(
  projects: MatchInputProject[],
  matchingPool: bigint,
): SuggestedMatch[] {
  const weights = projects.map((project) => {
    const total = project.totalContributed > 0n ? project.totalContributed : 0n;
    const donors = project.contributorCount > 0n ? project.contributorCount : 0n;
    return { id: project.id, weight: donors * total };
  });

  const totalWeight = weights.reduce((sum, entry) => sum + entry.weight, 0n);
  if (totalWeight <= 0n || matchingPool <= 0n) {
    return weights.map((entry) => ({ id: entry.id, weight: entry.weight, match: 0n }));
  }

  // Floor division keeps Σmatch ≤ matchingPool (the contract asserts
  // totalMatched ≤ round.MatchingPool); any rounding dust stays unallocated and
  // is reclaimable by the creator via ClaimUnusedMatching.
  return weights.map((entry) => ({
    id: entry.id,
    weight: entry.weight,
    match: (matchingPool * entry.weight) / totalWeight,
  }));
}
