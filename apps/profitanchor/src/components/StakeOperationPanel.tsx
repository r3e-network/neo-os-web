/**
 * StakeOperationPanel.tsx -- Stake/Unstake/Claim panel for ProfitAnchor.
 */

import { useState } from "react";
import { NeoButton, NeoInput, NeoCard } from "@shared/components-react";
import { formatNumber } from "@shared/utils/format";
import "./StakeOperationPanel.scss";

interface StakeOperationPanelProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  pendingRewards: number;
  pendingWithdraw: number;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function StakeOperationPanel({ t, pendingRewards, pendingWithdraw, dispatch }: StakeOperationPanelProps) {
  const formatNum = (n: number | string) => formatNumber(n, 2);
  const [stakeAmount, setStakeAmount] = useState("");
  const [unstakeAmount, setUnstakeAmount] = useState("");
  const [isStaking, setIsStaking] = useState(false);
  const [isUnstaking, setIsUnstaking] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  const handleStake = async () => {
    const amount = parseInt(stakeAmount, 10);
    if (!amount || amount <= 0) return;
    setIsStaking(true);
    try { await dispatch("stake", amount); setStakeAmount(""); } finally { setIsStaking(false); }
  };

  const handleUnstake = async () => {
    const amount = parseInt(unstakeAmount, 10);
    if (!amount || amount <= 0) return;
    setIsUnstaking(true);
    try { await dispatch("unstake", amount); setUnstakeAmount(""); } finally { setIsUnstaking(false); }
  };

  const handleClaim = async () => {
    if (pendingRewards <= 0) return;
    setIsClaiming(true);
    try { await dispatch("claimRewards"); } finally { setIsClaiming(false); }
  };

  const handleClaimPendingWithdraw = async () => {
    if (pendingWithdraw <= 0) return;
    await dispatch("claimPendingWithdraw");
  };

  return (
    <NeoCard variant="erobo">
      <div className="stake-form">
        <div className="input-group mb-4">
          <div className="input-row">
            <NeoInput type="number" value={stakeAmount} label={t("stake")} placeholder={t("amount")} onChange={(val) => setStakeAmount(val)} />
            <NeoButton variant="primary" loading={isStaking} aria-label={t("stake")} onClick={handleStake}>{t("stake")}</NeoButton>
          </div>
        </div>

        <div className="input-group mb-4">
          <div className="input-row">
            <NeoInput type="number" value={unstakeAmount} label={t("unstake")} placeholder={t("amount")} onChange={(val) => setUnstakeAmount(val)} />
            <NeoButton variant="secondary" loading={isUnstaking} aria-label={t("unstake")} onClick={handleUnstake}>{t("unstake")}</NeoButton>
          </div>
        </div>

        <div className="claim-panel">
          <div className="claim-panel__copy">
            <span className="claim-panel__label">{t("pendingRewards")}</span>
            <span className="claim-panel__value">{formatNum(pendingRewards)} GAS</span>
          </div>
          <NeoButton variant="primary" loading={isClaiming} disabled={pendingRewards <= 0} aria-label={t("claim")} onClick={handleClaim}>{t("claim")}</NeoButton>
        </div>

        <div className="claim-panel claim-panel--withdraw">
          <div className="claim-panel__copy">
            <span className="claim-panel__label">{t("pendingWithdrawLabel")}</span>
            <span className="claim-panel__value">{formatNum(pendingWithdraw)} NEO</span>
            <span className="claim-panel__hint">{t("withdrawQueueDesc")}</span>
          </div>
          <NeoButton variant="secondary" disabled={pendingWithdraw <= 0} aria-label={t("claimPendingWithdraw")} onClick={handleClaimPendingWithdraw}>{t("claimPendingWithdraw")}</NeoButton>
        </div>
      </div>
    </NeoCard>
  );
}
