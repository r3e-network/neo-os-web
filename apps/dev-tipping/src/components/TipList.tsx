import type { Developer } from "../composables/useDevTippingStats";

interface TipListProps {
  developers: Developer[]; formatNum: (n: number | string) => string;
  onSelect: (dev: Developer) => void; t: (key: string) => string;
}

export default function TipList({ developers, formatNum, onSelect, t }: TipListProps) {
  return (
    <div className="tip-list">
      {developers.map((dev) => (
        <button key={dev.id} type="button" className="dev-card-glass" aria-label={dev.name} onClick={() => onSelect(dev)}>
          <div className="dev-card-header">
            <div className="dev-info">
              <span className="dev-name-glass">{dev.name}</span>
              <span className="dev-projects-glass">{dev.role}</span>
            </div>
          </div>
          <div className="dev-card-footer-glass">
            <div className="tip-stats">
              <span className="tip-label-glass">{t("totalTips")}</span>
              <span className="tip-amount-glass">{formatNum(dev.totalTips)} {t("tokenGas")}</span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}
