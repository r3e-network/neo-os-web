import fs from "node:fs";
import path from "node:path";

describe("host app ESLint config", () => {
  it("uses only supported top-level ESLint config keys", () => {
    const configPath = path.resolve(process.cwd(), ".eslintrc.json");
    const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as Record<
      string,
      unknown
    >;

    expect(Object.keys(config).sort()).toEqual([
      "extends",
      "ignorePatterns",
      "rules",
    ]);
  });
});
