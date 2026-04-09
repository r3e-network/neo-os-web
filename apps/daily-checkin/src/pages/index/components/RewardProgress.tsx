import { NeoCard } from "@shared/components-react";
import "./RewardProgress.scss";

interface RewardProgressProps {
  milestones: Array<{ day: number; reward: number; cumulative: number }>;
  currentStreak: number;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export default function RewardProgress({ milestones, currentStreak, t }: RewardProgressProps) {
  return (
    <NeoCard variant="erobo-neo" className="reward-card">
      <div className="reward-milestones">
        {milestones.map((milestone) => {
          const reached = currentStreak >= milestone.day;
          const next = currentStreak < milestone.day && currentStreak >= milestone.day - 7;
          const classes = ["milestone", reached ? "reached" : "", next ? "next" : ""].filter(Boolean).join(" ");
          return (
            <div key={milestone.day} className={classes}>
              <div className="milestone-icon">{reached ? "\u2714" : "\u25C9"}</div>
              <span className="milestone-day">{t("day")} {milestone.day}</span>
              <span className="milestone-reward">+{milestone.reward} {t("tokenGas")}</span>
              <span className="milestone-cumulative">({milestone.cumulative} {t("total")})</span>
            </div>
          );
        })}
      </div>
    </NeoCard>
  );
}
