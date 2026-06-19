import type { CSSProperties } from "react";
import type { Developer } from "../composables/useDevTippingStats";

interface TipListProps {
  developers: Developer[]; formatNum: (n: number | string) => string;
  onSelect: (dev: Developer) => void; t: (key: string) => string;
}

/** First-letter monogram for a developer name; falls back to "#" for empty names. */
function devInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed[0].toUpperCase() : "#";
}

/**
 * Deterministic warm tint per developer so each monogram reads as an individual
 * identity, not an identical row. Hue is derived from the name so it stays stable
 * across renders while staying within the app's single green-family accent range.
 */
function avatarHue(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 360;
  // Bias toward the green/teal/blue arc (120-220) to stay in one coherent family.
  return 120 + (hash % 100);
}

export default function TipList({ developers, formatNum, onSelect, t }: TipListProps) {
  return (
    <div className="tip-list">
      {developers.map((dev) => (
        <button key={dev.id} type="button" className="dev-card-glass" aria-label={dev.name} onClick={() => onSelect(dev)}>
          <div className="dev-card-header">
            <span
              className="dev-avatar"
              aria-hidden="true"
              style={{ "--dev-avatar-hue": avatarHue(dev.name) } as CSSProperties}
            >
              {devInitial(dev.name)}
            </span>
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
