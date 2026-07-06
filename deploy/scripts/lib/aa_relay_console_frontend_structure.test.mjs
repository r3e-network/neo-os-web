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

  assert.match(playArea, /from "@shared\/components-react\/v2"/);
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

  assert.match(playArea, /className="relay-play-area mx2 mx2-cat-tool"/);
  assert.match(playArea, /className="relay-scene"/);
  assert.match(playArea, /className="relay-scene__board"/);
  assert.match(playArea, /className="relay-scene__account-panel"/);
  assert.match(playArea, /className="relay-scene__station-card"/);
  assert.match(playArea, /className="relay-scene__line-card"/);
  assert.match(playArea, /className="relay-scene__track"/);
  assert.match(playArea, /className="relay-drawer"/);
  assert.match(playArea, /drawerToggleLabel=\{t\("relayFlowLabel"\)\}/);
  assert.match(playArea, /drawer=\{\{ title: t\("relayFlowLabel"\), children: drawer \}\}/);

  assert.match(playArea, /function parseSponsor/);
  assert.match(playArea, /JSON\.parse\(draftPayload\)/);
  assert.match(playArea, /const submitReady = hasAa && payloadValid/);
  assert.match(playArea, /void dispatch\("checkSponsor", draftAa, draftDapp\)/);
  assert.match(playArea, /void dispatch\("requestSponsor", draftAa, draftDapp, draftAmount\)/);
  assert.match(playArea, /void dispatch\("submitRelay", draftAa, draftDapp, draftPayload\)/);
  assert.match(playArea, /disabled: !submitReady/);
  assert.match(playArea, /secondary: \[\{ label: t\("sponsorCheck"\), onClick: handleCheckSponsor, disabled: !hasAa \|\| busy \}\]/);
  assert.match(styles, /\.relay-play-area \.mx2-action-rail__row \.mx2-btn--primary:disabled/);
  assert.match(styles, /\.relay-scene\s*\{[^}]*background:\s*#ffffff/s);
  assert.match(styles, /\.relay-drawer\s*\{/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /radial-gradient/);
  assert.match(composable, /aa\.isCheckingSponsorship\.get\(\)/);
  assert.match(composable, /aa\.isRelaying\.get\(\)/);
  assert.doesNotMatch(
    composable,
    /get:\s*\(\)\s*=>\s*aa\.isCheckingSponsorship,/,
  );
  assert.doesNotMatch(composable, /get:\s*\(\)\s*=>\s*aa\.isRelaying,/);
  assert.match(messages, /relayHeroTitle/);
  assert.match(messages, /relayStageTitle/);
  assert.match(messages, /relaySubmitExplainer/);
  assert.match(messages, /payloadInvalid/);
  assert.match(messages, /sponsorBlocked/);
  assert.match(messages, /relayBlocked/);
});
