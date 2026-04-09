import { NeoCard, NeoButton } from "@shared/components-react";
import { formatGas } from "@shared/utils/format";
import "./UserRewards.scss";

interface UserRewardsProps {
  unclaimedRewards: number;
  totalClaimed: number;
  isClaiming: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
  onClaim: () => void;
}

export default function UserRewards({ unclaimedRewards, totalClaimed, isClaiming, t, onClaim }: UserRewardsProps) {
  return (
    <NeoCard variant="erobo" className="mt-4">
      <div className="rewards-grid">
        <div className="reward-item">
          <span className="reward-value">{formatGas(unclaimedRewards)}</span>
          <span className="reward-label">{t("unclaimed")}</span>
        </div>
        <div className="reward-item">
          <span className="reward-value">{formatGas(totalClaimed)}</span>
          <span className="reward-label">{t("totalClaimed")}</span>
        </div>
      </div>
      {unclaimedRewards > 0 && (
        <NeoButton
          variant="success"
          size="md"
          block
          loading={isClaiming}
          onClick={onClaim}
          className="mt-4"
        >
          {t("claimRewards")} ({formatGas(unclaimedRewards)} {t("tokenGas")})
        </NeoButton>
      )}
    </NeoCard>
  );
}
