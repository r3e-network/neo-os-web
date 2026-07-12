import { describe, expect, it } from "vitest";

import type { Direction, Point } from "../../snake-bounty/src/logic/snake-engine";
import {
  DIRECTION_DEGREES,
  directionBetween,
  interpolationSource,
  snakeSegmentPose,
} from "../../snake-bounty/src/logic/snake-visuals";

describe("Snake Bounty segment artwork poses", () => {
  it("rotates the authored head resource toward every cardinal direction", () => {
    const body: Point[] = [{ x: 5, y: 5 }];
    const directions: Direction[] = [0, 1, 2, 3];

    expect(directions.map((direction) => snakeSegmentPose(body, 0, direction).angle)).toEqual([
      -90,
      0,
      90,
      180,
    ]);
    expect(DIRECTION_DEGREES).toEqual({ 0: -90, 1: 0, 2: 90, 3: 180 });
  });

  it("keeps straight bodies aligned and points the tail join toward its neighbour", () => {
    const horizontal: Point[] = [
      { x: 3, y: 2 },
      { x: 2, y: 2 },
      { x: 1, y: 2 },
    ];
    const vertical: Point[] = [
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 2, y: 3 },
    ];

    expect(snakeSegmentPose(horizontal, 1, 1)).toMatchObject({
      role: "body",
      angle: 0,
      turnAngles: null,
    });
    expect(snakeSegmentPose(horizontal, 2, 1)).toMatchObject({ role: "tail", angle: 180 });
    expect(snakeSegmentPose(vertical, 1, 0)).toMatchObject({
      role: "body",
      angle: 90,
      turnAngles: null,
    });
    expect(snakeSegmentPose(vertical, 2, 0)).toMatchObject({ role: "tail", angle: 90 });
  });

  it("describes corners as two body-art branches aimed at both neighbours", () => {
    const rightToDown: Point[] = [
      { x: 3, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 3 },
    ];
    const upToRight: Point[] = [
      { x: 2, y: 1 },
      { x: 2, y: 2 },
      { x: 3, y: 2 },
    ];

    expect(snakeSegmentPose(rightToDown, 1, 1)).toMatchObject({
      role: "body",
      turnAngles: [0, 90],
    });
    expect(snakeSegmentPose(upToRight, 1, 0)).toMatchObject({
      role: "body",
      turnAngles: [-90, 0],
    });
    expect(directionBetween({ x: 2, y: 2 }, { x: 3, y: 2 })).toBe(1);
  });

  it("maps every segment to its previous cell and grows a new tail from the old tail", () => {
    const previous: Point[] = [
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ];

    expect(interpolationSource(previous, 0)).toEqual({ x: 10, y: 10 });
    expect(interpolationSource(previous, 1)).toEqual({ x: 9, y: 10 });
    expect(interpolationSource(previous, 3)).toEqual({ x: 8, y: 10 });
    expect(interpolationSource([], 0)).toBeNull();
  });
});
