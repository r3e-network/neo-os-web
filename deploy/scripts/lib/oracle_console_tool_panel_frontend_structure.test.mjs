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
  "oracle-http-console",
  "oracle-vrf-console",
  "oracle-seal-console",
  "oracle-compute-lab",
  "oracle-neodid-console",
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
    assert.equal(
      value,
      "0",
      `unexpected letter-spacing ${value}; oracle consoles should not use tracked UI text`,
    );
  }
}

test("shared oracle console panel exposes a wallet-style request workspace", () => {
  const component = read("apps/shared/components-react/ConsoleToolPanel.tsx");
  const styles = read("apps/shared/components-react/ConsoleToolPanel.scss");

  assert.match(component, /className="console-tool__hero"/);
  assert.match(component, /className="console-tool__stage"/);
  assert.match(component, /oracle-workspace-stage\.jpg/);
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

test("oracle console miniapps all use the shared wallet-style console panel", () => {
  for (const app of ORACLE_CONSOLE_APPS) {
    const playArea = read(`apps/${app}/src/PlayArea.tsx`);
    const config = read(`apps/${app}/src/appConfig.ts`);
    const stageAsset = path.join(ROOT, `apps/${app}/public/oracle-workspace-stage.jpg`);

    assert.match(playArea, /ConsoleToolPanel/);
    assert.match(config, /export const consoleConfig/);
    assert.match(config, /panelTitle/);
    assert.match(config, /panelDescription/);
    assert.match(config, /statNetwork/);
    assert.match(config, /statDigest/);
    assert.ok(
      fs.existsSync(stageAsset),
      `${app} should ship the shared no-text oracle workspace scene asset`,
    );
  }
});
