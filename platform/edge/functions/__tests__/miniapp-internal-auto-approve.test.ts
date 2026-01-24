import { describe, it, expect } from "vitest";
import { isAutoApprovedInternalRepo } from "../miniapp-submit/internal-approval";

describe("internal auto approve", () => {
  it("auto-approves r3e-network/miniapps", () => {
    expect(isAutoApprovedInternalRepo("https://github.com/r3e-network/miniapps")).toBe(true);
  });

  it("does not auto-approve other repos", () => {
    expect(isAutoApprovedInternalRepo("https://github.com/unknown/repo")).toBe(false);
  });
});
