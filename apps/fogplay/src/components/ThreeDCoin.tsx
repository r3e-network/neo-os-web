import { useMemo } from "react";
import "./ThreeDCoin.scss";

interface ThreeDCoinProps {
  result: "heads" | "tails" | null;
  flipping: boolean;
  /** Localized label for the heads face (e.g. "Heads"). */
  headsLabel?: string;
  /** Localized label for the tails face (e.g. "Tails"). */
  tailsLabel?: string;
}

export default function ThreeDCoin({ result, flipping, headsLabel, tailsLabel }: ThreeDCoinProps) {
  const coinStyle = useMemo(() => {
    if (flipping) return { animation: "coin-spin-infinite 0.5s linear infinite" };
    const rotation = result === "tails" ? 180 : 0;
    return { transform: `rotateY(${rotation}deg) rotateX(0deg)`, transition: "transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)" };
  }, [result, flipping]);

  return (
    <div className="coin-scene">
      <div className={`coin-container${flipping ? " flipping" : ""}`} style={coinStyle}>
        <div className="coin-face front">
          <div className="coin-symbol">N</div>
          {headsLabel ? <span className="coin-face-label">{headsLabel}</span> : null}
        </div>
        <div className="coin-face back">
          <div className="coin-symbol">G</div>
          {tailsLabel ? <span className="coin-face-label">{tailsLabel}</span> : null}
        </div>
      </div>
      <div className={`coin-shadow${flipping ? " is-flipping" : ""}`} />
    </div>
  );
}
