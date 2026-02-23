import { getMiniApp } from "../../lib/miniapp-registry";

describe("getMiniApp", () => {
  it("returns canonical miniapp id", () => {
    const app = getMiniApp("miniapp-coinflip");
    expect(app).toBeDefined();
    expect(app?.app_id).toBe("miniapp-coinflip");
    expect(app?.entry_url).toBe("mf://manifest?app=miniapp-coinflip");
  });

  it("returns undefined for unknown app ids", () => {
    expect(getMiniApp("coinflip-v0")).toBeUndefined();
    expect(getMiniApp("does-not-exist")).toBeUndefined();
  });
});
