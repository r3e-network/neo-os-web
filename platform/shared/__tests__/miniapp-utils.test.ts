import { normalizeCategory, normalizePermissions, filterByCategory, searchApps } from "../types/miniapp-utils";
import type { MiniAppInfo } from "../types/miniapp";

describe("normalizeCategory", () => {
  it("returns valid category unchanged", () => {
    expect(normalizeCategory("gaming")).toBe("gaming");
    expect(normalizeCategory("defi")).toBe("defi");
    expect(normalizeCategory("governance")).toBe("governance");
    expect(normalizeCategory("utility")).toBe("utility");
    expect(normalizeCategory("social")).toBe("social");
    expect(normalizeCategory("nft")).toBe("nft");
  });

  it("returns 'utility' for invalid string values", () => {
    expect(normalizeCategory("invalid")).toBe("utility");
    expect(normalizeCategory("")).toBe("utility");
    expect(normalizeCategory("GAMING")).toBe("utility");
  });

  it("returns 'utility' for non-string values", () => {
    expect(normalizeCategory(null)).toBe("utility");
    expect(normalizeCategory(undefined)).toBe("utility");
    expect(normalizeCategory(42)).toBe("utility");
    expect(normalizeCategory({})).toBe("utility");
  });
});

describe("normalizePermissions", () => {
  it("returns empty object for falsy input", () => {
    expect(normalizePermissions(null)).toEqual({});
    expect(normalizePermissions(undefined)).toEqual({});
    expect(normalizePermissions(0)).toEqual({});
    expect(normalizePermissions("")).toEqual({});
  });

  it("returns empty object for non-object input", () => {
    expect(normalizePermissions("string")).toEqual({});
    expect(normalizePermissions(123)).toEqual({});
  });

  it("normalizes truthy values to booleans", () => {
    const result = normalizePermissions({
      payments: 1,
      governance: "yes",
      rng: true,
      datafeed: {},
      confidential: false,
    });
    expect(result).toEqual({
      payments: true,
      governance: true,
      rng: true,
      datafeed: true,
      confidential: false,
    });
  });

  it("normalizes missing fields to false", () => {
    const result = normalizePermissions({});
    expect(result).toEqual({
      payments: false,
      governance: false,
      rng: false,
      datafeed: false,
      confidential: false,
    });
  });
});

function makeMockApp(overrides: Partial<MiniAppInfo>): MiniAppInfo {
  return {
    app_id: "test-app",
    name: "Test App",
    description: "A test application",
    icon: "/icon.png",
    category: "utility",
    entry_url: "/app",
    supportedChains: ["neo3"],
    permissions: {},
    ...overrides,
  };
}

describe("filterByCategory", () => {
  const apps = [
    makeMockApp({ app_id: "a1", category: "gaming" }),
    makeMockApp({ app_id: "a2", category: "defi" }),
    makeMockApp({ app_id: "a3", category: "gaming" }),
    makeMockApp({ app_id: "a4", category: "utility" }),
  ];

  it("returns all apps when category is 'all'", () => {
    expect(filterByCategory(apps, "all")).toEqual(apps);
  });

  it("filters apps by specific category", () => {
    const result = filterByCategory(apps, "gaming");
    expect(result).toHaveLength(2);
    expect(result.every((a) => a.category === "gaming")).toBe(true);
  });

  it("returns empty array when no apps match", () => {
    expect(filterByCategory(apps, "nft")).toEqual([]);
  });

  it("handles empty input array", () => {
    expect(filterByCategory([], "gaming")).toEqual([]);
  });
});

describe("searchApps", () => {
  const apps = [
    makeMockApp({ app_id: "a1", name: "Crypto Dice", description: "Roll the dice" }),
    makeMockApp({ app_id: "a2", name: "DeFi Swap", description: "Token exchange" }),
    makeMockApp({ app_id: "a3", name: "Neo Vote", description: "Governance voting" }),
  ];

  it("returns all apps for empty query", () => {
    expect(searchApps(apps, "")).toEqual(apps);
    expect(searchApps(apps, "   ")).toEqual(apps);
  });

  it("matches by name (case-insensitive)", () => {
    const result = searchApps(apps, "dice");
    expect(result).toHaveLength(1);
    expect(result[0].app_id).toBe("a1");
  });

  it("matches by description (case-insensitive)", () => {
    const result = searchApps(apps, "GOVERNANCE");
    expect(result).toHaveLength(1);
    expect(result[0].app_id).toBe("a3");
  });

  it("trims whitespace from query", () => {
    const result = searchApps(apps, "  swap  ");
    expect(result).toHaveLength(1);
    expect(result[0].app_id).toBe("a2");
  });

  it("returns empty array when nothing matches", () => {
    expect(searchApps(apps, "nonexistent")).toEqual([]);
  });
});
