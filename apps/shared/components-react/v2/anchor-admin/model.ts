export interface AnchorAgentRecord {
  id?: string | number;
  agentId?: string | number;
  label?: string;
  account?: string;
  accountAddress?: string;
  address?: string;
  candidate?: string;
  candidateTarget?: string;
  active?: boolean;
  neo?: string;
  neoBalance?: number | null;
}

export interface NormalizedAnchorAgent extends AnchorAgentRecord {
  normalizedId: number;
  normalizedLabel: string;
}

export type AnchorOperationMode = "move" | "candidate" | "vote";
export type AnchorRouteSlot = "from" | "to";

export function getAnchorAgentId(agent: AnchorAgentRecord, fallback: number): number {
  const value = Number(agent.agentId ?? agent.id ?? fallback);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function getAnchorAgentLabel(agent: AnchorAgentRecord, fallback: number): string {
  const id = getAnchorAgentId(agent, fallback);
  return agent.label || `Agent ${String(id).padStart(2, "0")}`;
}

export function getAnchorAgentAddress(agent?: AnchorAgentRecord): string {
  return String(agent?.accountAddress || agent?.account || agent?.address || "");
}

export function getAnchorAgentCandidate(agent?: AnchorAgentRecord): string {
  return String(agent?.candidate || agent?.candidateTarget || "");
}

export function shortAnchorValue(value: string, head = 8, tail = 6): string {
  if (!value) return "—";
  return value.length > head + tail + 3
    ? `${value.slice(0, head)}…${value.slice(-tail)}`
    : value;
}

export function anchorAgentBalance(agent?: AnchorAgentRecord, pendingLabel = "Balance pending"): string {
  if (!agent) return pendingLabel;
  if (typeof agent.neoBalance === "number") {
    return `${Math.max(0, Math.floor(agent.neoBalance)).toLocaleString()} NEO`;
  }
  if (agent.neo) return `${agent.neo} NEO`;
  return pendingLabel;
}

export function compactAnchorAgentBalance(agent?: AnchorAgentRecord): string {
  if (typeof agent?.neoBalance === "number") {
    return Math.max(0, Math.floor(agent.neoBalance)).toLocaleString();
  }
  if (agent?.neo) return agent.neo;
  return "—";
}

export function normalizeWholeNeoInput(value: string): string {
  const whole = value.split(/[.,]/)[0] ?? "";
  return whole.replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
}

export function normalizeCandidateKey(value: string): string {
  return value.trim().replace(/^0x/i, "");
}

export function isCompressedPublicKey(value: string): boolean {
  return /^(02|03)[0-9a-f]{64}$/i.test(normalizeCandidateKey(value));
}

export function groupAnchorAgents<T>(agents: T[], size = 7): T[][] {
  const groups: T[][] = [];
  for (let index = 0; index < agents.length; index += size) {
    groups.push(agents.slice(index, index + size));
  }
  return groups;
}
