import { getMiniApp } from "../../lib/miniapp-registry";

describe("getMiniApp", () => {
  it("returns canonical miniapp id", () => {
    const app = getMiniApp("miniapp-fogplay");
    expect(app).toBeDefined();
    expect(app?.app_id).toBe("miniapp-fogplay");
    expect(app?.entry_url).toBe("mf://manifest?app=miniapp-fogplay");
  });

  it("returns undefined for unknown app ids", () => {
    expect(getMiniApp("coinflip-v0")).toBeUndefined();
    expect(getMiniApp("does-not-exist")).toBeUndefined();
  });
});
