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

  if (created.length === 0 && incoming.length === 0) {
    return (
      <div className="escrow-empty">
        <div className="escrow-empty__icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M3 10h18" />
          </svg>
        </div>
        <span className="escrow-empty__text">{tr("emptyEscrows")}</span>
      </div>
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
                {escrow.status === "active" && (
                  <div className="escrow-actions">
                    <button
                      type="button"
                      className="escrow-action escrow-action--approve"
                      disabled={Boolean(approvingId) || !canApprove}
                      title={canApprove ? undefined : tr("noMilestoneToApprove")}
                      onClick={() => onApprove(escrow)}
                    >
                      {approveBusy ? tr("approving") : tr("approve")}
                    </button>
                    <button
                      type="button"
                      className="escrow-action escrow-action--cancel"
                      disabled={cancelBusy}
                      onClick={() => onCancel(escrow)}
                    >
                      {cancelBusy ? tr("cancelling") : tr("cancel")}
                    </button>
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
                {escrow.status === "active" && (
                  <div className="escrow-actions">
                    <button
                      type="button"
                      className="escrow-action escrow-action--approve"
                      disabled={Boolean(claimingId) || !canClaim}
                      title={canClaim ? undefined : tr("noMilestoneToClaim")}
                      onClick={() => onClaim(escrow)}
                    >
                      {claimBusy ? tr("claiming") : tr("claim")}
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
