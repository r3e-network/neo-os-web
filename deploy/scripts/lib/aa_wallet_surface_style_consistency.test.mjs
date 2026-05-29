import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

const WALLET_SURFACE_STYLES = [
  "apps/aa-account-lab/src/PlayArea.scss",
  "apps/aa-market-hub/src/PlayArea.scss",
  "apps/aa-permissions-lab/src/PlayArea.scss",
  "apps/aa-relay-console/src/PlayArea.scss",
  "apps/aa-session-key-lab/src/PlayArea.scss",
  "apps/recovery-guardian/src/PlayArea.scss",
];

const WALLET_HERO_SURFACES = [
  ["apps/aa-account-lab/src/PlayArea.scss", "account"],
  ["apps/aa-market-hub/src/PlayArea.scss", "market"],
  ["apps/aa-permissions-lab/src/PlayArea.scss", "permissions"],
  ["apps/aa-relay-console/src/PlayArea.scss", "relay"],
  ["apps/aa-session-key-lab/src/PlayArea.scss", "session"],
  ["apps/recovery-guardian/src/PlayArea.scss", "guardian"],
];

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

function assertOnlyZeroLetterSpacing(styles, relativePath) {
  const values = [...styles.matchAll(/letter-spacing:\s*([^;]+);/g)].map(
    (match) => match[1].trim(),
  );
  assert.ok(values.length > 0, `${relativePath} should declare letter-spacing`);
  assert.deepEqual(
    values,
    values.map(() => "0"),
    `${relativePath} should only use zero letter-spacing`,
  );
}

test("AA and recovery wallet surfaces share professional card and type rules", () => {
  for (const relativePath of WALLET_SURFACE_STYLES) {
    const styles = read(relativePath);

    assert.doesNotMatch(
      styles,
      /font-size:\s*clamp\(/,
      `${relativePath} should avoid viewport-scaled text`,
    );
    assert.doesNotMatch(
      styles,
      /border-radius:\s*2[2-9]px/,
      `${relativePath} should avoid oversized rounded panels`,
    );
    assert.doesNotMatch(
      styles,
      /opacity:\s*0\.[45]/,
      `${relativePath} should keep disabled and muted states readable`,
    );
    assertOnlyZeroLetterSpacing(styles, relativePath);
  }
});

test("AA and recovery wallet heroes stay compact inside embedded miniapp consoles", () => {
  for (const [relativePath, prefix] of WALLET_HERO_SURFACES) {
    const styles = read(relativePath);

    assert.match(
      styles,
      new RegExp(`\\.${prefix}-hero\\s*\\{[\\s\\S]*padding:\\s*24px;[\\s\\S]*border-radius:\\s*16px;`),
      `${relativePath} hero should use compact desktop panel spacing`,
    );
    assert.match(
      styles,
      new RegExp(`\\.${prefix}-hero__copy h2\\s*\\{[\\s\\S]*font-size:\\s*32px;[\\s\\S]*line-height:\\s*1\\.12;`),
      `${relativePath} hero title should read as an embedded console heading`,
    );
    assert.match(
      styles,
      new RegExp(`@media \\(max-width: [0-9]+px\\)[\\s\\S]*\\.${prefix}-hero\\s*\\{[\\s\\S]*padding:\\s*18px;[\\s\\S]*border-radius:\\s*14px;`),
      `${relativePath} mobile hero should avoid large card chrome`,
    );
    assert.match(
      styles,
      new RegExp(`@media \\(max-width: [0-9]+px\\)[\\s\\S]*\\.${prefix}-hero__copy h2\\s*\\{[\\s\\S]*font-size:\\s*28px;`),
      `${relativePath} mobile hero title should not dominate the first viewport`,
    );
  }
});
