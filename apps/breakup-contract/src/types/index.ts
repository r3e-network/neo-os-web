export type ContractStatus = "pending" | "active" | "broken" | "ended" | "cancelled";

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
  /** party1 (creator) script hash in display-order 0x hex. */
  party1: string;
  /** party2 (named partner) script hash in display-order 0x hex. */
  party2: string;
  /**
   * The counterparty's Neo N3 address (the OTHER party relative to the connected
   * wallet), resolved from its script hash. "" when no wallet is connected or the
   * hash cannot be encoded; the UI falls back to a truncated script hash then.
   */
  partner: string;
  /** True when the connected wallet is party1 (the creator). */
  isCreator: boolean;
  /** True when the connected wallet is party2 (the named partner). */
  isPartner: boolean;
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
