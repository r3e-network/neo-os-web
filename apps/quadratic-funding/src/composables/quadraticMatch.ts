/**
 * Client-side quadratic-funding match suggestion.
 *
 * The canonical CLR subsidy signal is
 * `weight_i = (Σ_j √c_ij)² - Σ_j c_ij` over each donor j's contribution to
 * project i. The deployed contract only exposes per-project aggregates
 * (totalContributed `T_i`, contributorCount `n_i`), not the per-donor
 * breakdown. Under the explicit equal-split assumption (`c_ij = T_i / n_i`),
 * the subsidy signal simplifies to `(n_i - 1) · T_i`.
 *
 * This is only an aggregate estimate. The contract counts wallet addresses,
 * not verified humans, so the result is not Sybil-resistant and must remain an
 * operator-reviewed suggestion rather than an automatic truth claim.
 *
 * All arithmetic is integer (base units / BigInt) to match the contract, with
 * floor division so the distributed total never exceeds the matching pool.
 */

export interface MatchInputProject {
  id: string;
  totalContributed: bigint;
  contributorCount: bigint;
  /** Inactive/rejected projects remain visible but receive zero suggested match. */
  eligible?: boolean;
}

export interface SuggestedMatch {
  id: string;
  /** Relative estimated subsidy weight ((n_i - 1) · T_i). */
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
  const weights = projects.map((project, index) => {
    const total = project.totalContributed > 0n ? project.totalContributed : 0n;
    const donors = project.contributorCount > 0n ? project.contributorCount : 0n;
    const eligible = project.eligible !== false;
    return {
      id: project.id,
      index,
      weight: eligible && donors > 1n ? (donors - 1n) * total : 0n,
    };
  });

  const totalWeight = weights.reduce((sum, entry) => sum + entry.weight, 0n);
  if (totalWeight <= 0n || matchingPool <= 0n) {
    return weights.map((entry) => ({ id: entry.id, weight: entry.weight, match: 0n }));
  }

  // Hamilton/largest-remainder allocation keeps integer base-unit arithmetic,
  // never exceeds the pool, and deterministically assigns the sub-unit dust so
  // an eligible allocation uses the whole pool. Stable input order breaks
  // equal-remainder ties; the UI's project order is the on-chain registry order.
  const provisional = weights.map((entry) => {
    const numerator = matchingPool * entry.weight;
    return {
      ...entry,
      match: numerator / totalWeight,
      remainder: numerator % totalWeight,
    };
  });
  const allocated = provisional.reduce((sum, entry) => sum + entry.match, 0n);
  let dust = matchingPool - allocated;
  const remainderOrder = provisional
    .filter((entry) => entry.weight > 0n)
    .sort((left, right) => {
      if (left.remainder === right.remainder) return left.index - right.index;
      return left.remainder > right.remainder ? -1 : 1;
    });
  for (let i = 0; dust > 0n && i < remainderOrder.length; i += 1) {
    remainderOrder[i]!.match += 1n;
    dust -= 1n;
  }

  return provisional
    .sort((left, right) => left.index - right.index)
    .map(({ id, weight, match }) => ({ id, weight, match }));
}
