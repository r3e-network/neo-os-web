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
  if (!variant) return null;
  const classes = ["neo-swap-token-icon", "has-image", className].filter(Boolean).join(" ");
  return <CoinArt className={classes} size={size} variant={variant} ariaLabel={`${normalized} token`} />;
}
