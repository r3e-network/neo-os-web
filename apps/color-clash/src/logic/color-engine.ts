/** Pure Color Clash (classic Simon) run state. */

export type ColorIndex = 0 | 1 | 2 | 3;
export type ColorRunPhase = "watching" | "input" | "wrong" | "complete";
export type ColorUiPhase = ColorRunPhase | "lobby" | "expired";
export type ColorPressOutcome =
  | "ignored"
  | "correct"
  | "round-complete"
  | "wrong"
  | "complete";

export interface ColorRunState {
  /** Full local secret. Never render this directly before its cues are revealed. */
  secretSequence: string;
  /** Prefix currently shown/repeated in the active Simon round. */
  visibleSequence: string;
  playerSequence: string;
  /** Longest fully completed cue count. */
  achieved: number;
  round: number;
  phase: ColorRunPhase;
}

export interface ColorPressResult {
  state: ColorRunState;
  outcome: ColorPressOutcome;
  expected?: ColorIndex;
  pressed?: ColorIndex;
}

export function isColorIndex(value: unknown): value is ColorIndex {
  return Number.isInteger(value) && Number(value) >= 0 && Number(value) <= 3;
}

export function normalizeColorSequence(value: unknown, maxLength = 64): string {
  const safeMax = Math.max(1, Math.min(512, Math.floor(Number(maxLength) || 64)));
  return String(value ?? "")
    .split("")
    .filter((char) => char >= "0" && char <= "3")
    .slice(0, safeMax)
    .join("");
}

/**
 * Parse a trusted-engine sequence without silently deleting malformed bytes.
 * Lenient normalization is useful for display recovery, but a TEE/session
 * payload must fail closed instead of turning e.g. `0x12` into a different,
 * apparently valid game.
 */
export function requireColorSequence(value: unknown, expectedLength?: number): string {
  const raw = String(value ?? "");
  const expected = expectedLength === undefined
    ? undefined
    : Math.max(1, Math.min(512, Math.floor(Number(expectedLength) || 1)));
  if (!/^[0-3]+$/.test(raw) || (expected !== undefined && raw.length !== expected)) {
    throw new Error("invalid-color-sequence");
  }
  return raw;
}

export function createColorRun(secret: unknown, targetLength?: number): ColorRunState {
  let raw: string;
  try {
    raw = requireColorSequence(secret);
  } catch {
    throw new Error("Color Clash requires a complete 0..3 secret sequence");
  }
  const requested = targetLength === undefined
    ? raw.length
    : Math.max(1, Math.floor(Number(targetLength) || 1));
  const canonical = raw.slice(0, requested);
  if (canonical.length !== requested) {
    throw new Error("Color Clash requires a complete 0..3 secret sequence");
  }
  return {
    secretSequence: canonical,
    visibleSequence: canonical.slice(0, 1),
    playerSequence: "",
    achieved: 0,
    round: 1,
    phase: "watching",
  };
}

export function markColorSequenceShown(state: Readonly<ColorRunState>): ColorRunState {
  if (state.phase !== "watching") return { ...state };
  return { ...state, phase: "input" };
}

export function applyColorPress(
  state: Readonly<ColorRunState>,
  value: unknown,
): ColorPressResult {
  if (state.phase !== "input" || !isColorIndex(value)) {
    return { state: { ...state }, outcome: "ignored" };
  }

  const expected = Number(state.visibleSequence[state.playerSequence.length]) as ColorIndex;
  const pressed = value;
  if (!isColorIndex(expected) || pressed !== expected) {
    return {
      state: { ...state, phase: "wrong" },
      outcome: "wrong",
      expected,
      pressed,
    };
  }

  const nextPlayer = state.playerSequence + String(pressed);
  if (nextPlayer.length < state.visibleSequence.length) {
    return {
      state: { ...state, playerSequence: nextPlayer },
      outcome: "correct",
      expected,
      pressed,
    };
  }

  const completedLength = state.visibleSequence.length;
  if (completedLength >= state.secretSequence.length) {
    return {
      state: {
        ...state,
        playerSequence: nextPlayer,
        achieved: state.secretSequence.length,
        phase: "complete",
      },
      outcome: "complete",
      expected,
      pressed,
    };
  }

  const nextRound = completedLength + 1;
  return {
    state: {
      ...state,
      visibleSequence: state.secretSequence.slice(0, nextRound),
      playerSequence: "",
      achieved: completedLength,
      round: nextRound,
      phase: "watching",
    },
    outcome: "round-complete",
    expected,
    pressed,
  };
}

export function hasColorDeadlinePassed(deadline: unknown, now = Date.now()): boolean {
  const value = Number(deadline);
  return Number.isFinite(value) && value > 0 && now >= value;
}
