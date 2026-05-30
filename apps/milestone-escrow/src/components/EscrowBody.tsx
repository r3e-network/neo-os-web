import { NeoButton } from "@shared/components-react";
import EscrowList from "../pages/index/components/EscrowList";

interface EscrowBodyProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  contractReady: boolean;
  isRefreshing: boolean;
  hasAddress: boolean;
  creatorEscrows: unknown[];
  beneficiaryEscrows: unknown[];
  approvingId: string;
  cancellingId: string;
  claimingId: string;
  statusLabelFunc: Function;
  formatAmountFunc: Function;
  formatAddressFunc: Function;
  onRefresh: () => void;
  onConnectWallet: () => void;
  onApprove: (escrow: unknown) => void;
  onCancel: (escrow: unknown) => void;
  onClaim: (escrow: unknown) => void;
}

export default function EscrowBody(props: EscrowBodyProps) {
  const { t, contractReady, isRefreshing, hasAddress, creatorEscrows, beneficiaryEscrows, approvingId, cancellingId, claimingId, statusLabelFunc, formatAmountFunc, formatAddressFunc } = props;

  if (!contractReady) {
    return (
      <div className="escrow-notice">
        <div className="escrow-notice__icon" aria-hidden="true">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4" />
            <path d="M12 16h.01" />
          </svg>
        </div>
        <span className="escrow-notice__title">{t("deploymentPendingTitle")}</span>
        <p className="escrow-notice__desc">{t("deploymentPendingDesc")}</p>
      </div>
    );
  }

  return (
    <>
      <div className="escrows-header">
        <span className="section-title">{t("escrowsTab")}</span>
        <NeoButton size="sm" variant="secondary" loading={isRefreshing} aria-label={t("refresh")} onClick={props.onRefresh}>{t("refresh")}</NeoButton>
      </div>
      {!hasAddress ? (
        <div className="escrow-notice">
          <div className="escrow-notice__icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="6" width="18" height="13" rx="2" />
              <path d="M3 10h18" />
              <path d="M16 14h.01" />
            </svg>
          </div>
          <span className="escrow-notice__title">{t("walletNotConnected")}</span>
          <NeoButton size="sm" variant="primary" aria-label={t("connectWallet")} onClick={props.onConnectWallet}>{t("connectWallet")}</NeoButton>
        </div>
      ) : (
        <EscrowList
          t={t}
          creatorEscrows={creatorEscrows}
          beneficiaryEscrows={beneficiaryEscrows}
          approvingId={approvingId}
          cancellingId={cancellingId}
          claimingId={claimingId}
          statusLabelFunc={statusLabelFunc as (s: string) => string}
          formatAmountFunc={formatAmountFunc as (s: string, a: bigint) => string}
          formatAddressFunc={formatAddressFunc as (a: string) => string}
          onApprove={props.onApprove}
          onCancel={props.onCancel}
          onClaim={props.onClaim}
        />
      )}
    </>
  );
}
