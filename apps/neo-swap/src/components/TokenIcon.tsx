/**
 * TokenIcon.tsx -- shared token imagery for Neo Swap surfaces.
 */

import gasTokenUrl from "../static/gas-token.png";
import neoTokenUrl from "../static/neo-token.png";
import "./TokenIcon.scss";

interface TokenIconProps {
  symbol: string;
  className?: string;
}

const TOKEN_IMAGES: Record<string, string> = {
  GAS: gasTokenUrl,
  NEO: neoTokenUrl,
};

export default function TokenIcon({ symbol, className = "" }: TokenIconProps) {
  const normalized = symbol.trim().toUpperCase();
  const imageUrl = TOKEN_IMAGES[normalized];
  const fallback = normalized.slice(0, 1) || "?";
  const classes = [
    "neo-swap-token-icon",
    imageUrl ? "has-image" : "is-fallback",
    className,
  ].filter(Boolean).join(" ");

  return (
    <span className={classes} aria-hidden="true">
      {imageUrl ? (
        <img src={imageUrl} alt="" loading="lazy" decoding="async" />
      ) : (
        <span>{fallback}</span>
      )}
    </span>
  );
}
