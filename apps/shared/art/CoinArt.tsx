import React from "react";
import gasTokenUrl from "../assets/tokens/gas-icon.svg";
import neoTokenUrl from "../assets/tokens/neo-icon.svg";

/**
 * Official NEO/GAS token icon badge for reward/payout surfaces.
 * Source: Neo Press Kit NEO Icon / GAS Icon.
 */
export interface CoinArtProps {
  className?: string;
  size?: number;
  style?: React.CSSProperties;
  ariaLabel?: string;
  decorative?: boolean;
  /** "neo" (green) or "gas" (amber) preset, else falls back to accent vars. */
  variant?: "neo" | "gas" | "accent";
}

export function CoinArt({
  ariaLabel,
  className,
  decorative,
  size = 48,
  style,
  variant = "accent",
}: CoinArtProps) {
  const token =
    variant === "neo"
      ? { label: "NEO", src: neoTokenUrl, ring: "rgba(0, 175, 146, 0.2)", glow: "rgba(0, 175, 146, 0.18)" }
      : variant === "gas"
        ? { label: "GAS", src: gasTokenUrl, ring: "rgba(1, 227, 151, 0.22)", glow: "rgba(1, 227, 151, 0.18)" }
        : { label: "GAS", src: gasTokenUrl, ring: "var(--mx2-border, rgba(31, 41, 55, 0.08))", glow: "rgba(31, 41, 55, 0.08)" };

  return (
    <span
      className={["mx2-coin", className].filter(Boolean).join(" ")}
      style={{
        width: size,
        height: size,
        display: "inline-flex",
        flex: "0 0 auto",
        alignItems: "center",
        justifyContent: "center",
        border: `1px solid ${token.ring}`,
        borderRadius: "50%",
        background: "#ffffff",
        boxShadow: `0 5px 12px ${token.glow}, inset 0 0 0 2px rgba(255, 255, 255, 0.72)`,
        overflow: "hidden",
        ...style,
      }}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : ariaLabel ?? `${token.label} token`}
    >
      <img
        src={token.src}
        alt=""
        loading="eager"
        decoding="async"
        style={{
          display: "block",
          width: "116%",
          height: "116%",
          objectFit: "contain",
        }}
      />
    </span>
  );
}

/**
 * A celebratory particle burst — renders N sparks flying outward. Each spark is
 * placed via --mx2-burst-angle/-dist custom properties (see _motion.scss).
 * Used for win/reward moments.
 */
export interface ParticleBurstProps {
  className?: string;
  count?: number;
  /** Render coins instead of sparks. */
  coins?: boolean;
}

export function ParticleBurst({ className, count = 12, coins }: ParticleBurstProps) {
  return (
    <div
      className={["mx2-burst", className].filter(Boolean).join(" ")}
      aria-hidden="true"
    >
      {Array.from({ length: count }).map((_, i) => {
        const angle = (i / count) * 360;
        const dist = 50 + ((i * 37) % 30);
        const style = {
          "--mx2-burst-angle": `${angle}deg`,
          "--mx2-burst-dist": `${dist}px`,
          animationDelay: `${(i % 4) * 40}ms`,
        } as React.CSSProperties;
        return coins ? (
          <CoinArt key={i} size={22} className="mx2-spark" variant="gas" style={style} />
        ) : (
          <span key={i} className="mx2-spark mx2-spark-dot" style={style} />
        );
      })}
    </div>
  );
}
