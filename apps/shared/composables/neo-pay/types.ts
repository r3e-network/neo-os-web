export type StreamStatus = "active" | "completed" | "cancelled";

export interface StreamItem {
  id: string;
  creator: string;
  beneficiary: string;
  asset: string;
  assetSymbol: "NEO" | "GAS";
  totalAmount: bigint;
  releasedAmount: bigint;
  remainingAmount: bigint;
  rateAmount: bigint;
  intervalSeconds: bigint;
  intervalDays: number;
  status: StreamStatus;
  claimable: bigint;
  title: string;
  notes: string;
}
