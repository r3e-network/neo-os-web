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
          <span className="coin-symbol" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="46" height="46" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="16 4 27 10 27 22 16 28 5 22 5 10" />
              <path d="M12 22V11l8 10V11" />
            </svg>
          </span>
          {headsLabel ? <span className="coin-face-label">{headsLabel}</span> : null}
        </div>
        <div className="coin-face back">
          <span className="coin-symbol" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="46" height="46" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="16" cy="16" r="11" />
              <path d="M16 8v16M9.5 12.5h7a2.6 2.6 0 0 1 0 5.2h-4.2a2.6 2.6 0 0 0 0 5.2h7" />
            </svg>
          </span>
          {tailsLabel ? <span className="coin-face-label">{tailsLabel}</span> : null}
        </div>
      </div>
      <div className={`coin-shadow${flipping ? " is-flipping" : ""}`} />
    </div>
  );
}
