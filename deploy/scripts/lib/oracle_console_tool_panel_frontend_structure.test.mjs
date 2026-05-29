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

function assertOnlyZeroLetterSpacing(styles) {
  const values = [...styles.matchAll(/letter-spacing:\s*([^;]+);/g)].map(
    (match) => match[1].trim(),
  );
  assert.ok(values.length > 0, "expected at least one letter-spacing declaration");
  assert.deepEqual(values, values.map(() => "0"));
}

test("shared oracle console panel exposes a wallet-style request workspace", () => {
  const component = read("apps/shared/components-react/ConsoleToolPanel.tsx");
  const styles = read("apps/shared/components-react/ConsoleToolPanel.scss");

  assert.match(component, /className="console-tool__hero"/);
  assert.match(component, /className="console-tool__hero-metrics"/);
  assert.match(component, /className="console-tool__asset-card"/);
  assert.match(component, /className="console-tool__asset-signal"/);
  assert.match(component, /className="console-tool__flow"/);
  assert.match(component, /className="console-tool__hint"/);
  assert.match(component, /className="console-tool__payload-card"/);
  assert.match(component, /const networkLabel =/);
  assert.match(component, /const endpointLabel =/);
  assert.match(component, /const requestCount =/);
  assert.match(component, /const lastDigest =/);

  assert.match(styles, /\.console-tool\s*\{[^}]*#f7f8fb/s);
  assert.match(styles, /\.console-tool__hero\s*\{/);
  assert.match(styles, /\.console-tool__hero\s*\{[^}]*padding:\s*18px/s);
  assert.match(styles, /\.console-tool__hero\s*\{[^}]*border-radius:\s*16px/s);
  assert.match(styles, /\.console-tool__hero\s*\{[^}]*background:\s*#ffffff/s);
  assert.match(styles, /\.console-tool__hero\s*\{[^}]*box-shadow:\s*0 12px 30px rgba\(15,\s*23,\s*42,\s*0\.06\)/s);
  assert.match(styles, /\.console-tool__asset-card\s*\{[^}]*linear-gradient/s);
  assert.match(styles, /\.console-tool__asset-token\s*\{[^}]*border-radius:\s*999px/s);
  assert.match(styles, /\.console-tool__hint\s*\{[^}]*padding:\s*11px 13px/s);
  assert.match(styles, /\.console-tool__hint\s*\{[^}]*background:\s*#f8fafc/s);
  assert.match(styles, /\.console-tool \.neo-btn:disabled\s*\{[^}]*opacity:\s*1/s);
  assert.doesNotMatch(styles, /\.console-tool__intro h2\s*\{[^}]*#f8fafc/s);
  assert.doesNotMatch(styles, /radial-gradient/i);
  assert.doesNotMatch(styles, /font-size:\s*clamp\([^)]*vw/i);
  assert.doesNotMatch(styles, /filter:\s*saturate/);
  assert.doesNotMatch(styles, /opacity:\s*0\.5/);
  assert.doesNotMatch(styles, /text-transform:\s*uppercase/);
  assertOnlyZeroLetterSpacing(styles);
  assert.doesNotMatch(
    styles,
    /border-radius:\s*(?:1[8-9]|2[0-9])px/,
    "embedded oracle console surfaces should keep compact web radii",
  );
  assert.doesNotMatch(
    styles,
    /\.console-tool\s*\{[^}]*linear-gradient/s,
    "embedded oracle console shell should use a calm flat surface",
  );
  assert.match(
    styles,
    /\.console-tool__intro h2\s*\{[^}]*font-size:\s*1\.4rem;/s,
    "panel title should be compact enough for embedded miniapp surfaces",
  );
  assert.match(
    styles,
    /\.console-tool__asset-copy strong\s*\{[^}]*font-size:\s*1\.12rem;/s,
    "request digest should read as data, not oversized hero text",
  );
  assert.match(
    styles,
    /@media \(max-width: 860px\)[\s\S]*\.console-tool__workspace\s*\{[^}]*grid-template-columns:\s*1fr/s,
  );
  assert.match(
    styles,
    /@media \(max-width: 860px\)[\s\S]*\.console-tool__flow\s*\{[^}]*grid-template-columns:\s*1fr/s,
    "mobile oracle console flow steps should stack instead of crowding the form",
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
});

test("oracle console miniapps all use the shared wallet-style console panel", () => {
  for (const app of ORACLE_CONSOLE_APPS) {
    const playArea = read(`apps/${app}/src/PlayArea.tsx`);
    const config = read(`apps/${app}/src/appConfig.ts`);

    assert.match(playArea, /ConsoleToolPanel/);
    assert.match(config, /export const consoleConfig/);
    assert.match(config, /panelTitle/);
    assert.match(config, /panelDescription/);
    assert.match(config, /statNetwork/);
    assert.match(config, /statDigest/);
  }
});
