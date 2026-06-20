/**
 * PopularPairs.tsx -- Accessible popular trading pairs for Neo Swap.
 */

import { ArrowRight, LineChart } from "lucide-react";
import { NeoCard } from "@shared/components-react";
import TokenIcon from "./TokenIcon";
import "./PopularPairs.scss";

interface PopularPairsProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  selectedPair: string;
  popularPairs: Array<{ id: string; name: string }>;
  routeHealth: string;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PopularPairs({
  t,
  selectedPair,
  popularPairs,
  routeHealth,
  dispatch,
}: PopularPairsProps) {
  const handleSelectPair = (pairId: string) => {
    dispatch("selectPair", pairId);
  };

  return (
    <NeoCard variant="erobo" className="neo-swap-pairs-card">
      <div className="pair-header">
        <div>
          <span>{t("marketPairs")}</span>
          <strong>{t("popularPairs")}</strong>
        </div>
        <small><LineChart size={13} aria-hidden="true" />{t("quoteHealth")}</small>
      </div>
      <div className="pair-list">
        {popularPairs.map((pair) => {
          const [base = "", quote = ""] = pair.name.split("/");

          return (
            <button
              key={pair.id}
              type="button"
              className={`pair-item${selectedPair === pair.id ? " active" : ""}`}
              onClick={() => handleSelectPair(pair.id)}
            >
              <span className="pair-token-stack">
                <TokenIcon symbol={base} />
                <TokenIcon symbol={quote} />
              </span>
              <span className="pair-copy">
                <span className="pair-name">{pair.name}</span>
                <span className="pair-route">{t("routeDirectValue", { pair: pair.name })}</span>
              </span>
              <span className="pair-market">
                <span className="pair-status">{routeHealth}</span>
                <ArrowRight size={15} aria-hidden="true" />
              </span>
            </button>
          );
        })}
      </div>
    </NeoCard>
  );
}
