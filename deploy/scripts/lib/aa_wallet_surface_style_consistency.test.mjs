import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

// Per-surface pins below track the committed console redesigns
// (aa-market-hub 3c6e8f2b9, aa-relay-console 2e84ec1a6, aa-session-key-lab
// b7666e4b1, all consolidated/landed via 488fa04ec + 0dd7c4af1). Optional
// fields document each surface's intentional deviations from the shared
// defaults; every rule still applies at its default strictness to surfaces
// that do not opt in.
//   roundedPanels — exact 22-29px radii the redesign uses for its hero/scene
//     cards; anything larger in that band, or new offenders, still fail.
//   minTracking — tightest display-numeral letter-spacing (em) the redesign
//     ships; body text tighter than this cap still fails.
//   sceneBackground — committed scene surface when it is not plain white
//     (e.g. transparent over the mx2 stage floor, or a warm off-white).
//   mobileSelector — the selector the surface compacts in its narrowest
//     media block when that is not the scene class itself.
const WALLET_SURFACES = [
  {
    component: "apps/aa-account-lab/src/PlayArea.tsx",
    file: "apps/aa-account-lab/src/PlayArea.scss",
    root: "aa-play-area",
    scene: "aa-scene",
    drawer: "aa-drawer",
    mobileMaxWidth: 720,
  },
  {
    component: "apps/aa-market-hub/src/PlayArea.tsx",
    file: "apps/aa-market-hub/src/PlayArea.scss",
    root: "aa-market-play-area",
    scene: "aa-market-scene",
    drawer: "aa-market-drawer",
    mobileMaxWidth: 620,
    // Marketplace redesign: transparent scene over the stage floor set on
    // .mx2-stage__scene, 22/28px rounded market cards, -0.04em display
    // numerals.
    sceneBackground: "transparent",
    roundedPanels: ["22px", "28px"],
    minTracking: -0.04,
  },
  {
    component: "apps/aa-permissions-lab/src/PlayArea.tsx",
    file: "apps/aa-permissions-lab/src/PlayArea.scss",
    root: "perms-play-area",
    scene: "perms-workspace",
    drawer: "perms-drawer",
    mobileMaxWidth: 720,
  },
  {
    component: "apps/aa-relay-console/src/PlayArea.tsx",
    file: "apps/aa-relay-console/src/PlayArea.scss",
    root: "relay-play-area",
    scene: "aa-relay-scene",
    drawer: "aa-relay-drawer",
    mobileMaxWidth: 620,
    // Relay command-console redesign: warm off-white scene card at 24px with
    // -0.035em on its 30px figcaption numerals.
    sceneBackground: "#fffdf8",
    roundedPanels: ["24px"],
    minTracking: -0.035,
  },
  {
    component: "apps/aa-session-key-lab/src/PlayArea.tsx",
    file: "apps/aa-session-key-lab/src/PlayArea.scss",
    root: "sess-play-area",
    scene: "sess-scene",
    drawer: "sess-drawer",
    // Session-key console compacts its workspace grid at 900px; the scene
    // card itself stays fluid, so the mobile check targets the workspace.
    mobileMaxWidth: 900,
    mobileSelector: "sess-workspace",
    roundedPanels: ["22px"],
  },
  {
    component: "apps/recovery-guardian/src/PlayArea.tsx",
    file: "apps/recovery-guardian/src/PlayArea.scss",
    root: "recovery-guardian-play-area",
    scene: "guardian-scene",
    drawer: "guardian-drawer",
    mobileMaxWidth: 560,
  },
];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function assertV4TypeTracking(styles, relativePath, minTracking = 0) {
  const spacingValues = [
    ...styles.matchAll(/letter-spacing:\s*([^;]+);/g),
  ].map((match) => match[1].trim());
  for (const value of spacingValues) {
    const em = value.match(/^(-?\d*\.?\d+)em$/);
    if (em) {
      assert.ok(
        Number(em[1]) >= minTracking,
        `${relativePath} should not use tracking tighter than ${minTracking}em (found ${value})`,
      );
      assert.ok(
        Number(em[1]) <= 0.12,
        `${relativePath} should not over-space text beyond 0.12em (found ${value})`,
      );
    }
  }
}

test("AA and recovery wallet surfaces share professional card and type rules", () => {
  for (const surface of WALLET_SURFACES) {
    const styles = read(surface.file);

    assert.doesNotMatch(
      styles,
      /font-size:\s*clamp\(/,
      `${surface.file} should avoid viewport-scaled text`,
    );
    // Oversized-panel rule: 22-29px radii are banned unless the surface's
    // committed redesign pins them explicitly via roundedPanels.
    const allowedRadii = surface.roundedPanels ?? [];
    const oversized = [...styles.matchAll(/border-radius:\s*(2[2-9]px)/g)]
      .map((match) => match[1])
      .filter((radius) => !allowedRadii.includes(radius));
    assert.deepEqual(
      oversized,
      [],
      `${surface.file} should avoid oversized rounded panels (unpinned: ${oversized.join(", ")})`,
    );
    // Disabled states must stay readable: every :disabled opacity must be at
    // least 0.65. (Value-aware check: the old /0\.[0-6]/ prefix regex falsely
    // rejected the fleet's committed 0.68 treatment.)
    const disabledOpacities = [
      ...styles.matchAll(/:disabled\s*\{[^}]*opacity:\s*(0?\.\d+|[01])/gs),
    ].map((match) => Number(match[1]));
    for (const opacity of disabledOpacities) {
      assert.ok(
        opacity >= 0.65,
        `${surface.file} should keep disabled states readable (opacity ${opacity} < 0.65)`,
      );
    }
    assertV4TypeTracking(styles, surface.file, surface.minTracking ?? 0);
  }
});

test("AA and recovery wallet surfaces stay compact inside embedded miniapp consoles", () => {
  for (const surface of WALLET_SURFACES) {
    const component = read(surface.component);
    const styles = read(surface.file);

    assert.match(component, /from "@shared\/components-react\/v2(?:\/[^"]+)?"/);
    assert.match(component, /<PlayStage/);
    assert.match(component, new RegExp(`className="[^"]*${surface.root}[^"]*mx2`));
    assert.match(component, new RegExp(surface.scene));
    assert.match(component, new RegExp(surface.drawer));
    assert.match(component, /drawerToggleLabel=/);
    assert.match(component, /drawer=\{\{ title:/);

    const sceneBackground = surface.sceneBackground
      ? surface.sceneBackground.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      : "(?:#ffffff|var\\(--mx2-surface-2\\))";
    assert.match(styles, new RegExp(`\\.${surface.scene}\\s*\\{[\\s\\S]*?background:\\s*${sceneBackground}`));
    assert.match(styles, new RegExp(`\\.${surface.drawer}\\s*\\{`));
    const mobileSelector = surface.mobileSelector ?? surface.scene;
    assert.match(styles, new RegExp(`@media \\(max-width:\\s*${surface.mobileMaxWidth}px\\)[\\s\\S]*?\\.${mobileSelector}\\s*\\{`));
    assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  }
});
