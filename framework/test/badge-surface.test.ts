import { describe, expect, it, vi } from "vitest";
import { createBadgeSurface } from "../badge-surface";

describe("app.badge", () => {
  it("routes the complete badge lifecycle through the injected OS service", async () => {
    const badge = {
      define: vi.fn(async () => {}),
      award: vi.fn(async () => {}),
      revoke: vi.fn(async () => {}),
      list: vi.fn(async () => [{ id: "issuer" }]),
      updateStat: vi.fn(async () => {}),
      getStat: vi.fn(async () => "7"),
    };
    const surface = createBadgeSurface({ osBadge: () => badge });

    expect(surface.available).toBe(true);
    await expect(surface.define("issuer", "Issuer", "Issue once")).resolves.toBe(true);
    await expect(surface.award("issuer", "Nabc")).resolves.toBe(true);
    await expect(surface.revoke("issuer", "Nabc")).resolves.toBe(true);
    await expect(surface.list("Nabc")).resolves.toEqual([{ id: "issuer" }]);
    await expect(surface.updateStat("Nabc", "issued", "7")).resolves.toBe(true);
    await expect(surface.getStat("Nabc", "issued")).resolves.toBe("7");

    expect(badge.define).toHaveBeenCalledWith("issuer", "Issuer", "Issue once");
    expect(badge.award).toHaveBeenCalledWith("issuer", "Nabc");
    expect(badge.revoke).toHaveBeenCalledWith("issuer", "Nabc");
  });

  it("fails closed to explicit capability results without an OS host", async () => {
    const surface = createBadgeSurface({ osBadge: () => undefined });

    expect(surface.available).toBe(false);
    await expect(surface.define("issuer", "Issuer", "Issue once")).resolves.toBe(false);
    await expect(surface.award("issuer", "Nabc")).resolves.toBe(false);
    await expect(surface.revoke("issuer", "Nabc")).resolves.toBe(false);
    await expect(surface.list("Nabc")).resolves.toEqual([]);
    await expect(surface.updateStat("Nabc", "issued", "7")).resolves.toBe(false);
    await expect(surface.getStat("Nabc", "issued")).resolves.toBeNull();
  });
});
