import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

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

test("GasBox renders a complete wallet-style market console even with no active machines", () => {
  const playArea = read("apps/gasbox/src/PlayArea.tsx");
  const styles = read("apps/gasbox/src/PlayArea.scss");
  const messages = read("apps/gasbox/src/locale/messages.ts");
  const main = read("apps/gasbox/src/main.tsx");

  assert.match(playArea, /className="gasbox-hero"/);
  assert.match(playArea, /className="gasbox-signal-card"/);
  assert.match(playArea, /className="gasbox-market-empty"/);
  assert.match(playArea, /className="gasbox-player-route"/);
  assert.match(playArea, /className="gasbox-safety-card"/);
  assert.match(playArea, /machineCount > 0 \? machineCount\.toLocaleString\(\) : t\("gasboxPending"\)/);
  assert.match(playArea, /const selectedMachineReady = Boolean/);
  assert.match(playArea, /dispatch\("refreshMachines"\)/);
  assert.match(playArea, /dispatch\("openStudio"\)/);
  assert.match(main, /ctx\.registerAction\("refreshMachines"/);
  assert.match(main, /ctx\.registerAction\("openStudio"/);
  assert.match(main, /gasbox\.loadAll\(\)/);

  for (const key of [
    "gasboxPending",
    "gasboxLiveStatus",
    "gasboxMarketEmptyTitle",
    "gasboxMarketEmptyDesc",
    "gasboxPlayerRoute",
    "gasboxEscrowSafetyTitle",
    "gasboxEscrowSafetyDesc",
    "openStudio",
    "studioGuidance",
  ]) {
    assert.match(messages, new RegExp(`${key}:`));
  }

  assert.match(styles, /\.gasbox-play-area\s*\{[^}]*#f7f8fb/s);
  assert.match(styles, /\.gasbox-hero\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(280px,\s*0\.72fr\)/s);
  assert.match(styles, /\.gasbox-signal-card\s*\{[^}]*linear-gradient\(135deg,\s*#ffffff 0%,\s*#eefcf7 52%,\s*#fff7ed 100%\)/s);
  assert.match(styles, /\.gasbox-player-route\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(styles, /\.gasbox-market-empty \.neo-card__content\s*\{/);
  assert.match(styles, /\.gasbox-safety-card \.neo-card__content\s*\{/);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.gasbox-hero[\s\S]*grid-template-columns:\s*1fr/s);
  assert.match(styles, /@media \(max-width: 760px\)[\s\S]*\.gasbox-player-route[\s\S]*grid-template-columns:\s*1fr/s);

  assertOnlyZeroLetterSpacing(styles);
  assert.doesNotMatch(styles, /text-transform:\s*uppercase/);
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /radial-gradient/i);
  assert.doesNotMatch(styles, /border-radius:\s*(?:2[0-9]|[3-9][0-9])px/);
});
