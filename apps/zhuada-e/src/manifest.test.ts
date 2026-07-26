import { describe, expect, it } from "vitest";

import { manifest } from "./manifest";

describe("launcher content contract", () => {
  it("keeps the rules preview singular and uses the lower showcase for all themes", () => {
    const rulesDoc = manifest.docs?.find((doc) => doc.type === "steps");
    const showcase = manifest.gamePage?.features ?? [];

    expect(rulesDoc).toMatchObject({
      titleKey: "rulesTitle",
      contentKey: "rulesCopy",
    });
    expect(manifest.gamePage?.featuresTitleKey).toBe("themePickerTitle");
    expect(showcase).toHaveLength(3);
    expect(showcase.map((feature) => feature.titleKey)).toEqual([
      "themeFreshName",
      "themeFarmName",
      "themeNightName",
    ]);
    expect(showcase.some((feature) => feature.descKey === "rulesCopy")).toBe(false);
  });

  it("keeps the launcher description aligned with the 24-level rules catalog", () => {
    expect(manifest.description).toContain("twenty-four levels");
  });
});
