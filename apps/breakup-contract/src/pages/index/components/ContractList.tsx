import { NeoButton } from "@shared/components-react";
import type { RelationshipContractView } from "../../../types";

interface ContractListProps {
  contracts: unknown[];
  address: string | null;
  onSign: (c: unknown) => void;
  onBreak: (c: unknown) => void;
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
                <span className="contract-value">{contract.daysLeft}</span>
              </span>
            </div>
            {contract.terms && (
              <p className="contract-terms">{contract.terms}</p>
            )}
            {isParty && (
              <div className="contract-actions">
                {isPending && (
                  <NeoButton size="sm" variant="primary" onClick={() => onSign(contract)}>
                    {t("signContract") || "Sign"}
                  </NeoButton>
                )}
                {isActive && (
                  <NeoButton size="sm" variant="danger" onClick={() => onBreak(contract)}>
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
