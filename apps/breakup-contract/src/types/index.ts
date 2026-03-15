export type ContractStatus = "pending" | "active" | "broken" | "ended";

export interface RelationshipContractView {
  id: number;
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
