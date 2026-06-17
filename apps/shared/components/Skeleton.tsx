import type { CSSProperties } from "react";
import "./Skeleton.scss";

export type SkeletonShape = "line" | "block" | "circle";

export interface SkeletonProps {
  /** Visual shape of the placeholder. */
  shape?: SkeletonShape;
  /** CSS width (e.g. "100%", 120, "8rem"). Defaults to 100% for line/block. */
  width?: number | string;
  /** CSS height (e.g. 16, "1.5rem"). Sensible per-shape default if omitted. */
  height?: number | string;
  /** Number of stacked placeholders to render (line shape only). */
  count?: number;
  /** Border radius override. Falls back to a shape-appropriate token. */
  radius?: number | string;
  className?: string;
  style?: CSSProperties;
}

function toCss(value: number | string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === "number" ? `${value}px` : value;
}

/**
 * Skeleton — a token-styled shimmer placeholder for content that is loading.
 *
 * Decorative by design: marked aria-hidden so screen readers announce the
 * surrounding live region (e.g. a StateView with kind="loading") instead of
 * the placeholder bars. Honours prefers-reduced-motion (shimmer disabled).
 */
export function Skeleton({
  shape = "line",
  width,
  height,
  count = 1,
  radius,
  className,
  style,
}: SkeletonProps) {
  const bars = Math.max(1, Math.floor(count));

  const baseStyle: CSSProperties = {
    width: toCss(width),
    height: toCss(height),
    borderRadius: toCss(radius),
    ...style,
  };

  const classes = ["ns-skeleton", `ns-skeleton--${shape}`, className]
    .filter(Boolean)
    .join(" ");

  if (bars === 1) {
    return <span className={classes} style={baseStyle} aria-hidden="true" />;
  }

  return (
    <span className="ns-skeleton-stack" aria-hidden="true">
      {Array.from({ length: bars }, (_, index) => (
        <span
          key={index}
          className={classes}
          style={{
            ...baseStyle,
            // Last line is shorter, mimicking real text flow.
            width: index === bars - 1 ? toCss(width) ?? "62%" : baseStyle.width,
          }}
        />
      ))}
    </span>
  );
}

export default Skeleton;
