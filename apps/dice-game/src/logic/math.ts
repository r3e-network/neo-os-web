/**
 * Dice Game — game math & constants (v2 rewrite).
 *
 * These are VERIFIED, DEPLOYED facts that must NOT change between redesigns:
 *  - Payout is 5.7× the staked GAS on a win.
 *  - The house bankroll must cover `stake * 4.7` (the win top-up), enforced
 *    inside the contract's roll(). Mirrored here for the pre-flight liquidity
 *    check so a stake the house can't pay is refused BEFORE the deposit lands.
 *  - Minimum stake is 0.05 GAS.
 *  - Neo N3 mainnet/testnet cap 20 GAS; Neo X cap 2 GAS.
 *
 * Pure, side-effect-free, unit-testable in isolation.
 */

/** Win payout multiplier (a win returns 5.7× the staked GAS). */
export const PAYOUT_MULTIPLIER = 5.7;

/** House must cover stake × 4.7 (the net top-up on a 5.7× win). */
export const LIQUIDITY_COVER_MULTIPLE = 47 / 10; // = 4.7

/** Minimum stake in fixed8 GAS (0.05). */
export const MIN_STAKE_FIXED8 = 5_000_000n;

/** Max stake (GAS) per network — enforced by the deployed contract. */
export function maxStakeOf(network: string): number {
  return network.startsWith("neo-x") ? 2 : 20;
}

/**
 * The largest stake (GAS) the house can currently pay a win on, given its
 * bankroll. maxPayableStake = bankroll / coverMultiple, floored to 2 decimals so
 * the quoted cap never exceeds the real payable amount and is never negative.
 */
export function maxPayableStakeOf(
  liquidityGas: number,
  coverMultiple = LIQUIDITY_COVER_MULTIPLE,
): number {
  if (!Number.isFinite(liquidityGas) || liquidityGas <= 0) return 0;
  const payable = liquidityGas / coverMultiple;
  if (!Number.isFinite(payable) || payable <= 0) return 0;
  return Math.floor(payable * 100) / 100;
}

/** Win payout (GAS display) for a stake amount (GAS display). */
export function payoutFor(stakeGas: number): number {
  if (!Number.isFinite(stakeGas) || stakeGas <= 0) return 0;
  return Math.round(stakeGas * PAYOUT_MULTIPLIER * 100) / 100;
}

/** Friendly chain label for the connected wallet network. */
export function chainLabelOf(network: string): string {
  if (network.startsWith("neo-x")) return network.includes("testnet") ? "Neo X Testnet" : "Neo X";
  if (network.includes("testnet")) return "Neo N3 Testnet";
  return "Neo N3";
}

/** Dice outcome lifecycle. */
export type RollOutcome = "" | "pending" | "won" | "lost" | "refunded";

/**
 * EVM MiniAppDiceGameEVM Bet.status enum: None=0 Pending=1 Won=2 Lost=3
 * Refunded=4. Maps the raw status to our outcome lifecycle.
 */
export function evmStatusToOutcome(status: number): RollOutcome {
  if (status === 2) return "won";
  if (status === 3) return "lost";
  if (status === 4) return "refunded";
  return "pending";
}
