import { describe, expect, it } from "vitest";
import {
  PICK_DUPLICATE_GUARD_MS,
  canStartDifferentPick,
  duplicatePickGuardUntil,
} from "./pick-lock";

describe("3D scene pick lock choreography", () => {
  it("keeps only a tiny same-item duplicate guard instead of a tray-animation global lock", () => {
    expect(PICK_DUPLICATE_GUARD_MS).toBeLessThan(120);
    expect(duplicatePickGuardUntil(1_000)).toBe(1_000 + PICK_DUPLICATE_GUARD_MS);
  });

  it("allows rapid different-item picks while the tray choreography queues receipts", () => {
    const guardUntil = duplicatePickGuardUntil(2_000);
    expect(canStartDifferentPick(guardUntil, 2_016)).toBe(true);
    expect(canStartDifferentPick(guardUntil, 2_080)).toBe(true);
  });

  it("does not couple matched clears to scene input blocking", () => {
    const now = 3_000;
    expect(duplicatePickGuardUntil(now) - now).toBe(PICK_DUPLICATE_GUARD_MS);
  });
});
