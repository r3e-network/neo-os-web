import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const APP = resolve(ROOT, "miniapp-factory");
const FACTORY_HASH = "0x03a7c8fc724a575ee739c919ed52cb5e2a2bdc49";

describe("MiniApp Studio production contract", () => {
  it("publishes the exact stateful testnet and wallet capability boundary", () => {
    const manifest = JSON.parse(readFileSync(resolve(APP, "neo-manifest.json"), "utf8")) as {
      version: string;
      contracts: Record<string, string>;
      supported_networks: string[];
      default_network: string;
      permissions: string[];
      features: { stateless: boolean; offlineSupport: boolean };
      platform: { transactions: boolean };
    };
    const pkg = JSON.parse(readFileSync(resolve(APP, "package.json"), "utf8")) as { version: string };

    expect(manifest.version).toBe(pkg.version);
    expect(manifest.contracts).toEqual({ "neo-n3-testnet": FACTORY_HASH });
    expect(manifest.supported_networks).toEqual(["neo-n3-testnet"]);
    expect(manifest.default_network).toBe("neo-n3-testnet");
    expect(manifest.permissions).toEqual([
      "invoke:primary",
      "invoke:platform-factory",
      "wallet:sign-message",
      "read:blockchain",
    ]);
    expect(manifest.features).toMatchObject({ stateless: false, offlineSupport: false });
    expect(manifest.platform.transactions).toBe(true);
  });

  it("uses bright high-contrast surfaces, bounded controls and responsive hierarchy", () => {
    const styles = readFileSync(resolve(APP, "src/PlayArea.scss"), "utf8");

    expect(styles).toMatch(/\.miniapp-studio__stage\s*\{[\s\S]*grid-template-columns:/);
    expect(styles).toMatch(/\.miniapp-studio__stage\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.miniapp-studio__workspace\s*\{[\s\S]*grid-template-columns:/);
    expect(styles).toMatch(/\.miniapp-studio__primary\s*\{[\s\S]*max-width:\s*280px/);
    expect(styles).toMatch(/\.miniapp-studio__artifact-panel pre\s*\{[\s\S]*max-height:\s*310px/);
    expect(styles).toMatch(/@media \(max-width:\s*860px\)/);
    expect(styles).toMatch(/@media \(max-width:\s*600px\)/);
    expect(styles).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)/);
    expect(styles).not.toMatch(/backdrop-filter/);
    expect(styles).not.toMatch(/repeating-linear-gradient/);
  });

  it("records repository-local artwork and an honest operator boundary", async () => {
    const sharp = (await import("sharp")).default;
    const artwork = await sharp(resolve(APP, "public/miniapp-launch-studio.webp")).metadata();
    const provenance = readFileSync(resolve(APP, "ASSET_PROVENANCE.md"), "utf8");
    const status = readFileSync(resolve(APP, "PRODUCTION_STATUS.md"), "utf8");
    const messages = readFileSync(resolve(APP, "src/locale/messages.ts"), "utf8");

    expect(artwork).toMatchObject({ width: 1672, height: 941, format: "webp" });
    expect(provenance).toContain("d4096680a17c93bdab7161af6d6679e9354b5a50");
    expect(provenance).toContain("No asset in this app is copied from `IcedSoul/minigame-everyday`");
    expect(status).toContain("It is not an application or\ncontract deployment service");
    expect(status).toContain("writes a registry record");
    expect(messages).toContain("does not deploy the finished app");
    expect(messages.toLowerCase()).not.toContain("deployment successful");
  });
});
