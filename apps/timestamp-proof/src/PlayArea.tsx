/**
 * PlayArea.tsx — React version of Timestamp Proof PlayArea.
 *
 * Renders the stamp-seal hero section with proof counts,
 * quick stats, and the proof list display.
 */

import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import ProofHero from "./components/ProofHero";
import ProofQuickStats from "./components/ProofQuickStats";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { num } = useStateBindings(state);

  const totalProofs = num("totalProofs");
  const yourProofs = num("yourProofs");

  return (
    <div className="proof-play-area">
      <ProofHero t={t} totalProofs={totalProofs} yourProofs={yourProofs} />

      <ProofQuickStats t={t} totalProofs={totalProofs} yourProofs={yourProofs} />

      {/* Proof List */}
      <div className="proof-list-container">
        {totalProofs === 0 && (
          <div className="empty-state">
            <span>{t("noProofs")}</span>
          </div>
        )}
      </div>
    </div>
  );
}
