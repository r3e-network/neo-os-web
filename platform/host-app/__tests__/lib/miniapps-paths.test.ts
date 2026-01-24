/**
 * @jest-environment node
 */
import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "../../../..");

describe("miniapps paths", () => {
  it("no longer ships miniapps-uniapp in platform repo", () => {
    expect(fs.existsSync(path.join(repoRoot, "miniapps-uniapp"))).toBe(false);
  });
});
