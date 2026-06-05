import { NeoButton } from "@shared/components-react";
import type { RelationshipContractView } from "../types";

interface ContractListProps {
  contracts: unknown[];
  address: string | null;
  onSign: (c: unknown) => void;
  onBreak: (c: unknown) => void;
  /**
   * Settle an honored, expired pact (permissionless refund of both stakes).
   * Surfaced only on cards whose `settleable` flag is set.
   */
  onSettle: (c: unknown) => void;
  /** When true (an action is in flight), the per-contract buttons are disabled
   *  to prevent double-submit of sign/break/settle before the first resolves. */
  busy?: boolean;
  t: (key: string) => string;
}

const STATUS_TONE: Record<string, string> = {
  pending: "warning",
  active: "success",
  broken: "danger",
  ended: "ghost",
};

const truncateAddress = (addr: string) =>
  addr && addr.length > 14 ? `${addr.slice(0, 8)}...${addr.slice(-4)}` : addr;

export default function ContractList({
  contracts,
  address,
  onSign,
  onBreak,
  onSettle,
  busy = false,
  t,
}: ContractListProps) {
  const me = (address ?? "").toLowerCase();

  return (
    <div className="contracts-list">
      {(contracts as RelationshipContractView[]).map((contract) => {
        const isParty =
          (contract.party1 ?? "").toLowerCase() === me ||
          (contract.party2 ?? "").toLowerCase() === me;
        const counterparty =
          (contract.party1 ?? "").toLowerCase() === me ? contract.party2 : contract.party1;
        const isPending = contract.status === "pending";
        const isActive = contract.status === "active";
        const isSettleable = Boolean(contract.settleable);

        return (
          <div key={String(contract.id)} className={`contract-card contract-card--${contract.status}`}>
            <div className="contract-header">
              <span className="contract-title">{contract.title || `#${contract.id}`}</span>
              <span className={`contract-status contract-status--${STATUS_TONE[contract.status] ?? "ghost"}`}>
                {t(contract.status) || contract.status}
              </span>
            </div>
            <div className="contract-meta">
              <span className="contract-meta-row">
                <span className="contract-label">{t("partner") || "Partner"}</span>
                <code className="contract-value mono">{truncateAddress(counterparty)}</code>
              </span>
              <span className="contract-meta-row">
                <span className="contract-label">{t("stake") || "Stake"}</span>
                <span className="contract-value">{contract.stake} GAS</span>
              </span>
              <span className="contract-meta-row">
                <span className="contract-label">{t("daysLeft") || "Days Left"}</span>
                <span className="contract-value">
                  {contract.daysLeft} {t("daysSuffix") || "Days"}
                </span>
              </span>
            </div>
            {contract.terms && (
              <p className="contract-terms">{contract.terms}</p>
            )}
            {(isParty || isSettleable) && (
              <div className="contract-actions">
                {isParty && isPending && (
                  <NeoButton size="sm" variant="primary" disabled={busy} onClick={() => onSign(contract)}>
                    {t("signContract") || "Sign"}
                  </NeoButton>
                )}
                {/* Honored pact past expiry: settle is PERMISSIONLESS (any caller
                    refunds both parties), so it is offered even to non-parties. */}
                {isSettleable && (
                  <NeoButton size="sm" variant="success" disabled={busy} onClick={() => onSettle(contract)}>
                    {t("settleContract") || "Settle"}
                  </NeoButton>
                )}
                {/* Break only while honored window is still open (not yet
                    settleable); once expired, settle — not break — is correct. */}
                {isParty && isActive && !isSettleable && (
                  <NeoButton size="sm" variant="danger" disabled={busy} onClick={() => onBreak(contract)}>
                    {t("breakContract") || "Break"}
                  </NeoButton>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
