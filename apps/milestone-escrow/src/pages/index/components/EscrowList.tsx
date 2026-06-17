import { useState } from "react";
import { EmptyStateArt } from "@shared/components-react/illustrations";
import { StateView } from "@shared/components";

export interface EscrowItem {
  id: string; creator: string; beneficiary: string; assetSymbol: "NEO" | "GAS";
  totalAmount: bigint; releasedAmount: bigint; status: "active" | "completed" | "cancelled";
  milestoneAmounts: bigint[]; milestoneApproved: boolean[]; milestoneClaimed: boolean[];
  title: string; notes: string; active: boolean;
}

interface EscrowListProps {
  t?: (key: string, params?: Record<string, string | number>) => string;
  creatorEscrows: unknown[];
  beneficiaryEscrows: unknown[];
  approvingId: string | null;
  cancellingId: string | null;
  claimingId: string | null;
  statusLabelFunc: (status: string) => string;
  formatAmountFunc: (symbol: string, amount: bigint) => string;
  formatAddressFunc: (addr: string) => string;
  onApprove: (escrow: unknown) => void;
  onCancel: (escrow: unknown) => void;
  onClaim: (escrow: unknown) => void;
}

/** Index of the next milestone the creator can approve, or -1 if none remain. */
function nextApprovableIndex(escrow: EscrowItem): number {
  return escrow.milestoneApproved.findIndex((approved) => !approved);
}

/**
 * Index of the next milestone the beneficiary can claim (approved but not yet
 * claimed), or -1 if none are currently claimable.
 */
function nextClaimableIndex(escrow: EscrowItem): number {
  return escrow.milestoneApproved.findIndex(
    (approved, i) => approved && !escrow.milestoneClaimed[i],
  );
}

/** Count of milestones already claimed (released to the beneficiary). */
function claimedCount(escrow: EscrowItem): number {
  return escrow.milestoneClaimed.filter(Boolean).length;
}

export default function EscrowList({ t, creatorEscrows, beneficiaryEscrows, approvingId, cancellingId, claimingId, statusLabelFunc, formatAmountFunc, formatAddressFunc, onApprove, onCancel, onClaim }: EscrowListProps) {
  const tr = t ?? ((k: string) => k);
  const created = creatorEscrows as EscrowItem[];
  const incoming = beneficiaryEscrows as EscrowItem[];

  // Two-step cancel: the first click arms a confirm (which refunds remaining
  // funds and ends the escrow irreversibly); a second click within the window
  // dispatches it. Clicking elsewhere / a timeout disarms it.
  const [confirmingCancelId, setConfirmingCancelId] = useState<string | null>(null);

  if (created.length === 0 && incoming.length === 0) {
    return (
      <StateView
        kind="empty"
        className="escrow-state-view"
        icon={<EmptyStateArt size={132} title={tr("emptyEscrows")} />}
        title={tr("emptyEscrows")}
      />
    );
  }

  /** Amount + asset + released/total + milestone-progress rows for a card. */
  const renderDetails = (escrow: EscrowItem) => {
    const total = `${formatAmountFunc(escrow.assetSymbol, escrow.totalAmount)} ${escrow.assetSymbol}`;
    const released = `${formatAmountFunc(escrow.assetSymbol, escrow.releasedAmount)} ${escrow.assetSymbol}`;
    const count = escrow.milestoneAmounts.length;
    const done = claimedCount(escrow);
    return (
      <div className="escrow-details" aria-label={tr("locked")}>
        <span className="escrow-detail escrow-detail--amount">{total}</span>
        <span className="escrow-detail escrow-detail--released">
          {tr("releasedOfTotal", { released, total })}
        </span>
        <span className="escrow-detail escrow-detail--progress">
          {tr("milestoneProgress", { done, count })}
        </span>
      </div>
    );
  };

  /** Per-milestone breakdown: index, amount, and an approved/claimed pill, so
      Approve/Claim act on a visible amount rather than "the next" milestone. */
  const renderMilestones = (escrow: EscrowItem) => {
    if (escrow.milestoneAmounts.length <= 1) return null;
    return (
      <ul className="escrow-milestones" aria-label={tr("milestonesLabel")}>
        {escrow.milestoneAmounts.map((amount, i) => {
          const claimed = escrow.milestoneClaimed[i];
          const approved = escrow.milestoneApproved[i];
          const stateKey = claimed ? "milestoneClaimedPill" : approved ? "milestoneApprovedPill" : "milestonePendingPill";
          return (
            <li key={i} className={`escrow-milestone escrow-milestone--${claimed ? "claimed" : approved ? "approved" : "pending"}`}>
              <span className="escrow-milestone__label">{tr("milestoneNumber", { n: i + 1 })}</span>
              <span className="escrow-milestone__amount">
                {formatAmountFunc(escrow.assetSymbol, amount)} {escrow.assetSymbol}
              </span>
              <span className="escrow-milestone__pill">{tr(stateKey)}</span>
            </li>
          );
        })}
      </ul>
    );
  };

  /** Label the approve action with the milestone it releases. */
  const approveLabel = (escrow: EscrowItem, idx: number, busy: boolean): string => {
    if (busy) return tr("approving");
    const amount = escrow.milestoneAmounts[idx];
    if (idx < 0 || amount === undefined) return tr("approve");
    return tr("approveMilestone", {
      n: idx + 1,
      amount: `${formatAmountFunc(escrow.assetSymbol, amount)} ${escrow.assetSymbol}`,
    });
  };

  /** Label the claim action with the milestone it releases. */
  const claimLabel = (escrow: EscrowItem, idx: number, busy: boolean): string => {
    if (busy) return tr("claiming");
    const amount = escrow.milestoneAmounts[idx];
    if (idx < 0 || amount === undefined) return tr("claim");
    return tr("claimMilestone", {
      n: idx + 1,
      amount: `${formatAmountFunc(escrow.assetSymbol, amount)} ${escrow.assetSymbol}`,
    });
  };

  return (
    <div className="escrow-list">
      {created.length > 0 && (
        <div className="escrow-group">
          <div className="section-label">{tr("createdByYou")} <span className="section-label__count">{created.length}</span></div>
          {created.map((escrow) => {
            const approveIdx = nextApprovableIndex(escrow);
            const canApprove = approveIdx >= 0;
            const approveBusy = approvingId?.startsWith(escrow.id) ?? false;
            const cancelBusy = cancellingId === escrow.id;
            return (
              <div key={`creator-${escrow.id}`} className="escrow-card">
                <span className="escrow-title">{escrow.title || `#${escrow.id}`}</span>
                <span className="escrow-subtitle">{formatAddressFunc(escrow.beneficiary)}</span>
                <span className={`escrow-status escrow-status--${escrow.status}`}>{statusLabelFunc(escrow.status)}</span>
                {renderDetails(escrow)}
                {renderMilestones(escrow)}
                {escrow.status === "active" && (
                  <div className="escrow-actions">
                    <button
                      type="button"
                      className="escrow-action escrow-action--approve"
                      disabled={Boolean(approvingId) || !canApprove}
                      title={canApprove ? undefined : tr("noMilestoneToApprove")}
                      onClick={() => onApprove(escrow)}
                    >
                      {approveLabel(escrow, approveIdx, approveBusy)}
                    </button>
                    {confirmingCancelId === escrow.id ? (
                      <button
                        type="button"
                        className="escrow-action escrow-action--cancel is-confirming"
                        disabled={cancelBusy}
                        onClick={() => {
                          setConfirmingCancelId(null);
                          onCancel(escrow);
                        }}
                        onBlur={() => setConfirmingCancelId((id) => (id === escrow.id ? null : id))}
                      >
                        {cancelBusy
                          ? tr("cancelling")
                          : tr("confirmCancelRefund", {
                              amount: `${formatAmountFunc(escrow.assetSymbol, escrow.totalAmount - escrow.releasedAmount)} ${escrow.assetSymbol}`,
                            })}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="escrow-action escrow-action--cancel"
                        disabled={cancelBusy}
                        onClick={() => setConfirmingCancelId(escrow.id)}
                      >
                        {tr("cancel")}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {incoming.length > 0 && (
        <div className="escrow-group">
          <div className="section-label">{tr("forYou")} <span className="section-label__count">{incoming.length}</span></div>
          {/* Role clarity: a beneficiary's payout is gated on the creator
              approving each milestone — the locked total is not guaranteed. */}
          <p className="escrow-group__note" role="note">{tr("beneficiaryApprovalNote")}</p>
          {incoming.map((escrow) => {
            const claimIdx = nextClaimableIndex(escrow);
            const canClaim = claimIdx >= 0;
            const claimBusy = claimingId?.startsWith(escrow.id) ?? false;
            return (
              <div key={`beneficiary-${escrow.id}`} className="escrow-card">
                <span className="escrow-title">{escrow.title || `#${escrow.id}`}</span>
                <span className="escrow-subtitle">{formatAddressFunc(escrow.creator)}</span>
                <span className={`escrow-status escrow-status--${escrow.status}`}>{statusLabelFunc(escrow.status)}</span>
                {renderDetails(escrow)}
                {renderMilestones(escrow)}
                {escrow.status === "active" && (
                  <div className="escrow-actions">
                    <button
                      type="button"
                      className="escrow-action escrow-action--approve"
                      disabled={Boolean(claimingId) || !canClaim}
                      title={canClaim ? undefined : tr("noMilestoneToClaim")}
                      onClick={() => onClaim(escrow)}
                    >
                      {claimLabel(escrow, claimIdx, claimBusy)}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
