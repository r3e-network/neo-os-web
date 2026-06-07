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
