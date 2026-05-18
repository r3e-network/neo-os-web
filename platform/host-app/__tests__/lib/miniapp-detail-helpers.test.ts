import { resolveMiniAppDetailRouteId } from "@/lib/miniapp-detail-helpers";

describe("miniapp detail route helpers", () => {
  it("maps the public MiniApp Factory slug to the manifest app id", () => {
    expect(resolveMiniAppDetailRouteId("miniapp-factory")).toBe(
      "miniapp-miniapp-factory",
    );
  });

  it("keeps OneGate Vault compatibility routes on the canonical gas lucky pool app", () => {
    expect(resolveMiniAppDetailRouteId("onegate-vault")).toBe(
      "miniapp-gas-lucky-pool",
    );
    expect(resolveMiniAppDetailRouteId("miniapp-onegate-vault")).toBe(
      "miniapp-gas-lucky-pool",
    );
  });
});
