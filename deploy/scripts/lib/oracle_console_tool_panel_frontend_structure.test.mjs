import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const ORACLE_CONSOLE_APPS = [
  {
    app: "oracle-http-console",
    root: "oracle-console-play-area",
    scene: "oracle-console-scene",
    drawer: "oracle-http-drawer",
    request: /dispatch\("buildRequest"\)/,
    assets: ["http-oracle-pipeline.webp", "oracle-workspace-stage.webp"],
  },
  {
    app: "oracle-vrf-console",
    root: "oracle-console-play-area",
    scene: "oracle-console-scene",
    drawer: "vrf-drawer",
    request: /dispatch\("buildRequest", requestValues\)/,
    assets: ["oracle-workspace-stage.webp"],
  },
  {
    app: "oracle-seal-console",
    root: "oracle-console-play-area",
    scene: "seal-workspace",
    drawer: "seal-drawer",
    request: /dispatch\("buildRequest",\s*\{/,
    assets: ["seal-reference-stage.webp", "oracle-workspace-stage.webp"],
  },
  {
    app: "oracle-compute-lab",
    root: "oracle-compute-play-area",
    scene: "oracle-compute-desk",
    drawer: "compute-drawer",
    request: /dispatch\("buildRequest", \{ workflow, privacy, input: inputPayload \}\)/,
    assets: ["compute-privacy-stage.webp", "oracle-workspace-stage.webp"],
  },
  {
    app: "oracle-neodid-console",
    root: "oracle-neodid-play-area",
    scene: "neodid-workspace",
    drawer: "drawerToggleLabel",
    request: /dispatch\("buildRequest", \{ did, provider, claim, callback \}\)/,
    assets: ["neodid-identity-stage.webp", "oracle-workspace-stage.webp"],
  },
];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function assertNoLoudHeroTracking(styles) {
  const values = [...styles.matchAll(/letter-spacing:\s*([^;]+);/g)].map(
    (match) => match[1].trim(),
  );
  assert.ok(values.length > 0, "expected at least one letter-spacing declaration");
  for (const value of values) {
    const em = value.match(/^(\d*\.?\d+)em$/);
    assert.ok(
      value === "0" || (em && Number(em[1]) <= 0.06),
      `unexpected letter-spacing ${value}; oracle consoles should keep tracking subtle`,
    );
  }
}

test("shared oracle console panel exposes a wallet-style request workspace", () => {
  const component = read("apps/shared/components-react/ConsoleToolPanel.tsx");
  const styles = read("apps/shared/components-react/ConsoleToolPanel.scss");

  assert.match(component, /className="console-tool__hero"/);
  assert.match(component, /className="console-tool__stage"/);
  assert.match(component, /oracle-workspace-stage\.webp/);
  assert.match(component, /className="console-tool__hero-meta"/);
  assert.match(component, /className="console-tool__workspace"/);
  assert.match(component, /className="console-tool__form"/);
  assert.match(component, /className="console-tool__flow-rail"/);
  assert.match(component, /className="console-tool__request-summary"/);
  assert.match(component, /className="console-tool__input-section"/);
  assert.match(component, /className="console-tool__result"/);
  assert.match(component, /className="console-tool__result-top"/);
  assert.match(component, /className="console-tool__empty"/);
  assert.match(component, /className="console-tool__payload-card"/);
  assert.match(component, /const networkLabel =/);
  assert.match(component, /const endpointLabel =/);
  assert.match(component, /const requestCount =/);
  // The request digest is no longer a top-level const stat; it is seeded/updated
  // through the preview+reset lifecycle, so guard the actual state wiring.
  assert.match(component, /setObservable\(state, "lastDigest"/);

  assert.match(styles, /\.console-tool\s*\{[^}]*--console-warm:\s*#fff8ed/s);
  assert.match(styles, /\.console-tool\s*\{[^}]*--console-mint:\s*#eefcf5/s);
  assert.match(styles, /\.console-tool__hero\s*\{/);
  assert.match(styles, /\.console-tool__hero\s*\{[^}]*padding:\s*18px/s);
  assert.match(styles, /\.console-tool__hero\s*\{[^}]*border-radius:\s*var\(--ns-radius-lg\)/s);
  assert.match(styles, /\.console-tool__hero\s*\{[^}]*background:\s*rgba\(255, 255, 255, 0\.86\)/s);
  assert.match(styles, /\.console-tool__hero\s*\{[^}]*box-shadow:\s*var\(--ns-shadow-md\)/s);
  assert.match(styles, /\.console-tool__stage\s*\{[^}]*min-height:\s*250px/s);
  assert.match(styles, /\.console-tool__stage img\s*\{[^}]*object-fit:\s*cover/s);
  assert.match(styles, /\.console-tool__flow-rail\s*\{/);
  assert.match(styles, /\.console-tool__request-summary\s*\{/);
  assert.match(styles, /\.console-tool__result-top\s*\{/);
  assert.match(styles, /\.console-tool__rows div\s*\{[^}]*padding:\s*11px 14px/s);
  assert.match(styles, /\.console-tool__rows div\s*\{[^}]*background:\s*var\(--ns-surface-subtle\)/s);
  assert.match(styles, /\.console-tool__status-badge\s*\{[^}]*border-radius:\s*var\(--ns-radius-full\)/s);
  assert.match(styles, /\.console-tool \.neo-btn:disabled\s*\{[^}]*opacity:\s*1/s);
  assert.doesNotMatch(styles, /\.console-tool__intro h2\s*\{[^}]*#f8fafc/s);
  assert.doesNotMatch(styles, /radial-gradient/i);
  assert.doesNotMatch(styles, /font-size:\s*clamp\([^)]*vw/i);
  assert.doesNotMatch(styles, /filter:\s*saturate/);
  assert.doesNotMatch(styles, /opacity:\s*0\.5/);
  assert.doesNotMatch(
    styles,
    /\.console-tool__intro h2\s*\{[^}]*text-transform:\s*uppercase/s,
    "embedded oracle console title should not be a loud uppercase hero",
  );
  assertNoLoudHeroTracking(styles);
  assert.doesNotMatch(
    styles,
    /border-radius:\s*(?:1[8-9]|2[0-9])px/,
    "embedded oracle console surfaces should keep compact web radii",
  );
  assert.match(
    styles,
    /\.console-tool__intro h2\s*\{[^}]*font-size:\s*1\.55rem;/s,
    "panel title should be compact enough for embedded miniapp surfaces",
  );
  assert.match(
    styles,
    /\.console-tool__rows strong\s*\{[^}]*font-size:\s*0\.9rem;/s,
    "request digest should read as data, not oversized hero text",
  );
  assert.match(
    styles,
    /@media \(max-width: 520px\)[\s\S]*\.console-tool__flow-rail\s*\{[^}]*grid-template-columns:\s*1fr/s,
    "mobile oracle console flow rail should stack instead of squeezing labels",
  );
  assert.match(
    styles,
    /@media \(max-width: 860px\)[\s\S]*\.console-tool__workspace\s*\{[^}]*grid-template-columns:\s*1fr/s,
  );
  assert.match(
    styles,
    /@media \(max-width: 860px\)[\s\S]*\.console-tool__rows\s*\{[^}]*grid-template-columns:\s*1fr/s,
    "mobile oracle console result tiles should stack instead of crowding the panel",
  );
  assert.match(
    styles,
    /@media \(max-width: 860px\)[\s\S]*\.console-tool__actions\s*\{[^}]*flex-direction:\s*column/s,
    "mobile oracle console actions should form a stable full-width command area",
  );
  assert.match(
    styles,
    /@media \(max-width: 860px\)[\s\S]*\.console-tool__actions \.neo-btn\s*\{[^}]*width:\s*100%/s,
    "mobile oracle console buttons should not wrap into uneven partial-width controls",
  );

  const baseMessages = read("apps/shared/locale/base-messages.ts");
  assert.match(baseMessages, /consoleConfigureTitle:\s*\{\s*en:\s*"Request studio"/);
  assert.match(baseMessages, /consolePreviewTitle:\s*\{\s*en:\s*"Preview receipt"/);
  assert.doesNotMatch(baseMessages, /Run the form/i);
});

test("oracle console miniapps all expose a v2 request console with service dispatch", () => {
  for (const entry of ORACLE_CONSOLE_APPS) {
    const { app } = entry;
    const playArea = read(`apps/${app}/src/PlayArea.tsx`);
    const styles = read(`apps/${app}/src/PlayArea.scss`);
    const config = read(`apps/${app}/src/appConfig.ts`);

    assert.match(playArea, /<PlayStage/);
    assert.match(playArea, /category="tool"/);
    assert.match(playArea, new RegExp(entry.root));
    assert.match(playArea, new RegExp(entry.scene));
    assert.match(playArea, new RegExp(entry.drawer));
    assert.match(playArea, /drawerToggleLabel=/);
    assert.match(playArea, /drawer=\{/);
    assert.match(playArea, entry.request);
    assert.match(config, /export const consoleConfig/);
    assert.match(config, /panelTitle/);
    assert.match(config, /panelDescription/);
    assert.match(config, /statNetwork/);
    assert.match(config, /statDigest/);
    assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);

    for (const asset of entry.assets) {
      assert.ok(
        fs.existsSync(path.join(ROOT, `apps/${app}/public/${asset}`)),
        `${app} should ship ${asset}`,
      );
    }
  }
});
