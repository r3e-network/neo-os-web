import { describe, expect, it } from "vitest";
import { shakeDynamics } from "./shake-dynamics";

describe("shakeDynamics", () => {
  it("moves more objects and applies more toss as the phone motion grows", () => {
    const soft = shakeDynamics(0.65);
    const medium = shakeDynamics(1);
    const hard = shakeDynamics(1.35);
    expect(soft.affectedRatio).toBeCloseTo(0.48);
    expect(medium.affectedRatio).toBeGreaterThan(soft.affectedRatio);
    expect(hard.affectedRatio).toBe(1);
    expect(hard.verticalImpulseMin).toBeGreaterThan(medium.verticalImpulseMin);
    expect(medium.verticalImpulseMin).toBeGreaterThan(soft.verticalImpulseMin);
    expect(hard.angularVelocity).toBeGreaterThan(soft.angularVelocity);
  });

  it("hard caps extreme sensor values so items stay in the basket", () => {
    expect(shakeDynamics(999)).toEqual(shakeDynamics(1.35));
    expect(shakeDynamics(-999)).toEqual(shakeDynamics(0.65));
    const hard = shakeDynamics(1.35);
    expect(hard.verticalImpulseMax).toBeLessThanOrEqual(4.75);
    expect(hard.maxVerticalVelocity).toBe(5.35);
    expect(hard.maxHorizontalVelocity).toBe(3.8);
  });
});
