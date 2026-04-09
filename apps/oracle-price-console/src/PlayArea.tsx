/**
 * PlayArea.tsx — React version of the Oracle Price Console PlayArea.
 *
 * Same visual output and behavior as the Vue PlayArea.vue.
 * Uses useStateBindings hook instead of Vue computed properties.
 */

import { NeoButton, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool } = useStateBindings(state);

  const asset = str("asset", "NEO");
  const priceDisplay = str("priceDisplay", t("notAvailable"));
  const isRequesting = bool("isRequesting");

  return (
    <div className="price-play-area">
      {/* Result Section */}
      <div className="result-section">
        <span className="result-symbol">{asset}</span>
        <span className="result-price">{priceDisplay}</span>
      </div>

      {/* Operation Section */}
      <div className="stack">
        <NeoInput
          value={asset}
          label={t("asset")}
          placeholder={t("assetPlaceholder")}
          onChange={(val) => dispatch("updateAsset", val)}
        />
        <NeoButton
          variant="primary"
          loading={isRequesting}
          aria-label={t("fetchPrice")}
          onClick={() => dispatch("fetchPrice")}
        >
          {t("fetchPrice")}
        </NeoButton>
      </div>
    </div>
  );
}
