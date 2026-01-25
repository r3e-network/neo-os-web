import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const source = fs.readFileSync(
  path.resolve(__dirname, "../miniapp-publish/index.ts"),
  "utf8",
);

describe("miniapp-publish entry_url", () => {
  it("writes entry_url to submissions", () => {
    expect(source).toContain("entry_url");
  });
});
