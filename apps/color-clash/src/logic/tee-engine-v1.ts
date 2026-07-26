import { sha256 } from "../../../shared/shims/noble-hashes-sha256.js";

const SEQUENCE_LEN = 24;

interface ColorStream {
  next(): number;
}

function streamOf(seed: Uint8Array): ColorStream {
  if (!(seed instanceof Uint8Array) || seed.length !== 32) {
    throw new Error("seed must be 32 bytes");
  }

  let counter = 0;
  let cursor = 32;
  let block: Uint8Array | null = null;
  return {
    next(): number {
      if (cursor >= 32) {
        const input = new Uint8Array(36);
        input.set(seed, 0);
        input[32] = (counter >>> 24) & 0xff;
        input[33] = (counter >>> 16) & 0xff;
        input[34] = (counter >>> 8) & 0xff;
        input[35] = counter & 0xff;
        block = sha256(input);
        counter += 1;
        cursor = 0;
      }
      const byte = block?.[cursor] ?? 0;
      cursor += 1;
      return byte;
    },
  };
}

export function colorSequence(problemSecret: Uint8Array): string {
  const stream = streamOf(problemSecret);
  let output = "";
  for (let index = 0; index < SEQUENCE_LEN; index += 1) {
    output += String(stream.next() & 0x03);
  }
  return output;
}

export interface ColorState {
  revealed: number;
  round: number;
  pressIndex: number;
  best: number;
  over: boolean;
}

export interface ColorPressResult {
  ok: boolean;
  wrong?: boolean;
  roundComplete?: boolean;
  reveal?: number;
  round?: number;
  best: number;
  over?: boolean;
}

export function newColorState(): ColorState {
  return { revealed: 1, round: 1, pressIndex: 0, best: 0, over: false };
}

export function pressColor(
  sequence: string,
  state: ColorState,
  color: number,
): ColorPressResult {
  if (state.over) return { ok: false, over: true, best: state.best };
  const expected = sequence.charCodeAt(state.pressIndex) - 48;
  if (color !== expected) {
    state.over = true;
    return { ok: false, wrong: true, over: true, best: state.best };
  }
  state.pressIndex += 1;

  if (state.pressIndex >= state.round) {
    state.best = state.round;
    const nextRound = state.round + 1;
    const result: ColorPressResult = { ok: true, roundComplete: true, best: state.best };
    if (nextRound <= sequence.length) {
      state.revealed = nextRound;
      result.reveal = sequence.charCodeAt(nextRound - 1) - 48;
      result.round = nextRound;
      state.round = nextRound;
      state.pressIndex = 0;
    } else {
      state.round = nextRound;
      state.pressIndex = 0;
      result.round = nextRound;
    }
    return result;
  }
  return { ok: true, roundComplete: false, best: state.best };
}

export function replayColor(
  problemSecret: Uint8Array,
  presses: number[],
): { best: number; over: boolean } {
  const sequence = colorSequence(problemSecret);
  const state = newColorState();
  for (const color of presses) {
    if (state.over) break;
    pressColor(sequence, state, color);
  }
  return { best: state.best, over: state.over };
}

export function colorAnswer(best: number, presses: number[]): string {
  return `color:${best}:${presses.join("")}`;
}
