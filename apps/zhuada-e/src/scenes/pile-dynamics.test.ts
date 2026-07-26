import { Body, Box, Plane, Vec3, World } from "cannon-es";
import { describe, expect, it } from "vitest";
import { physicsProfileOf } from "./physics-profiles";
import {
  initialPileEuler,
  prefersFaceRest,
  prefersSideRest,
  resettlePileAfterSupportRemoval,
  settleReadableFace,
  settleReadableUpright,
  tipUprightSideRestBody,
} from "./pile-dynamics";

describe("live pile support dynamics", () => {
  it("wakes a sleeping upper body when its support is removed", () => {
    const world = new World({ gravity: new Vec3(0, -10, 0) });
    const floor = new Body({ mass: 0, shape: new Plane() });
    floor.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    world.addBody(floor);

    const support = new Body({ mass: 0, shape: new Box(new Vec3(0.6, 0.5, 0.6)) });
    support.position.set(0, 0.5, 0);
    world.addBody(support);

    const upper = new Body({ mass: 1, shape: new Box(new Vec3(0.35, 0.35, 0.35)) });
    upper.position.set(0, 1.35, 0);
    world.addBody(upper);
    upper.sleep();
    expect(upper.sleepState).toBe(Body.SLEEPING);

    world.removeBody(support);
    const beforeY = upper.position.y;
    const result = resettlePileAfterSupportRemoval([
      { body: upper, profile: physicsProfileOf("fresh-market", 0), seed: 7 },
    ], support);

    expect(result.woken).toBe(1);
    expect(upper.sleepState).toBe(Body.AWAKE);
    for (let frame = 0; frame < 20; frame += 1) world.step(1 / 60);
    expect(upper.position.y).toBeLessThan(beforeY - 0.2);
  });

  it("keeps distant settled clusters asleep when an unrelated support is removed", () => {
    const world = new World({ gravity: new Vec3(0, -10, 0) });
    const support = new Body({ mass: 1, shape: new Box(new Vec3(0.5, 0.5, 0.5)) });
    support.position.set(0, 0.5, 0);
    const nearby = new Body({ mass: 1, shape: new Box(new Vec3(0.35, 0.35, 0.35)) });
    nearby.position.set(0.2, 1.35, 0.1);
    const distant = new Body({ mass: 1, shape: new Box(new Vec3(0.35, 0.35, 0.35)) });
    distant.position.set(4.5, 1.35, 4.5);
    world.addBody(support);
    world.addBody(nearby);
    world.addBody(distant);
    nearby.sleep();
    distant.sleep();
    world.removeBody(support);

    const profile = physicsProfileOf("fresh-market", 0);
    const result = resettlePileAfterSupportRemoval([
      { body: nearby, profile, seed: 3 },
      { body: distant, profile, seed: 4 },
    ], support);

    expect(result.woken).toBe(1);
    expect(nearby.sleepState).toBe(Body.AWAKE);
    expect(distant.sleepState).toBe(Body.SLEEPING);
  });

  it("starts elongated colliders side-on and tips only implausibly upright ones", () => {
    const tall = physicsProfileOf("night-market", 2);
    const round = physicsProfileOf("fresh-market", 0);
    expect(prefersSideRest(tall)).toBe(true);
    expect(prefersSideRest(round)).toBe(false);

    const [x, y, z] = initialPileEuler(tall, 0.25, 0.6, 0.8);
    expect(Math.abs(x - Math.PI / 2)).toBeLessThan(0.22);
    expect(y).toBeCloseTo(0.6 * Math.PI * 2);
    expect(Math.abs(z)).toBeLessThan(0.13);

    const world = new World({ gravity: new Vec3(0, -10, 0) });
    const removed = new Body({ mass: 1 });
    const upright = new Body({ mass: 1, shape: new Box(new Vec3(0.3, 0.7, 0.3)) });
    world.addBody(upright);
    upright.sleep();
    const result = resettlePileAfterSupportRemoval([
      { body: upright, profile: tall, seed: 11 },
    ], removed);

    expect(result.tipped).toBe(1);
    expect(Math.hypot(upright.angularVelocity.x, upright.angularVelocity.z)).toBeGreaterThan(0.4);

    upright.angularVelocity.set(0, 0, 0);
    upright.sleep();
    expect(tipUprightSideRestBody(upright, tall, 13)).toBe(true);
    expect(upright.sleepState).toBe(Body.AWAKE);
    expect(Math.hypot(upright.angularVelocity.x, upright.angularVelocity.z)).toBeGreaterThan(0.4);
  });

  it("starts thin authored faces upward and physically corrects an edge-on rest", () => {
    const wedge = physicsProfileOf("fresh-market", 15);
    const round = physicsProfileOf("fresh-market", 0);
    expect(prefersFaceRest(wedge)).toBe(true);
    expect(prefersFaceRest(round)).toBe(false);

    const [x, y, z] = initialPileEuler(wedge, 0.1, 0.4, 0.9);
    expect(Math.abs(x)).toBeLessThan(0.13);
    expect(y).toBeCloseTo(0.4 * Math.PI * 2);
    expect(Math.abs(z)).toBeLessThan(0.13);

    const world = new World({ gravity: new Vec3(0, -10, 0) });
    const edgeOn = new Body({ mass: 1, shape: new Box(new Vec3(0.6, 0.2, 0.45)) });
    world.addBody(edgeOn);
    edgeOn.quaternion.setFromEuler(Math.PI / 2, 0, 0);
    edgeOn.sleep();
    expect(settleReadableFace(edgeOn, wedge)).toBe(true);
    expect(edgeOn.sleepState).toBe(Body.AWAKE);
    expect(Math.hypot(edgeOn.angularVelocity.x, edgeOn.angularVelocity.z)).toBeGreaterThan(0.3);
  });

  it("keeps open cookware physically biased toward its authored top face", () => {
    const kettle = physicsProfileOf("farm-kitchen", 0);
    expect(kettle.readableRest).toBe("upright");

    const [x, y, z] = initialPileEuler(kettle, 0.1, 0.4, 0.9);
    expect(Math.abs(x)).toBeLessThan(0.15);
    expect(y).toBeCloseTo(0.4 * Math.PI * 2);
    expect(Math.abs(z)).toBeLessThan(0.15);

    const world = new World({ gravity: new Vec3(0, -10, 0) });
    const upsideDown = new Body({ mass: 1, shape: new Box(new Vec3(0.6, 0.4, 0.6)) });
    world.addBody(upsideDown);
    upsideDown.quaternion.setFromEuler(Math.PI, 0, 0);
    upsideDown.sleep();

    expect(settleReadableUpright(upsideDown, kettle)).toBe(true);
    expect(upsideDown.sleepState).toBe(Body.AWAKE);
    expect(Math.hypot(upsideDown.angularVelocity.x, upsideDown.angularVelocity.z)).toBeGreaterThan(0.29);
  });
});
