import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const appRoot = fileURLToPath(new URL("../../../apps/last-survivor/", import.meta.url));
const read = (path) => readFileSync(new URL(path, `file://${appRoot}/`), "utf8");

test("Last Survivor ships one Phaser-first arena with direct shared imports", () => {
  const wrapper = read("src/PhaserPlayArea.tsx");
  const scene = read("src/scenes/LastSurvivorScene.ts");
  const main = read("src/main.tsx");

  assert.match(wrapper, /LazyPhaserGameComponent/);
  assert.match(wrapper, /@shared\/components-react\/v2\/PlayStage/);
  assert.doesNotMatch(wrapper, /from ["']@shared\/components-react\/v2["']/);
  assert.match(scene, /extends BaseScene/);
  assert.match(main, /playArea:\s*PhaserPlayArea/);
  assert.doesNotMatch(`${wrapper}\n${scene}\n${main}`, /three(?:\.js)?|ThreeGameComponent/);
});

test("Last Survivor fails closed on unknown reads and journals every wallet write", () => {
  const composable = read("src/composables/useLastSurvivor.ts");
  const journal = read("src/logic/pending-purchase-store.ts");
  const rpc = read("src/logic/last-survivor-rpc.ts");
  const main = read("src/main.tsx");

  assert.match(composable, /function strictBigInt/);
  assert.doesNotMatch(composable, /using local formula/);
  assert.match(composable, /requireBoundContext\(true\)/);
  assert.match(composable, /getMiniAppContractHash/);
  assert.match(composable, /confirmOperationReadback/);
  assert.match(composable, /kind:\s*"deposit"/);
  assert.match(composable, /kind:\s*"purchase"/);
  assert.match(composable, /kind:\s*"settle"/);
  assert.match(composable, /kind:\s*"withdraw"/);
  assert.match(journal, /assertAvailable/);
  assert.match(journal, /pending-operation\/v2/);
  assert.match(rpc, /method: "getapplicationlog"/);
  assert.match(rpc, /state: "fault"/);
  assert.match(main, /actions\.register\("recoverTransaction"/);
});

test("Last Survivor keeps paid entry closed until the current wallet matrix is verified", () => {
  const runtimeManifest = read("src/manifest.ts");
  const publicManifest = read("neo-manifest.json");
  const main = read("src/main.tsx");

  assert.match(runtimeManifest, /supportsGameFi:\s*false/);
  assert.match(runtimeManifest, /gamefi:\s*false/);
  assert.equal(JSON.parse(publicManifest).platform.transactions, false);
  assert.match(main, /NEW_PAID_ROUNDS_ENABLED\s*=\s*false/);
});
