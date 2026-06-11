import fs from "node:fs";
import path from "node:path";

describe("host app ESLint config", () => {
  it("is linted through the repo root flat config, not a legacy local rc", () => {
    // The legacy .eslintrc.json extended next/core-web-vitals without that
    // package ever being installed, so it never ran. Linting now happens via
    // the root eslint.config.mjs; a reintroduced local rc would silently
    // shadow it for editors that still honor legacy configs.
    const legacyRcPath = path.resolve(process.cwd(), ".eslintrc.json");
    expect(fs.existsSync(legacyRcPath)).toBe(false);

    const rootConfigPath = path.resolve(
      process.cwd(),
      "..",
      "..",
      "eslint.config.mjs",
    );
    expect(fs.existsSync(rootConfigPath)).toBe(true);
  });
});
