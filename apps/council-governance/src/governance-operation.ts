export const GOVERNANCE_PENDING_KEY = "governance:pending:v1";

export type GovernanceOperation =
  | "createProposal"
  | "vote"
  | "finalizeProposal"
  | "executeProposal"
  | "revokeProposal";

export const GOVERNANCE_EVENTS: Record<GovernanceOperation, string> = {
  createProposal: "ProposalCreated",
  vote: "VoteCast",
  finalizeProposal: "ProposalFinalized",
  executeProposal: "ProposalExecuted",
  revokeProposal: "ProposalRevoked",
};

export interface PendingGovernanceOperation {
  version: 1;
  operation: GovernanceOperation;
  eventName: string;
  txid: string;
  network: "mainnet" | "testnet";
  contract: string;
  wallet: string;
  submittedAt: number;
  proposalId?: number;
  support?: boolean;
  proposalType?: number;
  title?: string;
  description?: string;
  policyMethod?: string;
  policyValue?: string;
  durationMs?: number;
}

export interface GovernanceOperationStore {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
  delete(key: string): void;
}

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function isPendingGovernanceOperation(value: unknown): value is PendingGovernanceOperation {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const pending = value as Partial<PendingGovernanceOperation>;
  const operation = clean(pending.operation) as GovernanceOperation;
  if (!(operation in GOVERNANCE_EVENTS)) return false;
  if (pending.version !== 1 || pending.eventName !== GOVERNANCE_EVENTS[operation]) return false;
  if (!/^0x[0-9a-fA-F]{64}$/.test(clean(pending.txid))) return false;
  if (pending.network !== "mainnet" && pending.network !== "testnet") return false;
  if (!/^0x[0-9a-fA-F]{40}$/.test(clean(pending.contract))) return false;
  if (!clean(pending.wallet)) return false;
  if (!Number.isFinite(pending.submittedAt) || Number(pending.submittedAt) <= 0) return false;

  if (operation === "createProposal") {
    const title = clean(pending.title);
    const description = clean(pending.description);
    const durationMs = Number(pending.durationMs);
    const baseValid = (
      (pending.proposalType === 0 || pending.proposalType === 1) &&
      title.length > 0 &&
      title.length <= 80 &&
      description.length > 0 &&
      description.length <= 1_000 &&
      Number.isSafeInteger(durationMs) &&
      durationMs > 0
    );
    if (!baseValid) return false;
    if (pending.proposalType === 0) {
      return !clean(pending.policyMethod) && !clean(pending.policyValue);
    }
    return clean(pending.policyMethod).length > 0 && clean(pending.policyValue).length > 0;
  }
  if (!Number.isSafeInteger(pending.proposalId) || Number(pending.proposalId) <= 0) return false;
  return operation !== "vote" || typeof pending.support === "boolean";
}

export function readPendingGovernanceOperation(
  store: GovernanceOperationStore,
): PendingGovernanceOperation | null {
  try {
    const value = store.get<PendingGovernanceOperation>(GOVERNANCE_PENDING_KEY, null);
    return isPendingGovernanceOperation(value) ? value : null;
  } catch {
    return null;
  }
}

export function savePendingGovernanceOperation(
  store: GovernanceOperationStore,
  pending: PendingGovernanceOperation,
): boolean {
  if (!isPendingGovernanceOperation(pending)) return false;
  try {
    store.set(GOVERNANCE_PENDING_KEY, pending);
    return readPendingGovernanceOperation(store)?.txid.toLowerCase() === pending.txid.toLowerCase();
  } catch {
    return false;
  }
}

export function clearPendingGovernanceOperation(store: GovernanceOperationStore): boolean {
  try {
    store.delete(GOVERNANCE_PENDING_KEY);
    return readPendingGovernanceOperation(store) === null;
  } catch {
    return false;
  }
}

export function governancePendingMatchesScope(
  pending: PendingGovernanceOperation,
  scope: { network: "mainnet" | "testnet"; contract: string; wallet: string },
): boolean {
  const expectedWallet = pending.wallet.trim();
  const currentWallet = scope.wallet.trim();
  const hexWallet = /^(?:0x)?[0-9a-fA-F]{40}$/;
  const walletMatches = hexWallet.test(expectedWallet) && hexWallet.test(currentWallet)
    ? expectedWallet.toLowerCase().replace(/^0x/, "") === currentWallet.toLowerCase().replace(/^0x/, "")
    : expectedWallet === currentWallet;
  return (
    pending.network === scope.network &&
    pending.contract.toLowerCase() === scope.contract.trim().toLowerCase() &&
    walletMatches
  );
}

export function governanceEventTxid(event: unknown): string {
  if (!event || typeof event !== "object" || Array.isArray(event)) return "";
  const record = event as Record<string, unknown>;
  return clean(record.tx_hash ?? record.txid ?? record.transaction_hash ?? record.transactionHash);
}
