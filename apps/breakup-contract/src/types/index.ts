export type ContractStatus = "pending" | "active" | "broken" | "ended";

export interface RelationshipContractView {
  /**
   * Numeric form of the on-chain pact id, used as the React list key and for
   * sorting. Equal to Number(pactId).
   */
  id: number;
  /**
   * The on-chain pact id (string) every action targets — createPact returns it,
   * and signPact/breakPact/settlePact take it. This is the canonical id; `id`
   * is just its numeric form for keying/sorting.
   */
  pactId: string;
  party1: string;
  party2: string;
  partner: string;
  title: string;
  terms: string;
  /** Per-party stake in whole GAS (base units / 1e8) for display. */
  stake: number;
  /** Per-party stake in BASE UNITS (string) — the exact on-chain stake. */
  stakeRaw: string;
  progress: number;
  daysLeft: number;
  status: ContractStatus;
  /** True once party1 (creator) has locked their stake — always true post-create. */
  party1Signed: boolean;
  /** True once party2 (partner) has matched the stake (pact ACTIVE). */
  party2Signed: boolean;
  /**
   * True when this honored ACTIVE pact has passed its endTime and can be settled
   * (permissionlessly refunding both parties). Drives the Settle affordance.
   */
  settleable: boolean;
}
