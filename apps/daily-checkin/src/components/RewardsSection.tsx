import { NeoCard, NeoButton } from "@shared/components-react";
import { formatGas } from "@shared/utils/format";
import { MILESTONES } from "../composables/useCheckin";
import "./RewardsSection.scss";

interface RewardsSectionProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  currentStreak: number;
  unclaimedRewards: number;
  totalClaimed: number;
  isClaiming: boolean;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function RewardsSection({ t, currentStreak, unclaimedRewards, totalClaimed, isClaiming, dispatch }: RewardsSectionProps) {
  const handleClaim = async () => {
    await dispatch("claimRewards");
  };

  return (
    <>
      {/* Reward Milestones */}
      <NeoCard variant="erobo-neo" className="milestones-card">
        <div className="milestones-row">
          {MILESTONES.map((milestone) => {
            const reached = currentStreak >= milestone.day;
            const next = currentStreak < milestone.day && currentStreak >= milestone.day - 7;
            const classes = ["milestone", reached ? "reached" : "", next ? "next" : ""].filter(Boolean).join(" ");
            return (
              <div key={milestone.day} className={classes}>
                <div className="milestone-icon">
                  {reached ? "\u2714" : "\u25C9"}
                </div>
                <span className="milestone-day">{t("day")} {milestone.day}</span>
                <span className="milestone-reward">+{milestone.reward} {t("tokenGas")}</span>
                <span className="milestone-cumulative">({milestone.cumulative} {t("total")})</span>
              </div>
            );
          })}
        </div>
      </NeoCard>

      {/* Rewards Claim */}
      {unclaimedRewards > 0 && (
        <NeoCard variant="erobo" className="rewards-card">
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
          <NeoButton
            variant="success"
            size="md"
            block
            loading={isClaiming}
            className="claim-btn"
            onClick={handleClaim}
          >
            {t("claimRewards")} ({formatGas(unclaimedRewards)} {t("tokenGas")})
          </NeoButton>
        </NeoCard>
      )}
    </>
  );
}
