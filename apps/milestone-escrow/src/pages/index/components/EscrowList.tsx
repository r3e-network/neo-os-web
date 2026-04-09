export interface EscrowItem {
  id: string; creator: string; beneficiary: string; assetSymbol: "NEO" | "GAS";
  totalAmount: bigint; releasedAmount: bigint; status: "active" | "completed" | "cancelled";
  milestoneAmounts: bigint[]; milestoneApproved: boolean[]; milestoneClaimed: boolean[];
  title: string; notes: string; active: boolean;
}

interface EscrowListProps {
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

export default function EscrowList({ creatorEscrows, beneficiaryEscrows, approvingId, cancellingId, claimingId, statusLabelFunc, formatAmountFunc, formatAddressFunc, onApprove, onCancel, onClaim }: EscrowListProps) {
  return (
    <div className="escrow-list">
      <div className="section-label">Created by you ({creatorEscrows.length})</div>
      {(creatorEscrows as EscrowItem[]).map((escrow) => (
        <div key={`creator-${escrow.id}`} className="escrow-card">
          <span className="escrow-title">{escrow.title || `#${escrow.id}`}</span>
          <span className="escrow-subtitle">{formatAddressFunc(escrow.beneficiary)}</span>
          <span>{statusLabelFunc(escrow.status)}</span>
        </div>
      ))}
      <div className="section-label">For you ({beneficiaryEscrows.length})</div>
      {(beneficiaryEscrows as EscrowItem[]).map((escrow) => (
        <div key={`beneficiary-${escrow.id}`} className="escrow-card">
          <span className="escrow-title">{escrow.title || `#${escrow.id}`}</span>
          <span className="escrow-subtitle">{formatAddressFunc(escrow.creator)}</span>
          <span>{statusLabelFunc(escrow.status)}</span>
        </div>
      ))}
    </div>
  );
}
