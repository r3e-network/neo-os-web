import { describe, expect, it } from "vitest";
import { computeHintPlan } from "./hint-plan";

const box = (...kinds: number[]): { kind: number }[] => kinds.map((kind) => ({ kind }));

describe("computeHintPlan (R5 smart hint)", () => {
  it("completes a triple now when 2 sit in tray/shelf and 1 is in the box", () => {
    const plan = computeHintPlan([1, 1, null], [null], box(1, 2, 2, 3));
    expect(plan).toEqual({ kind: 1, needFromBox: 1 });
  });

  it("counts a kind with 1 in tray and 2 reachable in the box as need 2", () => {
    const plan = computeHintPlan([5, null, null], [], box(5, 5, 7, 7, 7));
    expect(plan).toEqual({ kind: 5, needFromBox: 2 });
  });

  it("falls back to the most common box kind needing all 3 when tray is empty", () => {
    const plan = computeHintPlan([null, null, null], [], box(9, 9, 9, 4, 4, 2));
    expect(plan).toEqual({ kind: 9, needFromBox: 3 });
  });

  it("surfaces a kind on the side shelf, not just the tray", () => {
    const plan = computeHintPlan([], [3, 3], box(3, 1, 1));
    expect(plan).toEqual({ kind: 3, needFromBox: 1 });
  });

  it("returns kind -1 when nothing is left to hint", () => {
    const plan = computeHintPlan([], [], []);
    expect(plan.kind).toBe(-1);
  });

  it("prefers an immediate completion over a build-up", () => {
    // kind 1 is one pick from done (2 in tray, 1 in box); kind 2 still needs 2.
    const plan = computeHintPlan([1, 1, 2], [], box(1, 2, 2, 2));
    expect(plan).toEqual({ kind: 1, needFromBox: 1 });
  });
});
