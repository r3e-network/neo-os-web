import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = resolve(__dirname, "..");
const read = (file: string) => readFileSync(resolve(appRoot, file), "utf8");

describe("screw-sort production safety", () => {
  it("publishes a local-only, non-transactional manifest", () => {
    const manifest = JSON.parse(read("neo-manifest.json")) as {
      id: string;
      contracts?: unknown;
      permissions: string[];
      platform: { transactions: boolean };
      features: { stateless: boolean; offlineSupport: boolean };
      technologies: Record<string, { enabled: boolean }>;
      urls: { entry: string };
    };
    expect(manifest.id).toBe("miniapp-screw-sort");
    expect(manifest.contracts).toBeUndefined();
    expect(manifest.permissions).toEqual([]);
    expect(manifest.platform.transactions).toBe(false);
    expect(manifest.features).toMatchObject({ stateless: false, offlineSupport: true });
    expect(Object.values(manifest.technologies).every(({ enabled }) => !enabled)).toBe(true);
    expect(manifest.urls.entry).toBe("/miniapps/screw-sort/index.html");
  });

  it("does not expose wallet, chain, oracle, payment, or reward actions", () => {
    const main = read("src/main.tsx");
    const sourceManifest = read("src/manifest.ts");
    expect(main).toContain('app.mode.set("guest")');
    expect(main).toContain("const ensureGuestMode = (): boolean =>");
    expect(main.match(/ensureGuestMode\(\)/g)?.length).toBeGreaterThanOrEqual(7);
    expect(sourceManifest).toContain("supportsGameFi: false");
    expect(main).not.toMatch(/\.(?:chain|wallet|oracle|funds)\./);
    expect(main).not.toMatch(/game\.reward|invoke(?:WithPayment|Multiple)?\s*\(|payAndCall/);
  });

  it("ships real optimized art without committing heavyweight generation sources", () => {
    for (const file of [
      "public/art/workshop.webp",
      "public/art/plank.webp",
      "public/art/screw.webp",
      "public/art/toolbox.webp",
      "public/art/overflow-tray.webp",
      "public/logo.webp",
      "public/banner.webp",
    ]) {
      expect(existsSync(resolve(appRoot, file)), file).toBe(true);
    }
    expect(existsSync(resolve(appRoot, "public/art/workshop-source.png"))).toBe(false);
    expect(existsSync(resolve(appRoot, "assets-source"))).toBe(false);
  });

  it("records the upstream commit and the no-copy provenance boundary", () => {
    const attribution = read("ATTRIBUTION.md");
    const audit = read("REFERENCE_AUDIT.md");
    expect(attribution).toContain("73bb72fa6b144148fc7c7e93c83ffd47f3d9f173");
    expect(attribution).toContain("019f4c90-55d6-7680-b69b-8a32d10ebb00");
    expect(attribution).toContain("no upstream source file was copied verbatim");
    expect(audit).toContain("blank");
    expect(audit).toContain("sixth");
    expect(audit).toContain("2,000 deterministic seeds");
  });

  it("rebuilds layered board containers after the mobile host resizes", () => {
    const scene = read("src/scenes/ScrewSortScene.ts");
    const resizeStart = scene.indexOf("protected onResize");
    const resizeEnd = scene.indexOf("protected onStateUpdate", resizeStart);
    const resizeFlow = scene.slice(resizeStart, resizeEnd);
    expect(resizeFlow).toContain("this.children.removeAll(true)");
    expect(resizeFlow).toContain("this.rebuildBoards(this.currentSession)");
    expect(resizeFlow.indexOf("this.rebuildBoards(this.currentSession)")).toBeLessThan(
      resizeFlow.indexOf("this.syncSession(this.currentSession, false)"),
    );
  });

  it("keeps HUD metrics above the DOM action rail and warms the real mount root", () => {
    const scene = read("src/scenes/ScrewSortScene.ts");
    const styles = read("src/PlayArea.scss");
    const sharedRoot = read("../shared/react/MiniAppRoot.tsx");
    const rootRule = styles.match(
      /\.standalone-dapp-root\.standalone-dapp-root\s*\{(?<body>[^}]*)\}/,
    )?.groups?.body;
    expect(scene).toContain("this.y(575)");
    expect(scene).toContain("this.y(598)");
    expect(styles).toMatch(/#app\s*\{/);
    expect(styles).toContain("min-height: 100svh");
    expect(sharedRoot).toContain('background: "var(--sd-canvas, #FAF9F7)"');
    expect(rootRule).toContain("background-color: #fff8ea !important");
    expect(rootRule).toContain('background-image: url("/art/workshop.webp") !important');
    expect(rootRule).toContain("background-position: center !important");
    expect(rootRule).toContain("background-size: cover !important");
    expect(rootRule).toContain("background-repeat: no-repeat !important");
    expect(styles).not.toContain("../public/");
    expect(styles).not.toContain("/public/");
  });

  it("commits moves immediately and presents only authoritative revisions", () => {
    const scene = read("src/scenes/ScrewSortScene.ts");
    const wrapper = read("src/PhaserPlayArea.tsx");
    const requestStart = scene.indexOf("private requestScrewMove");
    const requestEnd = scene.indexOf("private releaseMoveLock", requestStart);
    const requestFlow = scene.slice(requestStart, requestEnd);
    const stateStart = scene.indexOf("protected onStateUpdate");
    const stateEnd = scene.indexOf("protected onBridgeError", stateStart);
    const stateFlow = scene.slice(stateStart, stateEnd);

    expect(scene).toContain('image.setData("screwBaseScale", baseScale)');
    expect(scene).toContain("hoverScale: baseScale * 1.08");
    expect(scene).toContain("pressScale: baseScale * 0.9");
    expect(scene).toContain("scaleX: flightScale * 0.64");
    expect(scene).not.toContain('"lost"');
    expect(requestFlow).toContain('this.dispatch("selectScrew", screw.id)');
    expect(requestFlow).not.toContain("delayedCall");
    expect(requestFlow).not.toContain("this.animate");
    expect(stateFlow).toContain("revisionChanged");
    expect(stateFlow).toContain("this.playMoveAnimation(event, previous, session)");
    expect(wrapper).toContain("moveRequestRevision");
    expect(wrapper).toContain("core.revision > moveRequestRevision");
    expect(wrapper).not.toMatch(/actionPreview|setTimeout\(/);
    expect(scene).not.toMatch(/startActionPreview|dispatchTimer/);
    expect(scene).not.toContain("setAngle(0).setScale(1)");
  });
});
