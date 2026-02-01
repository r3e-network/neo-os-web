import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

const guide = fs.readFileSync(
  path.resolve(__dirname, "../../platform/docs/distributed-miniapps-guide.md"),
  "utf8",
);

describe("distributed miniapps guide", () => {
  it("documents manual publish", () => {
    expect(guide).toContain("miniapp-publish");
    expect(guide).toContain("entry_url");
  });
});
