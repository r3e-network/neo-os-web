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

  it("keeps host lib/sdk as pure re-export shims over platform/sdk/src", () => {
    // platform/host-app/lib/sdk used to hold a hand-copied build of
    // platform/sdk that silently drifted (it was missing newer client
    // guards) while only lib/miniapp-sdk.ts consumed it. The directory may
    // now contain only re-export shims that point back at platform/sdk/src,
    // so the SDK has exactly one implementation and drift is impossible.
    const vendoredSdkDir = path.join(repoRoot, "platform/host-app/lib/sdk");
    const allowedShims = new Set(["client.js", "types.d.ts"]);
    const reExportOnly =
      /^(?:\s*(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/)\s*)*(?:export\s+(?:type\s+)?\*\s+from\s+"\.\.\/\.\.\/\.\.\/sdk\/src\/[\w/-]+";\s*)+$/;

    const entries = fs.readdirSync(vendoredSdkDir);
    expect([...entries].sort()).toEqual([...allowedShims].sort());

    for (const entry of entries) {
      const source = fs.readFileSync(path.join(vendoredSdkDir, entry), "utf8");
      expect(source).toMatch(reExportOnly);
    }
  });
});
