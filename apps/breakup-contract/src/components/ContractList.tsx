import { NeoButton } from "@shared/components-react";
import type { RelationshipContractView } from "../types";

interface ContractListProps {
  contracts: unknown[];
  address: string | null;
  onSign: (c: unknown) => void;
  onBreak: (c: unknown) => void;
  /** Cancel a still-pending pact (party1 reclaims their stake before signing). */
  onCancel: (c: unknown) => void;
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
  cancelled: "ghost",
};

const truncateAddress = (addr: string) =>
  addr && addr.length > 14 ? `${addr.slice(0, 8)}...${addr.slice(-4)}` : addr;

export default function ContractList({
  contracts,
  address,
  onSign,
  onBreak,
  onCancel,
  onSettle,
  busy = false,
  t,
}: ContractListProps) {
  return (
    <div className="contracts-list">
      {(contracts as RelationshipContractView[]).map((contract) => {
        // isCreator/isPartner are resolved in the composable via
        // ownerMatchesAddress (N-address vs Hash160), the authoritative party
        // match — the prior N-address-vs-hex string compare here was always
        // false, hiding every Sign/Break/Cancel affordance.
        const isCreator = Boolean(contract.isCreator);
        const isPartner = Boolean(contract.isPartner);
        const isParty = isCreator || isPartner;
        const counterparty = contract.partner;
        const isPending = contract.status === "pending";
        const isActive = contract.status === "active";
        const isSettleable = Boolean(contract.settleable);
        // The named partner can sign a pending pact they have not yet matched;
        // the creator (party1) never self-signs (the contract would take a second
        // stake then revert), so Sign is restricted to party2.
        const canSign = isPartner && isPending && !contract.party2Signed;
        // While pending (partner never signed), only the creator can cancel and
        // reclaim their stake — the contract's party1-only pending break.
        const canCancel = isCreator && isPending;
        // party2 stakes against terms held only on the creator's device; warn
        // them the title/terms are not on-chain and must be verified together.
        const showDeviceTermsNote = isPartner && !contract.terms;

        return (
          <div key={String(contract.id)} className={`contract-card contract-card--${contract.status}`}>
            <div className="contract-header">
              <span className="contract-title">{contract.title || `#${contract.id}`}</span>
              <span className={`contract-status contract-status--${STATUS_TONE[contract.status] ?? "ghost"}`}>
                {t(contract.status)}
              </span>
            </div>
            <div className="contract-meta">
              <span className="contract-meta-row">
                <span className="contract-label">{t("partner")}</span>
                <code className="contract-value mono">{truncateAddress(counterparty)}</code>
              </span>
              <span className="contract-meta-row">
                <span className="contract-label">{t("stake")}</span>
                <span className="contract-value">{contract.stake} GAS</span>
              </span>
              <span className="contract-meta-row">
                <span className="contract-label">{t("daysLeft")}</span>
                <span className="contract-value">
                  {contract.daysLeft} {t("daysSuffix")}
                </span>
              </span>
            </div>
            {contract.terms && (
              <p className="contract-terms">{contract.terms}</p>
            )}
            {showDeviceTermsNote && (
              <p className="contract-device-note" role="note">
                {t("partnerTermsOffChain")}
              </p>
            )}
            {(isParty || isSettleable) && (
              <div className="contract-actions">
                {canSign && (
                  <NeoButton size="sm" variant="primary" disabled={busy} onClick={() => onSign(contract)}>
                    {t("signContract")}
                  </NeoButton>
                )}
                {/* Creator-only escape for a pending pact whose partner never
                    signed: cancel and reclaim the locked stake. */}
                {canCancel && (
                  <NeoButton size="sm" variant="ghost" disabled={busy} onClick={() => onCancel(contract)}>
                    {t("cancelContract")}
                  </NeoButton>
                )}
                {/* Honored pact past expiry: settle is PERMISSIONLESS (any caller
                    refunds both parties), so it is offered even to non-parties. */}
                {isSettleable && (
                  <NeoButton size="sm" variant="success" disabled={busy} onClick={() => onSettle(contract)}>
                    {t("settleContract")}
                  </NeoButton>
                )}
                {/* Break only while honored window is still open (not yet
                    settleable); once expired, settle — not break — is correct. */}
                {isParty && isActive && !isSettleable && (
                  <NeoButton size="sm" variant="danger" disabled={busy} onClick={() => onBreak(contract)}>
                    {t("breakContract")}
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
