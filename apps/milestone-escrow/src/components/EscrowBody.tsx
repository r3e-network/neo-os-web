import { NeoCard, NeoButton } from "@shared/components-react";
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
    return <NeoCard title={t("deploymentPendingTitle")}><p>{t("deploymentPendingDesc")}</p></NeoCard>;
  }

  return (
    <>
      <div className="escrows-header">
        <span className="section-title">{t("escrowsTab")}</span>
        <NeoButton size="sm" variant="secondary" loading={isRefreshing} aria-label={t("refresh")} onClick={props.onRefresh}>{t("refresh")}</NeoButton>
      </div>
      {!hasAddress ? (
        <div className="empty-state">
          <NeoCard>
            <span className="mb-3 block text-sm">{t("walletNotConnected")}</span>
            <NeoButton size="sm" variant="primary" aria-label={t("connectWallet")} onClick={props.onConnectWallet}>{t("connectWallet")}</NeoButton>
          </NeoCard>
        </div>
      ) : (
        <EscrowList
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
