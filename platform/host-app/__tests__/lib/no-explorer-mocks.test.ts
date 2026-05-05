import fs from "fs";
import path from "path";

describe("Explorer real-data guardrails", () => {
  it("does not ship local preview mocks for chain stats or recent transactions", () => {
    const repoRoot = path.resolve(__dirname, "../../../..");
    const explorerSource = fs.readFileSync(
      path.join(repoRoot, "apps/explorer/src/composables/useExplorer.ts"),
      "utf8",
    );

    expect(explorerSource).not.toMatch(/LOCAL_.*MOCK/);
    expect(explorerSource).not.toContain("isLocalPreview");
  });
});
