import { describe, expect, it } from "vitest";
import type { ExtractReceipt } from "./engine-zhuada";
import {
  advanceTrayMotion,
  createTrayMotionState,
  settleNonMatchEntry,
  startTrayMotion,
  trayFromTokens,
  trayMotionPhaseDuration,
  TRAY_ENTRY_MOTION_MS,
  TRAY_MATCH_MOTION_MS,
  TRAY_MOTION_TIMINGS,
} from "./tray-motion";

const empty = (): (number | null)[] => Array<number | null>(7).fill(null);

function receipt(overrides: Partial<ExtractReceipt> = {}): ExtractReceipt {
  return {
    nonce: 1,
    itemId: 99,
    kind: 4,
    accepted: true,
    placedIndex: 2,
    matched: false,
    landingTray: [1, 4, 4, 7, null, null, null],
    settledTray: [1, 4, 4, 7, null, null, null],
    clearedTray: [],
    ...overrides,
  };
}

describe("tray motion choreography", () => {
  it("keeps token identity while grouping the incoming item and shifting the right side", () => {
    const initial = createTrayMotionState([1, 4, 7, null, null, null, null]);
    const previousSeven = initial.tokens.find((token) => token.kind === 7)!;
    const started = startTrayMotion(initial, receipt());

    expect(started.phase).toBe("approach");
    expect(trayFromTokens(started.tokens)).toEqual([1, 4, 4, 7, null, null, null]);
    expect(started.tokens.find((token) => token.id === previousSeven.id)?.index).toBe(3);
    expect(started.tokens.find((token) => token.incoming)?.index).toBe(2);
  });

  it("runs group → highlight → clear → compact before settling", () => {
    const initial = createTrayMotionState([9, 2, 2, 4, null, null, null]);
    let state = startTrayMotion(initial, receipt({
      kind: 2,
      placedIndex: 3,
      matched: true,
      landingTray: [9, 2, 2, 2, 4, null, null],
      settledTray: [9, 4, null, null, null, null, null],
      clearedTray: [1, 2, 3],
    }));

    expect(state.phase).toBe("approach");
    state = advanceTrayMotion(state);
    expect(state.phase).toBe("grouping");
    state = advanceTrayMotion(state);
    expect(state.phase).toBe("highlight");
    expect(state.tokens.filter((token) => token.matched)).toHaveLength(3);
    state = advanceTrayMotion(state);
    expect(state.phase).toBe("clearing");
    state = advanceTrayMotion(state);
    expect(state.phase).toBe("compacting");
    expect(trayFromTokens(state.tokens)).toEqual([9, 4, null, null, null, null, null]);
    state = advanceTrayMotion(state);
    expect(state.phase).toBe("idle");
    expect(state.tokens.every((token) => !token.matched && !token.incoming)).toBe(true);
  });

  it("publishes deliberate timings instead of an instant clear", () => {
    expect(TRAY_MOTION_TIMINGS.approachMs).toBe(130);
    expect(TRAY_MOTION_TIMINGS.groupingMs).toBe(620);
    expect(TRAY_MOTION_TIMINGS.highlightMs).toBe(240);
    expect(TRAY_MOTION_TIMINGS.clearMs).toBe(420);
    expect(TRAY_MOTION_TIMINGS.compactMs).toBe(460);
    expect(TRAY_ENTRY_MOTION_MS).toBe(750);
    expect(TRAY_MATCH_MOTION_MS).toBe(1870);
    expect(trayMotionPhaseDuration("idle")).toBeNull();
  });

  it("ignores rejected and duplicate receipts", () => {
    const state = createTrayMotionState(empty());
    const rejected = startTrayMotion(state, receipt({ accepted: false }));
    expect(rejected).toBe(state);
    const started = startTrayMotion(state, receipt());
    expect(startTrayMotion(started, receipt())).toBe(started);
  });

  it("settles only an ordinary entry beat so a newer rapid pick can take over", () => {
    const first = startTrayMotion(
      createTrayMotionState([1, null, null, null, null, null, null]),
      receipt({
        nonce: 1,
        itemId: 10,
        kind: 2,
        placedIndex: 1,
        landingTray: [1, 2, null, null, null, null, null],
        settledTray: [1, 2, null, null, null, null, null],
      }),
    );
    const settled = settleNonMatchEntry(first);

    expect(settled.phase).toBe("idle");
    expect(trayFromTokens(settled.tokens)).toEqual([1, 2, null, null, null, null, null]);
    expect(settled.tokens.every((token) => !token.incoming)).toBe(true);

    const match = startTrayMotion(createTrayMotionState([2, 2, null, null, null, null, null]), receipt({
      matched: true,
      kind: 2,
      placedIndex: 2,
      landingTray: [2, 2, 2, null, null, null, null],
      settledTray: empty(),
      clearedTray: [0, 1, 2],
    }));
    expect(settleNonMatchEntry(match)).toBe(match);
  });
});
