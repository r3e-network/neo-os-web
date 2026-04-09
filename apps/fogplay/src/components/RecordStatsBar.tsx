import { useMemo } from "react";
import "./RecordStatsBar.scss";

interface RecordStatsBarProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  wins: number;
  losses: number;
  totalGames: number;
}

export default function RecordStatsBar({ t, wins, losses, totalGames }: RecordStatsBarProps) {
  const winRate = useMemo(() => totalGames === 0 ? 0 : Math.round((wins / totalGames) * 100), [wins, totalGames]);
  return (
    <div className="record-bar">
      <div className="record-item win"><span className="record-emoji" aria-hidden="true">&#x2705;</span><span className="record-count">{wins}</span><span className="record-label">{t("wins")}</span></div>
      <div className="record-divider" />
      <div className="record-item total"><span className="record-count">{totalGames}</span><span className="record-label">{t("totalGames")}</span></div>
      <div className="record-divider" />
      <div className="record-item loss"><span className="record-emoji" aria-hidden="true">&#x274C;</span><span className="record-count">{losses}</span><span className="record-label">{t("losses")}</span></div>
      <div className="record-divider" />
      <div className="record-item rate"><span className="record-count">{winRate}%</span><span className="record-label">WIN RATE</span></div>
    </div>
  );
}
