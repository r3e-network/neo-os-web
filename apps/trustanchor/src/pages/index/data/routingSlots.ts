export interface RoutingSlotInfo {
  slot: number;
  label: string;
  summary: string;
  role: string;
  candidateTarget: string;
  fundingPath: string;
  accountAddress: string;
  verificationScript: string;
  isDefaultIngress: boolean;
}

const buildSlot = (slot: number): RoutingSlotInfo => {
  const isDefaultIngress = slot === 21;
  return {
    slot,
    label: `Candidate Slot ${String(slot).padStart(2, "0")}`,
    summary: isDefaultIngress
      ? "Fresh deposits enter here first, then the admin rebalances by moving real NEO into other slots."
      : "Receives stake only when the admin transfers real NEO from another routing slot.",
    role: isDefaultIngress ? "Default ingress slot" : "Rebalance destination slot",
    candidateTarget: `Candidate ${slot} public key binding`,
    fundingPath: isDefaultIngress ? "Fresh user inflow" : "Admin transfer from slot A to slot B",
    accountAddress: "Derived from verification script at rollout",
    verificationScript: "Standard or multisig verification script",
    isDefaultIngress,
  };
};

export const TRUSTANCHOR_ROUTING_SLOTS: RoutingSlotInfo[] = Array.from({ length: 21 }, (_, index) => buildSlot(index + 1));
