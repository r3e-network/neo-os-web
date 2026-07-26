import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  GRID_COLS,
  GRID_ROWS,
  MAX_STRIKES,
  ROUND_DURATION_MS,
  applyArrowMove,
  blockersForArrow,
  buildDependencyGraph,
  createRun,
  generateLevel,
  graphHasCycle,
  pauseRun,
  remainingFor,
  restoreRun,
  resumeRun,
  verifyWitness,
} from "../../arrow-escape/src/logic/arrow-engine";

function appFile(file: string): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return readFileSync(path.join(appsRoot, "arrow-escape", file), "utf8");
}

describe("arrow-escape deterministic DAG generator", () => {
  it("proves 2,000 published seeds are dense, acyclic, and directly solvable", () => {
    let minimumCoverage = 1;
    let minimumArrows = Number.POSITIVE_INFINITY;
    let maximumArrows = 0;

    for (let index = 0; index < 2_000; index += 1) {
      const seed = `arrow-audit-${index.toString(36).padStart(4, "0")}`;
      const level = generateLevel(seed);
      minimumCoverage = Math.min(minimumCoverage, level.coverage);
      minimumArrows = Math.min(minimumArrows, level.arrows.length);
      maximumArrows = Math.max(maximumArrows, level.arrows.length);

      expect(level.arrows.length).toBeGreaterThanOrEqual(33);
      expect(level.arrows.length).toBeLessThanOrEqual(44);
      expect(level.coverage).toBeGreaterThanOrEqual(0.98148);
      expect(graphHasCycle(buildDependencyGraph(level.arrows, level.grid))).toBe(false);
      expect(verifyWitness(level)).toBe(true);

      const occupied = new Set(level.arrows.flatMap((arrow) => arrow.segments.map((point) => `${point.x},${point.y}`)));
      expect(occupied.size).toBe(GRID_COLS * GRID_ROWS);
      expect(level.witness).toHaveLength(level.arrows.length);
      if (index < 16) {
        expect(generateLevel(seed).checksum).toBe(level.checksum);
      }
    }

    expect(minimumCoverage).toBeGreaterThanOrEqual(0.98148);
    expect(minimumArrows).toBeGreaterThanOrEqual(33);
    expect(maximumArrows).toBeLessThanOrEqual(44);
  }, 60_000);

  it("replays every solution witness into a win without consuming a shield", () => {
    const level = generateLevel("witness-win");
    let run = createRun(level.seed, 10_000);
    for (const arrowId of level.witness) {
      const result = applyArrowMove(level, run, arrowId, 10_000);
      run = result.run;
    }
    expect(run.status).toBe("won");
    expect(run.removed).toEqual(level.witness);
    expect(run.strikes).toBe(0);
    expect(run.score).toBeGreaterThan(0);
  });

  it("bumps blocked arrows, consumes exactly three shields, and then fails closed", () => {
    const level = generateLevel("blocked-run");
    const removed = new Set<number>();
    const blocked = level.arrows.find((arrow) => blockersForArrow(level, removed, arrow.id).length > 0);
    expect(blocked).toBeTruthy();

    let run = createRun(level.seed, 5_000);
    for (let strike = 1; strike <= MAX_STRIKES; strike += 1) {
      const result = applyArrowMove(level, run, blocked!.id, 5_000);
      run = result.run;
      expect(run.strikes).toBe(strike);
      expect(result.blockers.length).toBeGreaterThan(0);
    }
    expect(run.status).toBe("lost");
  });

  it("restores only legal history and pauses a crashed foreground run without wall-clock drift", () => {
    const level = generateLevel("restore-proof");
    const validArrow = level.witness[0]!;
    const valid = applyArrowMove(level, createRun(level.seed, 1_000), validArrow, 1_000).run;
    expect(restoreRun(valid, 1_500)?.removed).toEqual([validArrow]);

    const blocked = level.arrows.find((arrow) => blockersForArrow(level, new Set(), arrow.id).length > 0)!;
    expect(restoreRun({ ...valid, removed: [blocked.id] }, 1_500)).toBeNull();
    expect(restoreRun({ ...valid, removed: [validArrow, validArrow] }, 1_500)).toBeNull();

    const abandoned = { ...createRun(level.seed, 2_000), elapsedMs: 12_000 };
    const recovered = restoreRun(abandoned, 2_000 + ROUND_DURATION_MS + 1);
    expect(recovered?.status).toBe("paused");
    expect(recovered?.elapsedMs).toBe(12_000);
    expect(remainingFor(recovered!, 999_000)).toBe(ROUND_DURATION_MS - 12_000);

    const resumed = resumeRun(recovered!, 999_000);
    expect(remainingFor(resumed, 1_004_000)).toBe(ROUND_DURATION_MS - 17_000);
  });

  it("pauses the authoritative clock and resumes from the settled elapsed time", () => {
    const run = createRun("pause-proof", 1_000);
    const paused = pauseRun(run, 11_000);
    expect(paused.status).toBe("paused");
    expect(paused.elapsedMs).toBe(10_000);
    expect(remainingFor(paused, 50_000)).toBe(ROUND_DURATION_MS - 10_000);

    const resumed = resumeRun(paused, 50_000);
    expect(resumed.status).toBe("playing");
    expect(remainingFor(resumed, 55_000)).toBe(ROUND_DURATION_MS - 15_000);
  });
});

describe("arrow-escape production boundary", () => {
  it("ships real generated art and never exposes a wallet or reward operation", () => {
    const manifest = JSON.parse(appFile("neo-manifest.json")) as {
      operation_panel: { operations: unknown[] };
      platform: { transactions: boolean };
      technologies: Record<string, { enabled: boolean }>;
    };
    const main = appFile("src/main.tsx");
    const scene = appFile("src/scenes/ArrowEscapeScene.ts");

    expect(manifest.operation_panel.operations).toEqual([]);
    expect(manifest.platform.transactions).toBe(false);
    expect((manifest as { contracts?: Record<string, string> }).contracts).toEqual({});
    expect(Object.values(manifest.technologies).every((technology) => technology.enabled === false)).toBe(true);
    expect(main).not.toContain("app.chain");
    expect(main).not.toContain("app.oracle");
    expect(main).not.toContain("app.game.reward");
    expect(main).toContain('document.addEventListener("visibilitychange"');
    expect(main).toContain('document.removeEventListener("visibilitychange"');
    expect(scene).toContain("garden-board.webp");
    expect(scene).toContain("jade-shaft.png");
    expect(scene).toContain("coral-head.png");
    expect(scene).toContain("run.removed.length < this.currentRun.removed.length");
    expect(scene).not.toContain("this.add.graphics");
    for (const emoji of ["❤️", "💔", "🎉"]) {
      expect(scene).not.toContain(emoji);
    }
  });
});
