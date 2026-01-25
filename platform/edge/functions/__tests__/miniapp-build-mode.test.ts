import { describe, it, expect } from "vitest";
import { canTriggerBuild } from "../_shared/miniapps/build-mode";

describe("build mode", () => {
  it("blocks manual submissions", () => {
    expect(canTriggerBuild("manual")).toBe(false);
  });

  it("allows platform submissions", () => {
    expect(canTriggerBuild("platform")).toBe(true);
  });
});
