export type ContractStatus = "pending" | "active" | "broken" | "ended";

export interface RelationshipContractView {
  id: number;
  /**
   * Kernel-assigned escrow id used for sign/break/refund. Falls back to the
   * stringified `id` when an older record predates the escrowId field.
   */
  escrowId: string;
  party1: string;
  party2: string;
  partner: string;
  title: string;
  terms: string;
  stake: number;
  stakeRaw: string;
  progress: number;
  daysLeft: number;
  status: ContractStatus;
}
