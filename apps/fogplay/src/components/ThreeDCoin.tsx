import { useMemo } from "react";
import coinHeadsUrl from "../static/coin_heads.png";
import coinTailsUrl from "../static/coin_tails.png";
import "./ThreeDCoin.scss";

interface ThreeDCoinProps {
  result: "heads" | "tails" | null;
  flipping: boolean;
  /** Localized label for the heads face (e.g. "Heads"). */
  headsLabel?: string;
  /** Localized label for the tails face (e.g. "Tails"). */
  tailsLabel?: string;
  /** Keep the art clean when surrounding controls already label the sides. */
  showLabels?: boolean;
}

export default function ThreeDCoin({
  result,
  flipping,
  headsLabel,
  tailsLabel,
  showLabels = true,
}: ThreeDCoinProps) {
  const settledSide = result ?? "heads";
  const accessibleLabel = useMemo(() => {
    if (flipping) return `${headsLabel ?? "Heads"} / ${tailsLabel ?? "Tails"}`;
    return settledSide === "tails" ? (tailsLabel ?? "Tails") : (headsLabel ?? "Heads");
  }, [flipping, headsLabel, settledSide, tailsLabel]);

  return (
    <div
      className={`coin-scene coin-scene--${flipping ? "flipping" : `settled-${settledSide}`}`}
      data-result={settledSide}
      role="img"
      aria-label={accessibleLabel}
    >
      <div className="coin-motion">
        <div className={`coin-container coin-container--${settledSide}${flipping ? " flipping" : ""}`}>
          <span className="coin-rim" aria-hidden="true" />
          <div className="coin-face coin-face--heads">
            <img
              className="coin-face__image"
              src={coinHeadsUrl}
              alt=""
              draggable={false}
              decoding="async"
            />
            {showLabels && headsLabel ? <span className="coin-face-label">{headsLabel}</span> : null}
          </div>
          <div className="coin-face coin-face--tails">
            <img
              className="coin-face__image"
              src={coinTailsUrl}
              alt=""
              draggable={false}
              decoding="async"
            />
            {showLabels && tailsLabel ? <span className="coin-face-label">{tailsLabel}</span> : null}
          </div>
        </div>
      </div>
      <div className={`coin-shadow${flipping ? " is-flipping" : ""}`} />
    </div>
  );
}
