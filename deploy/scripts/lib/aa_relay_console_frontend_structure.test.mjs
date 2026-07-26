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

test("AA Relay Console exposes a guarded wallet-style relay workspace", () => {
  const playArea = read("apps/aa-relay-console/src/PlayArea.tsx");
  const styles = read("apps/aa-relay-console/src/PlayArea.scss");
  const composable = read(
    "apps/aa-relay-console/src/composables/useAARelayConsole.ts",
  );
  const messages = read("apps/aa-relay-console/src/locale/messages.ts");

  assert.match(playArea, /from "@shared\/components-react\/v2\/OpenUiLite"/);
  assert.match(playArea, /from "@shared\/components-react\/v2\/PlayStage"/);
  assert.match(playArea, /OpenUiProvider/);
  assert.match(playArea, /PlayStage/);
  assert.match(playArea, /OpenUiPanel/);
  assert.match(playArea, /OpenUiSegmented/);
  assert.match(playArea, /OpenUiTextArea/);
  assert.match(playArea, /OpenUiTextField/);
  assert.match(playArea, /const RELAY_STATION_ART = "aa-relay-station\.webp"/);
  assert.ok(
    fs.existsSync(path.join(ROOT, "apps/aa-relay-console/public/aa-relay-station.webp")),
    "AA relay scene art must ship with the miniapp",
  );

  assert.match(playArea, /className="aa-relay-play-area mx2 mx2-cat-tool"/);
  assert.match(playArea, /className="aa-relay-scene"/);
  assert.match(playArea, /className="aa-relay-scene__art"/);
  assert.match(playArea, /className="aa-relay-scene__workspace"/);
  assert.match(playArea, /className="aa-relay-scene__route"/);
  assert.match(playArea, /className="aa-relay-scene__lifecycle"/);
  assert.match(playArea, /className="aa-relay-drawer"/);
  assert.match(playArea, /drawerToggleLabel=\{t\("openJobWorkspace"\)\}/);
  assert.match(playArea, /drawer=\{\{ title: t\("jobWorkspace"\), children: drawer \}\}/);

  assert.match(playArea, /parseRelayDraft\(/);
  assert.match(playArea, /void dispatch\("prepareReview", draftAa, draftDapp, draftPayload\)/);
  assert.match(playArea, /void dispatch\("trackReceipt"\)/);
  assert.match(playArea, /void dispatch\("checkSponsor", draftAa, draftDapp, draftPayload\)/);
  assert.match(playArea, /void dispatch\("importReceipt", receiptDraft\)/);
  assert.match(playArea, /const primaryDisabled = busy \|\| \(!primaryTracks && !validation\.valid\)/);
  assert.match(styles, /\.aa-relay-scene\s*\{/);
  assert.match(styles, /\.aa-relay-drawer\s*\{/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /radial-gradient/);
  assert.match(composable, /type PersistedRelayJob/);
  assert.match(composable, /from "@shared\/utils\/safe-storage"/);
  assert.match(composable, /safeWriteStorage\(storageKey, JSON\.stringify\(snapshot\)\)/);
  assert.match(composable, /safeReadStorage\(storageKey\)/);
  assert.match(composable, /safeRemoveStorage\(storageKey\)/);
  assert.match(composable, /inspectRelayReceipt\(review, receipt, fetcher, now\(\)\)/);
  assert.match(composable, /async function loadAll\(\)/);
  assert.match(messages, /relayHeroTitle/);
  assert.match(messages, /relayStageTitle/);
  assert.match(messages, /reviewPackage:/);
  assert.match(messages, /requestInvalid/);
  assert.match(messages, /receiptRecovery/);
});
