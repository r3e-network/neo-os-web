import { describe, expect, it } from "vitest";
import { PERK_ICON } from "./GoosePerkIcon";
import { GOOSE_PASSIVES } from "./logic/goose-passive";

describe("GoosePerkIcon — every goose perk has a glyph", () => {
  it("maps an icon for each scene's perkKey", () => {
    for (const def of Object.values(GOOSE_PASSIVES)) {
      expect(def.perkKey, `missing icon for ${def.perkKey}`).toBeTruthy();
      expect(PERK_ICON[def.perkKey], `no icon registered for ${def.perkKey}`).toBeDefined();
    }
  });
});
