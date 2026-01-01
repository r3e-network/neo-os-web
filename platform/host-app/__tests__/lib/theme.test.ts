/**
 * @jest-environment node
 */
import { getSystemTheme, getStoredTheme } from "@/lib/theme";

describe("Theme Utils", () => {
  it("returns light as default system theme in node", () => {
    expect(getSystemTheme()).toBe("light");
  });

  it("returns system as default stored theme", () => {
    expect(getStoredTheme()).toBe("system");
  });
});
