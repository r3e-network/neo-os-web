import { useMemo } from "react";
import "./StreakDisplay.scss";

interface StreakDisplayProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  currentStreak: number;
  highestStreak: number;
}

export default function StreakDisplay({ t, currentStreak, highestStreak }: StreakDisplayProps) {
  const flameEmoji = "\uD83D\uDD25";

  const streakTier = useMemo(() => {
    if (currentStreak >= 30) return "inferno";
    if (currentStreak >= 7) return "blaze";
    if (currentStreak > 0) return "spark";
    return "cold";
  }, [currentStreak]);

  const streakTierLabel = useMemo(() => {
    if (currentStreak >= 30) return "INFERNO";
    if (currentStreak >= 7) return "BLAZE";
    if (currentStreak > 0) return "SPARK";
    return "";
  }, [currentStreak]);

  return (
    <div className="streak-section">
      <div className={`streak-fire-ring ${streakTier}${currentStreak > 0 ? " active" : ""}`}>
        <div className="flame-stack" aria-hidden="true">
          <span className="flame flame-core">{flameEmoji}</span>
          {currentStreak >= 7 && <span className="flame flame-outer">{flameEmoji}</span>}
          {currentStreak >= 30 && <span className="flame flame-inferno">{flameEmoji}</span>}
        </div>
        <span className="streak-number">{currentStreak}</span>
      </div>
      <span className="streak-text">{t("dayStreak")}</span>
      <span className={`streak-tier-badge ${streakTier}`}>{streakTierLabel}</span>
      <span className="streak-best-text">
        {t("bestStreak")}: {highestStreak} {t("days")}
      </span>
    </div>
  );
}
