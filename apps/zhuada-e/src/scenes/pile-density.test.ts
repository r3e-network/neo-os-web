import { describe, expect, it } from "vitest";

import { STREAM_INITIAL_VISIBLE } from "../logic/item-stream";
import { pileDimensions } from "./pile-density";

describe("layered pile density", () => {
  it("keeps L2 challenge bodies tightly packed enough to create real overlap", () => {
    const tutorial = pileDimensions(9);
    const challenge = pileDimensions(10);
    const tutorialAreaPerBody = (tutorial.half * 2) ** 2 / 18;
    const challengeAreaPerBody = (challenge.half * 2) ** 2 / STREAM_INITIAL_VISIBLE;

    expect(tutorial.half).toBe(2.75);
    expect(challenge.half).toBeCloseTo(2.83);
    expect(tutorialAreaPerBody).toBeGreaterThan(1.6);
    expect(challengeAreaPerBody).toBeLessThan(0.6);
  });

  it("caps late-level floor growth instead of spreading the live budget into a sparse sheet", () => {
    expect(pileDimensions(12).half).toBeLessThanOrEqual(3);
    expect(pileDimensions(99)).toEqual(pileDimensions(12));
    expect(pileDimensions(-99)).toEqual(pileDimensions(9));
  });
});
