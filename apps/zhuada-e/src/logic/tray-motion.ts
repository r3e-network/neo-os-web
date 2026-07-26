import { TRAY_SLOTS, type ExtractReceipt } from "./engine-zhuada";

/**
 * Deliberate, readable tray cadence. The incoming chip first travels/group-slides,
 * a completed triple then holds a bright confirmation beat, fades, and only
 * afterwards lets surviving chips close the gap.
 *
 * v3.2 tuning: approachMs raised from 72→130ms so the "materialize above" beat
 * is perceptible on 60Hz displays (was only ~4 frames, read as a flicker).
 * compactOvershootMs adds a spring-like overshoot on compaction for juicier feel.
 */
export const TRAY_MOTION_TIMINGS = Object.freeze({
  approachMs: 130,
  groupingMs: 620,
  highlightMs: 240,
  clearMs: 420,
  compactMs: 460,
  /** Spring overshoot duration after compact — tokens scale to 1.04 then settle. */
  compactOvershootMs: 120,
});

export const TRAY_ENTRY_MOTION_MS =
  TRAY_MOTION_TIMINGS.approachMs + TRAY_MOTION_TIMINGS.groupingMs;

export const TRAY_MATCH_MOTION_MS =
  TRAY_ENTRY_MOTION_MS
  + TRAY_MOTION_TIMINGS.highlightMs
  + TRAY_MOTION_TIMINGS.clearMs
  + TRAY_MOTION_TIMINGS.compactMs;

/**
 * Progressive tray tension level for visual warning cues:
 * - 0: safe (0-4 slots filled)
 * - 1: caution (5 slots filled) — slots pulse amber
 * - 2: danger (6 slots filled) — slots pulse red, screen edge vignette
 */
export function trayWarningLevel(filledCount: number): 0 | 1 | 2 {
  if (filledCount >= 6) return 2;
  if (filledCount >= 5) return 1;
  return 0;
}

export type TrayMotionPhase =
  | "idle"
  | "approach"
  | "grouping"
  | "highlight"
  | "clearing"
  | "compacting";

export interface TrayToken {
  id: string;
  kind: number;
  index: number;
  incoming: boolean;
  matched: boolean;
}

export interface TrayMotionState {
  phase: TrayMotionPhase;
  tokens: TrayToken[];
  receiptNonce: number;
  settledTray: (number | null)[];
  matched: boolean;
}

function normalizedTray(tray: (number | null)[]): (number | null)[] {
  return Array.from({ length: TRAY_SLOTS }, (_, index) => tray[index] ?? null);
}

function seedTokens(tray: (number | null)[], generation: number): TrayToken[] {
  return normalizedTray(tray).flatMap((kind, index) => kind === null ? [] : [{
    id: `tray-${generation}-${index}-${kind}`,
    kind,
    index,
    incoming: false,
    matched: false,
  }]);
}

export function createTrayMotionState(
  tray: (number | null)[],
  generation = 0,
): TrayMotionState {
  return {
    phase: "idle",
    tokens: seedTokens(tray, generation),
    receiptNonce: 0,
    settledTray: normalizedTray(tray),
    matched: false,
  };
}

function tokensByKind(tokens: TrayToken[]): Map<number, TrayToken[]> {
  const grouped = new Map<number, TrayToken[]>();
  for (const token of [...tokens].sort((a, b) => a.index - b.index)) {
    const bucket = grouped.get(token.kind) ?? [];
    bucket.push(token);
    grouped.set(token.kind, bucket);
  }
  return grouped;
}

function mapExistingTokensToTray(
  existing: TrayToken[],
  tray: (number | null)[],
  fallbackPrefix: string,
  forced?: { index: number; token: TrayToken },
): TrayToken[] {
  const available = tokensByKind(existing);
  const next: TrayToken[] = [];
  for (const [index, kind] of normalizedTray(tray).entries()) {
    if (kind === null) continue;
    if (forced && index === forced.index) {
      next.push({ ...forced.token, index });
      continue;
    }
    const token = available.get(kind)?.shift();
    next.push(token
      ? { ...token, index, incoming: false, matched: false }
      : {
          id: `${fallbackPrefix}-${index}-${kind}`,
          kind,
          index,
          incoming: false,
          matched: false,
        });
  }
  return next;
}

/** Start one accepted pick from the engine's pre-clear presentation snapshot. */
export function startTrayMotion(
  current: TrayMotionState,
  receipt: ExtractReceipt,
): TrayMotionState {
  if (!receipt.accepted || receipt.nonce <= current.receiptNonce) return current;

  const incoming: TrayToken = {
    id: `pick-${receipt.nonce}-${receipt.itemId}`,
    kind: receipt.kind,
    index: receipt.placedIndex,
    incoming: true,
    matched: false,
  };
  const landingTokens = mapExistingTokensToTray(
    current.tokens.filter((token) => !token.matched),
    receipt.landingTray,
    `landing-${receipt.nonce}`,
    { index: receipt.placedIndex, token: incoming },
  );
  const cleared = new Set(receipt.clearedTray);

  return {
    phase: "approach",
    tokens: landingTokens.map((token) => ({
      ...token,
      matched: receipt.matched && cleared.has(token.index),
    })),
    receiptNonce: receipt.nonce,
    settledTray: normalizedTray(receipt.settledTray),
    matched: receipt.matched,
  };
}

/** Advance exactly one visual beat; timers live in the React presentation. */
export function advanceTrayMotion(current: TrayMotionState): TrayMotionState {
  if (current.phase === "idle") return current;
  if (current.phase === "approach") return { ...current, phase: "grouping" };
  if (current.phase === "grouping") {
    return current.matched
      ? { ...current, phase: "highlight" }
      : {
          ...current,
          phase: "idle",
          tokens: current.tokens.map((token) => ({ ...token, incoming: false })),
        };
  }
  if (current.phase === "highlight") return { ...current, phase: "clearing" };
  if (current.phase === "clearing") {
    const survivors = current.tokens.filter((token) => !token.matched);
    return {
      ...current,
      phase: "compacting",
      tokens: mapExistingTokensToTray(
        survivors,
        current.settledTray,
        `settled-${current.receiptNonce}`,
      ),
    };
  }
  return {
    ...current,
    phase: "idle",
    matched: false,
    tokens: current.tokens.map((token) => ({ ...token, incoming: false, matched: false })),
  };
}

/**
 * Finish a non-matching entry beat immediately so a newer rapid pick can take
 * over without waiting behind the full grouping timer. The already-visible
 * tokens keep their identity and destination, which lets CSS continue their
 * in-flight transform instead of snapping the whole tray.
 *
 * Match beats are deliberately not fast-forwarded: the completed triple still
 * gets its highlight, clear and compact sequence before queued picks resume.
 */
export function settleNonMatchEntry(current: TrayMotionState): TrayMotionState {
  if (current.matched || current.phase === "idle") return current;
  return {
    ...current,
    phase: "idle",
    tokens: current.tokens.map((token) => ({
      ...token,
      incoming: false,
      matched: false,
    })),
  };
}

export function trayMotionPhaseDuration(phase: TrayMotionPhase): number | null {
  switch (phase) {
    case "approach": return TRAY_MOTION_TIMINGS.approachMs;
    case "grouping": return TRAY_MOTION_TIMINGS.groupingMs;
    case "highlight": return TRAY_MOTION_TIMINGS.highlightMs;
    case "clearing": return TRAY_MOTION_TIMINGS.clearMs;
    case "compacting": return TRAY_MOTION_TIMINGS.compactMs;
    default: return null;
  }
}

export function trayFromTokens(tokens: TrayToken[]): (number | null)[] {
  const tray = Array<number | null>(TRAY_SLOTS).fill(null);
  for (const token of tokens) tray[token.index] = token.kind;
  return tray;
}
