import fs from "fs";
import path from "path";

describe("Production data guardrails", () => {
  it("does not ship local OS edge previews as production API data", () => {
    const repoRoot = path.resolve(__dirname, "../../../..");
    const edgeSource = [
      "platform/host-app/pages/api/edge/[endpoint].ts",
    ].map((relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8")).join("\n");

    expect(edgeSource).not.toContain("resolveLocalPreviewData");
    expect(edgeSource).not.toContain("localPreviewResponse");
    expect(edgeSource).not.toContain("shouldUseLocalPreview");
    expect(edgeSource).not.toContain("local-preview");
  });

  it("does not ship hard-coded platform totals as live stats", () => {
    const repoRoot = path.resolve(__dirname, "../../../..");
    const statsSource = fs.readFileSync(
      path.join(repoRoot, "platform/host-app/pages/api/platform/stats.ts"),
      "utf8",
    );

    expect(statsSource).not.toContain("PLATFORM_TX_COUNT");
    expect(statsSource).not.toContain("444981");
    expect(statsSource).not.toContain("activeApps: 62");
  });

  it("does not ship fake private transfer or bridge input values", () => {
    const repoRoot = path.resolve(__dirname, "../../../..");
    const sources = [
      "platform/host-app/components/playarea/PlayAreaRegistry.tsx",
    ].map((relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8")).join("\n");

    expect(sources).not.toContain("N...recipient");
    expect(sources).not.toContain("useState(\"private payment\")");
    expect(sources).not.toContain("0xAxLabs...");
    expect(sources).not.toContain("sync:miniapp-state");
    expect(sources).not.toContain("inline encrypted_payload");
    expect(sources).not.toContain("nullifier_hash_preview");
  });

  it("does not ship local randomness or fake VRF request defaults", () => {
    const repoRoot = path.resolve(__dirname, "../../../..");
    const sources = [
    ].map((relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8")).join("\n");

    expect(sources).not.toContain("miniapp-game-round");
    expect(sources).not.toContain("round-42");
    expect(sources).not.toContain("recipe_preview");
    expect(sources).not.toContain("local pseudorandomness");
    expect(sources).not.toContain("loadJitter");
    expect(sources).not.toContain("Jitter");
    expect(sources).not.toContain("Build and preview");
  });

  it("does not ship placeholder hashes as profiled playarea defaults", () => {
    const repoRoot = path.resolve(__dirname, "../../../..");
    const source = fs.readFileSync(
      path.join(repoRoot, "platform/host-app/components/playarea/PlayAreaRegistry.tsx"),
      "utf8",
    );

    expect(source).not.toMatch(/defaultValue:\s*"0x[^"]*\.\.\."/);
    expect(source).not.toContain("sha256:...");
  });

  it("does not ship fake profiled playarea status metrics", () => {
    const repoRoot = path.resolve(__dirname, "../../../..");
    const source = fs.readFileSync(
      path.join(repoRoot, "platform/host-app/components/playarea/PlayAreaRegistry.tsx"),
      "utf8",
    );

    expect(source).not.toContain('value: "#12"');
    expect(source).not.toContain('value: "68%"');
    expect(source).not.toContain('value: "1.4x"');
    expect(source).not.toContain('value: "medium"');
    expect(source).not.toContain('label: "Live data"');
    expect(source).not.toContain('value: "Awaiting read"');
  });

  it("does not expose tutorial copy that points users to implementation chrome", () => {
    const repoRoot = path.resolve(__dirname, "../../../..");
    const sources = [
      "platform/host-app/components/playarea/PlayAreaRegistry.tsx",
      "platform/host-app/components/MiniAppPlayfield.tsx",
      // The live red-envelope play surface. Was src/PlayArea.tsx, an unmounted
].map((relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), "utf8")).join("\n");

    expect(sources).not.toMatch(/right action console/i);
    expect(sources).not.toMatch(/shared action console/i);
    expect(sources).not.toMatch(/from the action console/i);
  });
});
