import React from "react";

/**
 * v2 DataPhase — the shared vocabulary for "a value the visitor cannot see yet".
 *
 * A miniapp's pre-wallet / pre-data first paint is a NORMAL, EXPECTED state, not
 * a failure. Rendering it as an em-dash grid, an "Unavailable" badge wall, or a
 * red error banner reads as a broken product to a first-time visitor. This
 * module is the one place that decides how each of the three honest states
 * looks, so every console renders them identically:
 *
 *   "loading"     — a read is genuinely in flight. Render a shimmer skeleton
 *                   sized like the eventual value. Never a character.
 *   "unavailable" — the read settled without data because the visitor has not
 *                   supplied the wallet/network it needs. Render neutral,
 *                   inviting zero-state copy supplied by the caller (from the
 *                   app's locale file — en + zh). Never an error tone.
 *   "ready"       — real data. Render it.
 *
 * `resolvePhase` collapses the two flags every composable already tracks
 * (in-flight, has-data) into that vocabulary, so callers never re-derive it.
 */
export type DataPhase = "loading" | "unavailable" | "ready";

/**
 * Collapse a composable's (loading, hasData) pair into a DataPhase.
 *
 * `settled` distinguishes "no data because we have not asked yet / are asking"
 * from "no data because the answer came back empty". Before the first read
 * settles the honest phase is always "loading" — that is what keeps a cold
 * first paint from flashing zero-state copy at a visitor whose data is 200ms
 * away.
 */
export function resolvePhase(options: {
  /** True while a read is in flight. */
  loading: boolean;
  /** True once at least one read attempt has completed (success or failure). */
  settled: boolean;
  /** True when real data is present and safe to render. */
  hasData: boolean;
}): DataPhase {
  if (options.hasData) return "ready";
  if (options.loading || !options.settled) return "loading";
  return "unavailable";
}

export interface SkeletonProps {
  /** CSS width of the shimmer bar. Size it like the value it stands in for. */
  width?: string;
  /** CSS height of the shimmer bar. Defaults to the current line box. */
  height?: string;
  className?: string;
  /**
   * Accessible label announced while the value loads. Pass the app's localized
   * "Loading" string; omit for decorative skeletons inside a labelled region.
   */
  label?: string;
}

/**
 * A shimmer placeholder that occupies the value's eventual footprint. Purely
 * presentational: the shimmer collapses under `prefers-reduced-motion`.
 */
export function Skeleton({ width = "4.5em", height, className, label }: SkeletonProps) {
  return (
    <span
      className={["mx2-skeleton", className].filter(Boolean).join(" ")}
      style={{ width, ...(height ? { height } : null) }}
      role={label ? "status" : undefined}
      aria-live={label ? "polite" : undefined}
      aria-hidden={label ? undefined : true}
    >
      {label ? <span className="mx2-skeleton__sr">{label}</span> : null}
    </span>
  );
}

export interface PhaseValueProps {
  phase: DataPhase;
  /** The real value. Rendered only when phase === "ready". */
  children?: React.ReactNode;
  /**
   * Honest zero-state copy for "unavailable" — e.g. "Connect to load".
   * MUST come from the app's locale file so en + zh stay in step. Never an
   * em-dash, never an error string.
   */
  placeholder: React.ReactNode;
  /** Skeleton width while loading. Size it like the eventual value. */
  skeletonWidth?: string;
  className?: string;
}

/**
 * Render one value across all three honest phases. This is the component that
 * replaces every `value ?? "—"` fallback in a console.
 */
export function PhaseValue({
  phase,
  children,
  placeholder,
  skeletonWidth,
  className,
}: PhaseValueProps) {
  if (phase === "loading") {
    return <Skeleton width={skeletonWidth} className={className} />;
  }
  if (phase === "unavailable") {
    return (
      <span
        className={["mx2-phase-idle", className].filter(Boolean).join(" ")}
        data-phase="unavailable"
      >
        {placeholder}
      </span>
    );
  }
  return <>{children}</>;
}
