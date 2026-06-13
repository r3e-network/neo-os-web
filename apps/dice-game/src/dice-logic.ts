// Pure, side-effect-free dice helpers — kept out of main.tsx (which runs
// defineMiniApp on import) so they are unit-testable in isolation.

export type RollOutcome = "" | "pending" | "won" | "lost" | "refunded";

// EVM MiniAppDiceGameEVM Bet.status enum: None=0 Pending=1 Won=2 Lost=3 Refunded=4.
export function evmStatusToOutcome(status: number): RollOutcome {
  if (status === 2) return "won";
  if (status === 3) return "lost";
  if (status === 4) return "refunded";
  return "pending";
}

/** Friendly chain label for the connected wallet network. */
export function chainLabelOf(network: string): string {
  if (network.startsWith("neo-x")) return network.includes("testnet") ? "Neo X Testnet" : "Neo X";
  if (network.includes("testnet")) return "Neo N3 Testnet";
  return "Neo N3";
}

/** Max stake (GAS) allowed by the deployed contract on each network. The Neo X
 * MiniAppDiceGameEVM is configured with a 2 GAS cap; Neo N3 allows up to 20. */
export function maxStakeOf(network: string): number {
  return network.startsWith("neo-x") ? 2 : 20;
}

/**
 * The largest stake (GAS) the house can currently pay a win on, given its
 * bankroll. The standalone MiniAppDiceGame asserts `bankroll >= stake *
 * coverMultiple` (47/10 = 4.7) inside roll(): a win pays 5.70x, of which the
 * player's own staked amount is returned and the house tops up the extra
 * (5.7 - 1 = 4.7). The stake is held in the player's app-scoped CREDIT (not the
 * bankroll) and is consumed on the roll, so standing credit does NOT raise the
 * cap — only the house bankroll covers a win. Therefore:
 *
 *   maxPayableStake = bankroll / coverMultiple
 *
 * Floored to 2 decimals (GAS display precision) so the quoted cap never exceeds
 * the real payable amount, and never negative. coverMultiple defaults to 4.7.
 */
export function maxPayableStakeOf(
  liquidityGas: number,
  coverMultiple = 47 / 10,
): number {
  if (!Number.isFinite(liquidityGas) || liquidityGas <= 0) return 0;
  const payable = liquidityGas / coverMultiple;
  if (!Number.isFinite(payable) || payable <= 0) return 0;
  // Floor to 2 decimals so the quoted cap never exceeds the real payable amount.
  return Math.floor(payable * 100) / 100;
}
