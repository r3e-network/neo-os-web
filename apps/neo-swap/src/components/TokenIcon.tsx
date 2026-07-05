/**
 * TokenIcon.tsx -- shared official token imagery for Neo Swap surfaces.
 */

import { CoinArt } from "@shared/art";
import "./TokenIcon.scss";

interface TokenIconProps {
  symbol: string;
  className?: string;
  size?: number;
}

export default function TokenIcon({ symbol, className = "", size = 38 }: TokenIconProps) {
  const normalized = symbol.trim().toUpperCase();
  const variant = normalized === "NEO" ? "neo" : normalized === "GAS" ? "gas" : null;
  const fallback = normalized.slice(0, 1) || "?";
  const classes = [
    "neo-swap-token-icon",
    variant ? "has-image" : "is-fallback",
    className,
  ].filter(Boolean).join(" ");

  if (variant) {
    return <CoinArt className={classes} size={size} variant={variant} ariaLabel={`${normalized} token`} />;
  }

  return (
    <span className={classes} aria-hidden="true" style={{ width: size, height: size }}>
      <span>{fallback}</span>
    </span>
  );
}
