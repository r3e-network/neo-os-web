import "./StatsPanel.scss";

interface StatsPanelProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  onSwitchToJazz: () => void;
  onOpenLink: (url: string) => void;
}

export default function StatsPanel({ t, onSwitchToJazz, onOpenLink }: StatsPanelProps) {
  return (
    <div className="stats-container">
      <div className="section">
        <div className="section-content">
          <span className="section-title">{t("whatIsBneoTitle")}</span>
          <span className="section-strong">{t("whatIsBneoStrong")}</span>
        </div>
      </div>
      <div className="section">
        <div className="section-content">
          <span className="section-title">{t("whyNeedBneoTitle")}</span>
          <span className="section-strong">{t("bneoRate")}</span>
          <span className="section-text">{t("whyNeedBneoDesc1")}</span>
        </div>
      </div>
      <div className="section center">
        <span className="section-title">{t("rewardsSourceTitle")}</span>
        <span className="section-text">{t("rewardsSourceDesc")}</span>
        <span className="section-strong">{t("rewardsSourceStrong")}</span>
      </div>
    </div>
  );
}
