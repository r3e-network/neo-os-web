export type NativeTokenSymbol = "NEO" | "GAS";

export interface Token {
  symbol: NativeTokenSymbol;
  hash: string;
  /** Human-readable decimal string derived from exact base units. */
  balance: string;
  /** Unscaled NEP-17 balance; financial comparisons use this field only. */
  balanceUnits: string;
  decimals: number;
}
