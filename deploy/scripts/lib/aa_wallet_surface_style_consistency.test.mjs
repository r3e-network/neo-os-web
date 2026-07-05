import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

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
    scene: "market-scene",
    drawer: "market-drawer",
    mobileMaxWidth: 760,
  },
  {
    component: "apps/aa-permissions-lab/src/PlayArea.tsx",
    file: "apps/aa-permissions-lab/src/PlayArea.scss",
    root: "perms-play-area",
    scene: "perms-scene",
    drawer: "perms-drawer",
    mobileMaxWidth: 720,
  },
  {
    component: "apps/aa-relay-console/src/PlayArea.tsx",
    file: "apps/aa-relay-console/src/PlayArea.scss",
    root: "relay-play-area",
    scene: "relay-scene",
    drawer: "relay-drawer",
    mobileMaxWidth: 720,
  },
  {
    component: "apps/aa-session-key-lab/src/PlayArea.tsx",
    file: "apps/aa-session-key-lab/src/PlayArea.scss",
    root: "sess-play-area",
    scene: "sess-scene",
    drawer: "sess-drawer",
    mobileMaxWidth: 820,
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

function assertV4TypeTracking(styles, relativePath) {
  const spacingValues = [
    ...styles.matchAll(/letter-spacing:\s*([^;]+);/g),
  ].map((match) => match[1].trim());
  for (const value of spacingValues) {
    const em = value.match(/^(-?\d*\.?\d+)em$/);
    if (em) {
      assert.ok(
        Number(em[1]) >= 0,
        `${relativePath} should not use negative tracking (found ${value})`,
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
    assert.doesNotMatch(
      styles,
      /border-radius:\s*2[2-9]px/,
      `${surface.file} should avoid oversized rounded panels`,
    );
    assert.doesNotMatch(
      styles,
      /:disabled\s*\{[^}]*opacity:\s*0\.[0-6]/s,
      `${surface.file} should keep disabled states readable`,
    );
    assertV4TypeTracking(styles, surface.file);
  }
});

test("AA and recovery wallet surfaces stay compact inside embedded miniapp consoles", () => {
  for (const surface of WALLET_SURFACES) {
    const component = read(surface.component);
    const styles = read(surface.file);

    assert.match(component, /from "@shared\/components-react\/v2"/);
    assert.match(component, /<PlayStage/);
    assert.match(component, new RegExp(`className="[^"]*${surface.root}[^"]*mx2`));
    assert.match(component, new RegExp(surface.scene));
    assert.match(component, new RegExp(surface.drawer));
    assert.match(component, /drawerToggleLabel=/);
    assert.match(component, /drawer=\{\{ title:/);

    assert.match(styles, new RegExp(`\\.${surface.scene}\\s*\\{[\\s\\S]*?background:\\s*(?:#ffffff|var\\(--mx2-surface-2\\))`));
    assert.match(styles, new RegExp(`\\.${surface.drawer}\\s*\\{`));
    assert.match(styles, new RegExp(`@media \\(max-width:\\s*${surface.mobileMaxWidth}px\\)[\\s\\S]*?\\.${surface.scene}\\s*\\{`));
    assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  }
});
