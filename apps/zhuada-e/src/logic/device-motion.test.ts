import { describe, expect, it } from "vitest";
import { ShakeDetector } from "./device-motion";

const direct = (x: number, y = 0, z = 0) => ({ acceleration: { x, y, z } });

describe("ShakeDetector", () => {
  it("fires immediately for a deliberate strong impulse", () => {
    const detector = new ShakeDetector();
    const signal = detector.update(direct(21), 1000);
    expect(signal?.strength).toBe("strong");
    expect(signal?.intensity).toBeGreaterThanOrEqual(0.95);
    expect(signal?.intensity).toBeLessThanOrEqual(1.35);
  });

  it("requires two soft peaks with a reset between them", () => {
    const detector = new ShakeDetector();
    expect(detector.update(direct(12), 1000)).toBeNull();
    expect(detector.update(direct(1), 1080)).toBeNull();
    const signal = detector.update(direct(12), 1260);
    expect(signal?.strength).toBe("soft");
    expect(signal?.intensity).toBeGreaterThanOrEqual(0.65);
    expect(signal?.intensity).toBeLessThanOrEqual(1);
  });

  it("rejects walking-level motion, stale pairs and refractory duplicates", () => {
    const detector = new ShakeDetector();
    for (let i = 0; i < 20; i += 1) expect(detector.update(direct(5), i * 50)).toBeNull();
    detector.reset();
    expect(detector.update(direct(12), 1000)).toBeNull();
    expect(detector.update(direct(0), 1100)).toBeNull();
    expect(detector.update(direct(12), 1600)).toBeNull();
    expect(detector.update(direct(0), 1650)).toBeNull();
    expect(detector.update(direct(22), 1700)?.strength).toBe("strong");
    expect(detector.update(direct(0), 1750)).toBeNull();
    expect(detector.update(direct(25), 1800)).toBeNull();
  });

  it("subtracts a slowly changing gravity vector", () => {
    const detector = new ShakeDetector({ strongThreshold: 8 });
    expect(detector.update({ accelerationIncludingGravity: { x: 0, y: 0, z: 9.8 } }, 0)).toBeNull();
    expect(detector.update({ accelerationIncludingGravity: { x: 0.2, y: 0, z: 9.7 } }, 50)).toBeNull();
    expect(detector.update({ accelerationIncludingGravity: { x: 15, y: 0, z: 9.8 } }, 100)?.strength).toBe("strong");
  });

  it("maps harder motion to more intensity and caps the maximum", () => {
    const medium = new ShakeDetector().update(direct(21), 0);
    const hard = new ShakeDetector().update(direct(60), 0);
    expect(hard!.intensity).toBeGreaterThan(medium!.intensity);
    expect(hard!.intensity).toBe(1.35);
  });

  it("is monotonic across the soft/strong threshold", () => {
    const softDetector = new ShakeDetector();
    expect(softDetector.update(direct(18.99), 0)).toBeNull();
    expect(softDetector.update(direct(0), 40)).toBeNull();
    const soft = softDetector.update(direct(18.99), 120);
    const strong = new ShakeDetector().update(direct(19), 120);
    expect(soft?.intensity).toBeLessThanOrEqual(strong!.intensity);
    expect(strong!.intensity).toBe(1);
  });
});
