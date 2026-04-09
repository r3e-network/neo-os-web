import { NeoCard } from "@shared/components-react";
import "./StreakDisplay.scss";

interface StreakDisplayProps {
  currentStreak: number;
  highestStreak: number;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export default function StreakDisplay({ currentStreak, highestStreak, t }: StreakDisplayProps) {
  return (
    <NeoCard variant="erobo" className="streak-card pt-6 pb-6 text-center">
      <div className="streak-flames">
        {currentStreak > 0
          ? Array.from({ length: Math.min(currentStreak, 7) }, (_, i) => (
              <span key={i} className="flame">{"\uD83D\uDD25"}</span>
            ))
          : <span className="flame-empty">{"\uD83D\uDCA4"}</span>}
      </div>
      <span className="streak-count">{currentStreak} {t("dayStreak")}</span>
      <span className="streak-best">{t("bestStreak")}: {highestStreak} {t("days")}</span>
    </NeoCard>
  );
}
