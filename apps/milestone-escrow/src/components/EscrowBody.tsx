import { NeoButton } from "@shared/components-react";
import { EmptyStateArt } from "@shared/components-react/illustrations";
import { StateView } from "@shared/components";
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
      <StateView
        kind="empty"
        className="escrow-state-view"
        icon={<EmptyStateArt size={132} title={t("deploymentPendingTitle")} />}
        title={t("deploymentPendingTitle")}
        hint={t("deploymentPendingDesc")}
      />
    );
  }

  return (
    <>
      <div className="escrows-header">
        <span className="section-title">{t("escrowsTab")}</span>
        <NeoButton size="sm" variant="secondary" loading={isRefreshing} aria-label={t("refresh")} onClick={props.onRefresh}>{t("refresh")}</NeoButton>
      </div>
      {!hasAddress ? (
        <StateView
          kind="empty"
          className="escrow-state-view"
          icon={<EmptyStateArt size={132} title={t("walletNotConnected")} />}
          title={t("walletNotConnected")}
          action={
            <NeoButton size="sm" variant="primary" aria-label={t("connectWallet")} onClick={props.onConnectWallet}>{t("connectWallet")}</NeoButton>
          }
        />
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
