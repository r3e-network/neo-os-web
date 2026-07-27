import fs from "node:fs";
import path from "node:path";

const hostRoot = path.resolve(__dirname, "../..");
const repoRoot = path.resolve(hostRoot, "../..");

function readHostAsset(relativePath: string) {
  return fs.readFileSync(path.join(hostRoot, "public", relativePath), "utf8");
}

function readRepoAsset(relativePath: string) {
  return fs.readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function decodeEmbeddedSvg(svg: string) {
  const match = svg.match(/data:image\/svg\+xml;base64,([^"]+)/);
  if (!match) return "";
  return Buffer.from(match[1], "base64").toString("utf8");
}

// The miniapp asset tree (public/miniapps/<slug>/) is gitignored and populated
// by `npm run export:miniapp-dapps`. Detect that and skip rather than failing
// in fresh checkouts (the prior behavior coupled unit-test correctness to the
// asset-staging pipeline). CI can opt into strict mode by setting
// MINIAPP_ASSETS_REQUIRED=1.
const stagedAssetsPresent = (() => {
  try {
    fs.accessSync(path.join(hostRoot, "public/miniapps/gas-lucky-pool/logo.svg"));
    fs.accessSync(path.join(hostRoot, "public/miniapps/council-governance/logo.svg"));
    return true;
  } catch {
    return false;
  }
})();

const describeWhenStaged =
  stagedAssetsPresent || process.env.MINIAPP_ASSETS_REQUIRED === "1"
    ? describe
    : describe.skip;

/** The shared runtime is an installed package now, not a sibling directory. */
function readSharedAsset(relPath: string): string {
  const pkgJson = require.resolve("@r3e-network/neo-miniapp-shared/package.json");
  return fs.readFileSync(path.join(path.dirname(pkgJson), relPath), "utf8");
}

describe("shared official token assets", () => {
  it("keeps host NEO/GAS brand icons identical to the shared official token assets", () => {
    expect(readHostAsset("brand/neo-icon.svg").trim()).toBe(
      readSharedAsset("assets/tokens/neo-icon.svg").trim(),
    );
    expect(readHostAsset("brand/gas-icon.svg").trim()).toBe(
      readSharedAsset("assets/tokens/gas-icon.svg").trim(),
    );
  });
});

describeWhenStaged("official brand assets", () => {
  it("uses the official OneGate mark instead of the generated wallet placeholder", () => {
    const walletLogo = readHostAsset("wallets/onegate.svg");
    const appLogo = readHostAsset("miniapps/gas-lucky-pool/logo.svg");
    const embeddedOfficialMark = decodeEmbeddedSvg(appLogo);

    expect(walletLogo).toContain('viewBox="0 0 24 24"');
    expect(walletLogo).toContain('fill="black"');
    expect(walletLogo).not.toContain("compact OneGate wallet mark");
    expect(walletLogo).not.toContain("#21E8A4");
    expect(walletLogo).not.toContain("<rect width=\"96\"");

    expect(embeddedOfficialMark).toContain('viewBox="0 0 24 24"');
    expect(appLogo).not.toContain("onegate-segment");
    expect(appLogo).not.toContain(">OG<");
  });

  it("uses the official Neo icon for Neo governance miniapps across app and staged assets", () => {
    const officialNeoIcon = readHostAsset("brand/neo-icon.svg");
    const stagedSlugs = ["council-governance", "gov-merc"];
    const catalogOnlySlugs = ["candidate-vote", "secret-vote", "voting"];

    for (const slug of stagedSlugs) {
      const appLogo = readRepoAsset(`apps/${slug}/public/logo.svg`);
      const stagedLogo = readHostAsset(`miniapps/${slug}/logo.svg`);
      const catalogLogo = readHostAsset(`miniapp-assets/${slug}/logo.svg`);

      expect(stagedLogo).toBe(officialNeoIcon);
      expect(catalogLogo).toBe(officialNeoIcon);
      expect(appLogo).toBe(officialNeoIcon);
      expect(stagedLogo).toContain("#00e599");
      expect(stagedLogo).toContain("#00af92");
    }

    for (const slug of catalogOnlySlugs) {
      const catalogLogo = readHostAsset(`miniapp-assets/${slug}/logo.svg`);

      expect(catalogLogo).toBe(officialNeoIcon);
      expect(catalogLogo).toContain("#00e599");
      expect(catalogLogo).toContain("#00af92");
    }

    expect(readHostAsset("miniapp-assets/council-governance/logo.svg")).not.toContain(">CG<");
    expect(readHostAsset("miniapp-assets/gov-merc/logo.svg")).not.toContain(">GM<");
  });
});
