/**
 * PopularPairs.tsx -- Popular trading pairs for Neo Swap.
 */

import { NeoCard } from "@shared/components-react";
import "./PopularPairs.scss";

interface PopularPairsProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  selectedPair: string;
  popularPairs: Array<{ id: string; name: string; rate: string }>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PopularPairs({ t, selectedPair, popularPairs, dispatch }: PopularPairsProps) {
  const handleSelectPair = (pairId: string) => {
    dispatch("selectPair", pairId);
  };

  return (
    <NeoCard variant="erobo">
      <div className="pair-list">
        {popularPairs.map((pair) => (
          <div
            key={pair.id}
            className={`pair-item ${selectedPair === pair.id ? "active" : ""}`}
            onClick={() => handleSelectPair(pair.id)}
          >
            <div className="pair-info">
              <span className="pair-name">{pair.name}</span>
              <span className="pair-rate">{pair.rate}</span>
            </div>
          </div>
        ))}
      </div>
    </NeoCard>
  );
}
