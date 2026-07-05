export interface EscrowItem {
  id: string; creator: string; beneficiary: string; assetSymbol: "NEO" | "GAS";
  totalAmount: bigint; releasedAmount: bigint; status: "active" | "completed" | "cancelled";
  milestoneAmounts: bigint[]; milestoneApproved: boolean[]; milestoneClaimed: boolean[];
  title: string; notes: string; active: boolean;
}
