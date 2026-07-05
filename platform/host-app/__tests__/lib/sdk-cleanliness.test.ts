import fs from "fs";
import path from "path";

describe("platform SDK cleanliness", () => {
  const repoRoot = path.resolve(__dirname, "../../../..");
  const sdkSources = ["platform/sdk/src/client.ts"];

  it("does not ship empty EVM direct-invocation placeholder logic", () => {
    for (const relativePath of sdkSources) {
      const source = fs.readFileSync(path.join(repoRoot, relativePath), "utf8");

      expect(source).not.toContain("Evm encoding placeholder");
      expect(source).not.toContain('method: "eth_sendTransaction"');
      expect(source).not.toContain("method: 'eth_sendTransaction'");
    }
  });
});
