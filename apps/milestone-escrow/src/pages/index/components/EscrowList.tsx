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

export default function EscrowList({ t, creatorEscrows, beneficiaryEscrows, statusLabelFunc, formatAddressFunc }: EscrowListProps) {
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

  return (
    <div className="escrow-list">
      {created.length > 0 && (
        <div className="escrow-group">
          <div className="section-label">{tr("createdByYou")} <span className="section-label__count">{created.length}</span></div>
          {created.map((escrow) => (
            <div key={`creator-${escrow.id}`} className="escrow-card">
              <span className="escrow-title">{escrow.title || `#${escrow.id}`}</span>
              <span className="escrow-subtitle">{formatAddressFunc(escrow.beneficiary)}</span>
              <span className={`escrow-status escrow-status--${escrow.status}`}>{statusLabelFunc(escrow.status)}</span>
            </div>
          ))}
        </div>
      )}
      {incoming.length > 0 && (
        <div className="escrow-group">
          <div className="section-label">{tr("forYou")} <span className="section-label__count">{incoming.length}</span></div>
          {incoming.map((escrow) => (
            <div key={`beneficiary-${escrow.id}`} className="escrow-card">
              <span className="escrow-title">{escrow.title || `#${escrow.id}`}</span>
              <span className="escrow-subtitle">{formatAddressFunc(escrow.creator)}</span>
              <span className={`escrow-status escrow-status--${escrow.status}`}>{statusLabelFunc(escrow.status)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
