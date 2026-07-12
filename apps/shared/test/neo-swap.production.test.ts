import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const APP = path.resolve(process.cwd(), "../neo-swap");

function read(relativePath: string) {
  return readFileSync(path.join(APP, relativePath), "utf8");
}

describe("Neo Swap production boundary", () => {
  it("keeps settlement fail-closed while no router is deployed", () => {
    const catalog = JSON.parse(read("neo-manifest.json")) as {
      contracts?: Record<string, unknown>;
      permissions?: string[];
    };
    const manifest = read("src/manifest.ts");
    const settlement = read("src/settlement.ts");
    const packageJson = JSON.parse(read("package.json")) as { version?: string };

    expect(catalog.contracts).toEqual({});
    expect(packageJson.version).toBe("1.2.0");
    expect((JSON.parse(read("neo-manifest.json")) as { version?: string }).version).toBe(packageJson.version);
    expect(catalog.permissions).toEqual(["read:blockchain"]);
    expect(manifest).toMatch(/walletRequired:\s*false/);
    expect(manifest).toMatch(/payments:\s*false/);
    expect(manifest).toMatch(/datafeed:\s*true/);
    expect(settlement).toMatch(/ACTIVE_SWAP_ROUTER_BINDING:[^=]+\= null/);
    expect(settlement).toContain("isApprovedSwapRouter");
    expect(settlement).toContain("validateConfirmation");
    expect(catalog).not.toHaveProperty("stateSource");
    expect((catalog as { platform?: { transactions?: boolean } }).platform?.transactions).toBe(false);
  });

  it("ships provenance-safe route artwork without replacing official token marks", () => {
    const art = readFileSync(path.join(APP, "public/liquidity-route-v2.webp"));
    const playArea = read("src/PlayArea.tsx");
    const attribution = read("ATTRIBUTION.md");

    expect(art.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(art.subarray(8, 12).toString("ascii")).toBe("WEBP");
    expect(playArea).toContain('const SWAP_STAGE_ART = "liquidity-route-v2.webp"');
    expect(playArea).toContain("<TokenIcon");
    expect(attribution).toContain("OpenAI image generation");
    expect(attribution).toContain("official Neo Press Kit");
    for (const asset of ["logo.webp", "banner.webp"]) {
      const image = readFileSync(path.join(APP, "public", asset));
      expect(image.subarray(0, 4).toString("ascii")).toBe("RIFF");
      expect(image.subarray(8, 12).toString("ascii")).toBe("WEBP");
    }
    expect(attribution).toContain("no generated or redrawn token marks");
  });

  it("does not document an imaginary pool, price impact, or completed testnet swap", () => {
    const docs = `${read("README.md")}\n${read("README.zh-CN.md")}\n${read("TESTNET-STATUS.md")}`;

    expect(docs).toContain("quote-only");
    expect(docs).toContain("no deployed swap router");
    expect(docs).not.toMatch(/deep liquidity pools ensure/i);
    expect(docs).not.toMatch(/constant product formula/i);
    expect(docs).not.toMatch(/live testnet swap (?:passed|verified|complete)/i);
  });

  it("uses exact BigInt quote and raw-balance lanes without CSS-drawn route art", () => {
    const engine = read("src/hooks/useSwapEngine.ts");
    const math = read("src/quoteMath.ts");
    const playArea = read("src/PlayArea.tsx");
    const styles = read("src/PlayArea.scss");

    expect(engine).toContain('app.wallet.raw("NEO")');
    expect(engine).toContain("quoteOutputUnits(");
    expect(engine).not.toMatch(/amount \* rate|fromQuote\.price \/ toQuote\.price/);
    expect(math).toContain("BigInt");
    expect(`${playArea}\n${styles}`).not.toMatch(/swap-route-core__(?:bead|line)|swap-flow-bead-y/);
  });
});
