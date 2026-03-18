export interface AgentAccountInfo {
  agentId: number;
  label: string;
  summary: string;
  role: string;
  candidateTarget: string;
  fundingPath: string;
  accountAddress: string;
  verificationScript: string;
  isDefaultIngress: boolean;
}

const buildAgentAccount = (agentId: number): AgentAccountInfo => {
  const isDefaultIngress = agentId === 21;
  return {
    agentId,
    label: `Agent ${String(agentId).padStart(2, "0")}`,
    summary: isDefaultIngress
      ? "Fresh user stake is auto-routed here first, so new deposits vote through candidate 21 by default."
      : "This agent account receives voting weight only when the admin transfers real NEO from another agent account.",
    role: isDefaultIngress ? "Default ingress agent account" : "Rebalance destination agent account",
    candidateTarget: `Candidate ${agentId} binding`,
    fundingPath: isDefaultIngress ? "Fresh user inflow -> agent 21" : "Admin transfer from agent A to agent B",
    accountAddress: "Verification-script derived agent account",
    verificationScript: "Verification script for the agent account",
    isDefaultIngress,
  };
};

export const TRUSTANCHOR_AGENT_ACCOUNTS: AgentAccountInfo[] = Array.from({ length: 21 }, (_, index) =>
  buildAgentAccount(index + 1),
);
