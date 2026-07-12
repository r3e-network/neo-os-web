export interface EscrowItem {
  id: string; creator: string; beneficiary: string; assetSymbol: "NEO" | "GAS";
  totalAmount: bigint; releasedAmount: bigint; status: "active" | "completed" | "cancelled";
  milestoneAmounts: bigint[]; milestoneApproved: boolean[]; milestoneClaimed: boolean[];
  /** Runtime.Time values returned by getMilestoneDetails (milliseconds). */
  milestoneApprovedTimes: bigint[];
  createdTime: bigint;
  title: string; notes: string; active: boolean;
}
