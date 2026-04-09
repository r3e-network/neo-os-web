/**
 * PlayArea.tsx — React version of the Neo Convert PlayArea.
 *
 * Renders the hero section and account generator tool.
 */

import type { Observable } from "@shared/react/context";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t }: PlayAreaProps) {
  return (
    <div className="neo-convert-play-area">
      {/* Hero Section */}
      <div className="hero-container">
        <div className="converter-scene" aria-hidden="true">
          <div className="convert-arrow convert-arrow--left">&llarr;</div>
          <div className="convert-arrow convert-arrow--right">&rlarr;</div>
        </div>
      </div>

      <div className="hero">
        <span className="hero-icon" aria-hidden="true">&#x1F6E0;&#xFE0F;</span>
        <span className="hero-title">{t("heroTitle")}</span>
        <span className="hero-subtitle">{t("heroSubtitle")}</span>
      </div>
    </div>
  );
}
