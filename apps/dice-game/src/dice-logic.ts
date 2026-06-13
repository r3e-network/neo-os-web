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
 * liquidity and the player's standing app-scoped credit. The contract asserts
 * liquidity >= stake * coverMultiple (6 * 95% = 5.7), so:
 *
 *   maxPayableStake = (liquidity + credit) / coverMultiple
 *
 * The player's credit is added because the stake is consumed from credit first
 * (only the shortfall is deposited), so the effective house exposure is reduced
 * by the credit already held. Floored to 2 decimals (GAS display precision) and
 * never negative. coverMultiple defaults to 5.7.
 */
export function maxPayableStakeOf(
  liquidityGas: number,
  creditGas = 0,
  coverMultiple = 6 * 0.95,
): number {
  if (!Number.isFinite(liquidityGas) || liquidityGas <= 0) return 0;
  const credit = Number.isFinite(creditGas) && creditGas > 0 ? creditGas : 0;
  const payable = (liquidityGas + credit) / coverMultiple;
  if (!Number.isFinite(payable) || payable <= 0) return 0;
  // Floor to 2 decimals so the quoted cap never exceeds the real payable amount.
  return Math.floor(payable * 100) / 100;
}
