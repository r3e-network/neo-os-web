import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");
const exists = (relativePath) => fs.existsSync(path.join(ROOT, relativePath));

test("Screw Sort keeps Phaser 3 and its real workshop assets as the play surface", () => {
  const entry = read("apps/screw-sort/src/PlayArea.tsx").trim();
  const wrapper = read("apps/screw-sort/src/PhaserPlayArea.tsx");
  const scene = read("apps/screw-sort/src/scenes/ScrewSortScene.ts");
  const main = read("apps/screw-sort/src/main.tsx");

  assert.equal(entry, 'export { default } from "./PhaserPlayArea";');
  assert.match(main, /import PhaserPlayArea from "\.\/PhaserPlayArea"/);
  assert.match(main, /playArea: PhaserPlayArea/);
  assert.match(main, /const ensureGuestMode = \(\): boolean =>/);
  assert.match(wrapper, /LazyPhaserGameComponent as PhaserGameComponent/);
  assert.match(wrapper, /import\("\.\/scenes\/ScrewSortScene"\)/);
  assert.match(scene, /extends BaseScene/);
  assert.match(scene, /BaseScene\.preloadAssets/);
  for (const asset of ["workshop.webp", "plank.webp", "screw.webp", "toolbox.webp", "overflow-tray.webp"]) {
    assert.ok(exists(`apps/screw-sort/public/art/${asset}`), asset);
    assert.match(scene, new RegExp(`\\./art/${asset.replace(".", "\\.")}`));
  }
  assert.doesNotMatch(`${wrapper}\n${scene}`, /from ["']three["']|new THREE\.|<input\b|<textarea\b|<select\b/);
});

test("Screw Sort presents an accepted engine revision instead of a timed success preview", () => {
  const wrapper = read("apps/screw-sort/src/PhaserPlayArea.tsx");
  const scene = read("apps/screw-sort/src/scenes/ScrewSortScene.ts");
  const requestStart = scene.indexOf("private requestScrewMove");
  const requestEnd = scene.indexOf("private releaseMoveLock", requestStart);
  const requestFlow = scene.slice(requestStart, requestEnd);
  const stateStart = scene.indexOf("protected onStateUpdate");
  const stateEnd = scene.indexOf("protected onBridgeError", stateStart);
  const stateFlow = scene.slice(stateStart, stateEnd);

  assert.match(wrapper, /moveRequestRevision/);
  assert.match(wrapper, /core\.revision > moveRequestRevision/);
  assert.match(wrapper, /aria-busy=\{movePending \|\| undefined\}/);
  assert.doesNotMatch(wrapper, /actionPreview|useTransientFlag|setTimeout\(/);
  assert.match(requestFlow, /this\.dispatch\("selectScrew", screw\.id\)/);
  assert.doesNotMatch(requestFlow, /delayedCall|this\.animate/);
  assert.match(stateFlow, /revisionChanged/);
  assert.match(stateFlow, /event\?\.kind === "move"/);
  assert.match(stateFlow, /this\.playMoveAnimation\(event, previous, session\)/);
  assert.doesNotMatch(scene, /startActionPreview|dispatchTimer/);
});

test("Screw Sort fails visibly recoverable while remaining wallet-free", () => {
  const engine = read("apps/screw-sort/src/logic/guest-engine.ts");
  const messages = read("apps/screw-sort/src/locale/messages.ts");
  const manifest = JSON.parse(read("apps/screw-sort/neo-manifest.json"));
  const sourceManifest = read("apps/screw-sort/src/manifest.ts");

  assert.match(engine, /statusStorageUnavailable/);
  assert.match(engine, /statusProgressReset/);
  assert.match(engine, /statusLeaderboardUnavailable/);
  assert.match(messages, /statusStorageUnavailable:/);
  assert.match(messages, /statusProgressReset:/);
  assert.match(messages, /statusLeaderboardUnavailable:/);
  assert.match(sourceManifest, /supportsGameFi: false/);
  assert.equal(manifest.version, "1.1.0");
  assert.equal(manifest.platform.transactions, false);
  assert.deepEqual(manifest.permissions, []);
  assert.deepEqual(manifest.operation_panel.operations, []);
  assert.equal(manifest.technologies.aa.enabled, false);
  assert.equal(manifest.technologies.oracle.enabled, false);
  assert.equal(manifest.technologies.tee.enabled, false);
  assert.doesNotMatch(engine, /\.chain\.|\.wallet\.|invoke\(|payAndCall/);
});
