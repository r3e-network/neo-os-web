import { describe, expect, it } from "vitest";
import {
  BOX_CAPACITY,
  BOX_COUNT,
  BUFFER_CAPACITY,
  MAX_UNDOS,
  allScrews,
  applyScrewMove,
  computeStars,
  createSession,
  currentBoxColor,
  generateLevel,
  isScrewUnlocked,
  restartSession,
  togglePause,
  undoMove,
  verifyConstructiveSolution,
} from "../src/logic/screw-engine";

describe("screw-sort constructive generator", () => {
  it("is deterministic and creates a four-box, three-phase puzzle", () => {
    const first = generateLevel("fixture-42");
    const second = generateLevel("fixture-42");

    expect(second).toEqual(first);
    expect(first.boxQueues).toHaveLength(BOX_COUNT);
    expect(first.boxQueues.every((queue) => queue.length === 3)).toBe(true);
    expect(first.boards).toHaveLength(12);
    expect(allScrews(first)).toHaveLength(36);
    expect(first.phaseColors.every((phase) => new Set(phase).size === BOX_COUNT)).toBe(true);
    for (const queue of first.boxQueues) {
      expect(queue[0]).not.toBe(queue[1]);
      expect(queue[1]).not.toBe(queue[2]);
    }
  });

  it("constructively proves a large seed sample is solvable", () => {
    for (let seed = 0; seed < 2_000; seed += 1) {
      const level = generateLevel(`sample-${seed}`);
      expect(verifyConstructiveSolution(level), `seed sample-${seed}`).toBe(true);
    }
  }, 15_000);

  it("keeps lower-phase screws locked until their physical blocker clears", () => {
    let session = createSession("occlusion");
    const lower = allScrews(session.level).find((screw) =>
      screw.blockedBy.some((boardId) => boardId.startsWith("p0")),
    );
    expect(lower).toBeTruthy();
    expect(isScrewUnlocked(session.level, session.core, lower!)).toBe(false);

    const blocker = session.level.boards.find((board) => board.id === lower!.blockedBy[0]);
    expect(blocker).toBeTruthy();
    for (const screw of blocker!.screws) {
      const result = applyScrewMove(session, screw.id);
      expect(result.ok).toBe(true);
      session = result.session;
    }
    expect(isScrewUnlocked(session.level, session.core, lower!)).toBe(true);
  });

  it("advances its authoritative revision only after an accepted move", () => {
    const session = createSession("revision-contract");
    const blocked = allScrews(session.level).find((screw) => screw.blockedBy.length > 0)!;
    const rejected = applyScrewMove(session, blocked.id);
    expect(rejected.ok).toBe(false);
    expect(rejected.session).toBe(session);
    expect(rejected.session.core.revision).toBe(0);

    const exposed = session.level.solutionOrder[0]!;
    const accepted = applyScrewMove(session, exposed);
    expect(accepted.ok).toBe(true);
    expect(accepted.session.core.revision).toBe(1);
    expect(accepted.session.core.lastEvent).toMatchObject({ kind: "move", screwId: exposed });
  });
});

describe("screw-sort rules and recovery", () => {
  it("fills matching boxes to exactly three before advancing that lane", () => {
    let session = createSession("boxes");
    const lane = 0;
    const initial = currentBoxColor(session.level, session.core.boxes[lane]!);
    const matching = allScrews(session.level).filter(
      (screw) => screw.color === initial && screw.blockedBy.length === 0,
    );
    expect(matching).toHaveLength(BOX_CAPACITY);

    for (const screw of matching) {
      const result = applyScrewMove(session, screw.id);
      expect(result.ok).toBe(true);
      session = result.session;
    }
    expect(session.core.boxes[lane]!.queueIndex).toBe(1);
    expect(session.core.boxes[lane]!.count).toBe(0);
  });

  it("absorbs five unmatched screws and overflows softly on the sixth", () => {
    let session = createSession("buffer-limit");
    const core = {
      ...session.core,
      boxes: session.core.boxes.map((box) => ({ ...box, queueIndex: 3, count: 0 })),
    };
    session = { ...session, core };
    const available = allScrews(session.level).filter((screw) => screw.blockedBy.length === 0);

    for (const screw of available.slice(0, BUFFER_CAPACITY)) {
      const result = applyScrewMove(session, screw.id);
      expect(result.ok).toBe(true);
      session = result.session;
      expect(session.core.status).toBe("playing");
    }
    expect(session.core.buffer).toHaveLength(BUFFER_CAPACITY);

    const sixthScrew = available[BUFFER_CAPACITY]!;
    const sixth = applyScrewMove(session, sixthScrew.id);
    expect(sixth.ok).toBe(true);
    // Soft-fail: the sixth unmatched screw no longer ends the run — it lands in
    // the (now overflowing) tray and only erodes the efficiency star rating.
    expect(sixth.session.core.status).toBe("playing");
    expect(sixth.session.core.buffer).toHaveLength(BUFFER_CAPACITY + 1);
    expect(sixth.session.core.overflows).toBe(1);
    expect(sixth.session.core.removedScrewIds).toContain(sixthScrew.id);
  });

  it("flushes buffered screws when their color box rotates into view", () => {
    let session = createSession("buffer-flush");
    const lane = 0;
    const futureColor = session.level.boxQueues[lane]![1]!;
    const future = allScrews(session.level).find((screw) => screw.color === futureColor);
    expect(future).toBeTruthy();
    session = {
      ...session,
      core: {
        ...session.core,
        removedScrewIds: [future!.id],
        buffer: [{ screwId: future!.id, color: futureColor, lane: future!.lane }],
      },
    };

    const initialColor = session.level.boxQueues[lane]![0]!;
    const matching = allScrews(session.level).filter(
      (screw) => screw.color === initialColor && screw.blockedBy.length === 0,
    );
    for (const screw of matching) {
      session = applyScrewMove(session, screw.id).session;
    }

    expect(session.core.buffer).toHaveLength(0);
    expect(session.core.boxes[lane]!.queueIndex).toBe(1);
    expect(session.core.boxes[lane]!.count).toBe(1);
  });

  it("supports pause, bounded undo, and deterministic restart recovery", () => {
    let session = createSession("recovery", 123);
    const first = session.level.solutionOrder[0]!;
    session = togglePause(session);
    expect(applyScrewMove(session, first).reason).toBe("paused");
    session = togglePause(session);
    session = applyScrewMove(session, first).session;
    expect(session.core.removedScrewIds).toContain(first);

    session = undoMove(session);
    expect(session.core.removedScrewIds).not.toContain(first);
    expect(session.core.undosUsed).toBe(1);

    for (let count = 1; count < MAX_UNDOS; count += 1) {
      session = applyScrewMove(session, first).session;
      session = undoMove(session);
    }
    expect(session.core.undosUsed).toBe(MAX_UNDOS);

    const restarted = restartSession(session);
    expect(restarted.level).toEqual(generateLevel("recovery"));
    expect(restarted.core.removedScrewIds).toEqual([]);
    expect(restarted.history).toEqual([]);
  });

  describe("computeStars (soft-fail efficiency)", () => {
    const base = () => ({ ...createSession("stars-seed").core });

    it("awards 3 stars for a flawless clear", () => {
      const core = base();
      expect(computeStars(core)).toBe(3);
    });

    it("awards 2 stars for a few demerits", () => {
      const core = base();
      core.undosUsed = 1;
      core.overflows = 1; // demerits = 2 <= STAR_DEMERIT_TWO (3)
      expect(computeStars(core)).toBe(2);
    });

    it("awards 1 star when demerits exceed the 2-star threshold", () => {
      const core = base();
      core.overflows = 5; // demerits = 5 > 3
      expect(computeStars(core)).toBe(1);
    });

    it("never returns below 1 star", () => {
      const core = base();
      core.undosUsed = MAX_UNDOS;
      core.overflows = 20;
      expect(computeStars(core)).toBe(1);
    });
  });
});
