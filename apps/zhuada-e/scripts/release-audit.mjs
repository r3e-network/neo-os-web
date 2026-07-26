#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { fileURLToPath } from "node:url";

export const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function createRead(root, overrides = {}) {
  return function read(relative) {
    if (Object.prototype.hasOwnProperty.call(overrides, relative)) return overrides[relative];
    return fs.readFileSync(path.join(root, relative), "utf8");
  };
}

function json(read, relative) {
  return JSON.parse(read(relative));
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

function includes(read, relative, phrase) {
  invariant(read(relative).includes(phrase), `${relative} missing required phrase: ${phrase}`);
}

function matches(read, relative, pattern, message) {
  invariant(pattern.test(read(relative)), `${relative} ${message}`);
}

function notIncludes(read, relative, phrase) {
  invariant(!read(relative).includes(phrase), `${relative} contains forbidden stale phrase: ${phrase}`);
}

export function runReleaseAudit({ root = defaultRoot, overrides = {} } = {}) {
  const read = createRead(root, overrides);
  const packageJson = json(read, "package.json");
  const manifest = json(read, "neo-manifest.json");

  // Release command composition. Tests/builds prove correctness; this audit
  // guards product-level promises that are otherwise easy to drop during polish.
  invariant(packageJson.scripts["release:audit"] === "node scripts/release-audit.mjs",
    "package.json must expose release:audit");
  invariant(packageJson.scripts["device-qa:verify"] === "node scripts/verify-device-qa-report.mjs",
    "package.json must expose device-qa:verify");
  invariant(packageJson.scripts["device-qa:verify-suite"] === "node scripts/verify-device-qa-suite.mjs",
    "package.json must expose device-qa:verify-suite");
  invariant(packageJson.scripts["simulator-qa:verify"] === "node scripts/verify-simulator-qa-evidence.mjs",
    "package.json must expose simulator-qa:verify");
  invariant(packageJson.scripts["device-qa:init"] === "node scripts/init-device-qa-evidence.mjs",
    "package.json must expose device-qa:init");
  invariant(packageJson.scripts["device-qa:env"] === "node scripts/verify-device-qa-env.mjs",
    "package.json must expose device-qa:env");
  invariant(packageJson.scripts["bundle:verify:device-qa"] === "node scripts/verify-device-qa-bundle.mjs",
    "package.json must expose bundle:verify:device-qa");
  invariant(packageJson.scripts["bundle:verify"] === "node scripts/verify-production-bundle.mjs",
    "package.json must expose bundle:verify");
  invariant(packageJson.scripts["bundle:budget"] === "node scripts/verify-bundle-budget.mjs",
    "package.json must expose bundle:budget");
  invariant(packageJson.scripts["dist:digest"] === "node scripts/digest-dist.mjs",
    "package.json must expose dist:digest");
  invariant(packageJson.scripts["dist:stage"] === "node scripts/sync-staged-dist.mjs",
    "package.json must expose dist:stage");
  invariant(packageJson.scripts["staged:verify"] === "node scripts/verify-staged-dist.mjs",
    "package.json must expose staged:verify");
  invariant(packageJson.scripts["shims:verify"] === "node scripts/verify-vendored-shims.mjs",
    "package.json must expose shims:verify");
  invariant(!packageJson.scripts["geese:generate"],
    "package.json must not ship the obsolete procedural portrait generator");
  invariant(packageJson.scripts["prebuild"] === "npm run art:generate && npm run audio:generate",
    "npm run build must use the prebuild lifecycle to regenerate art/audio");
  invariant(packageJson.scripts["build"]?.startsWith("npm run assets:verify && tsc --noEmit"),
    "build must verify regenerated assets and type-check before bundling");
  invariant(packageJson.scripts["build"]?.endsWith("&& vite build"),
    "build must finish with the production Vite bundle");
  invariant(packageJson.scripts["build:device-qa"]?.includes("VITE_DEVICE_QA=1"),
    "build:device-qa must produce the instrumented QA bundle");
  invariant(packageJson.scripts["build:device-qa"]?.startsWith("npm run device-qa:env && npm run prebuild && npm run assets:verify"),
    "build:device-qa must regenerate and verify art/audio before bundling after validating the build id");
  invariant(packageJson.scripts["build:device-qa"]?.endsWith("&& npm run bundle:verify:device-qa"),
    "build:device-qa must verify the instrumented QA bundle after bundling");
  invariant(packageJson.scripts["verify:release"]?.includes("npm run release:audit"),
    "verify:release must include release:audit");
  invariant(packageJson.scripts["verify:release"]?.startsWith("npm test && npm run lint"),
    "verify:release must start with tests and lint");
  invariant(packageJson.scripts["verify:release"]?.includes("npm run shims:verify"),
    "verify:release must include vendored shim verification");
  invariant(packageJson.scripts["verify:release"]?.includes("node scripts/tune.mjs"),
    "verify:release must include the 24-level balance audit");
  invariant(packageJson.scripts["verify:release"]?.includes("npm audit --omit=dev"),
    "verify:release must include production dependency audit");
  invariant(packageJson.scripts["verify:release"]?.includes("npm run build"),
    "verify:release must include the production build");
  invariant(packageJson.scripts["verify:release"]?.includes("npm run bundle:verify"),
    "verify:release must include bundle:verify after the production build");
  invariant(packageJson.scripts["verify:release"]?.includes("npm run bundle:budget"),
    "verify:release must include bundle budget checks after the production build");
  invariant(packageJson.scripts["verify:release"]?.includes("npm run dist:digest"),
    "verify:release must print a dist digest after the production build");
  invariant(packageJson.scripts["verify:release"]?.includes("npm run dist:stage && npm run staged:verify"),
    "verify:release must synchronize the generated dist before staged host parity verification");
  invariant(packageJson.scripts["verify:release"]?.includes("npm run staged:verify"),
    "verify:release must include staged host parity verification after the production build");

  // Storefront/product boundary: original presentation, not commercial branding.
  invariant(manifest.name === "Goose Basket Shuffle", "manifest English name drifted");
  invariant(manifest.name_zh === "鹅篮翻翻乐", "manifest Chinese name drifted");
  invariant(manifest.features?.offlineSupport === false, "offline support must not be advertised");
  invariant(manifest.description.includes("three complete themes"), "manifest must mention three complete themes");
  invariant(manifest.description.includes("7-slot tray"), "manifest must mention seven-slot tray");
  invariant(manifest.description.includes("shake your phone"), "manifest must mention phone shake");
  invariant(manifest.description.includes("twenty-four levels"), "manifest must match the 24-level rules catalog");
  invariant(!manifest.name.includes("抓大鹅") && !manifest.name_zh.includes("抓大鹅"),
    "storefront name must not use the commercial game name");
  matches(read, "src/manifest.ts", /const simulatorQaDirectPlay =[\s\S]*import\.meta\.env\.DEV[\s\S]*get\("simQa"\) === "1"[\s\S]*directPlay: simulatorQaDirectPlay/,
    "must keep simulator QA direct play behind DEV ?simQa=1");

  // Core playable-system promises from the objective.
  matches(read, "src/logic/themes.ts", /export const GAME_THEMES[\s\S]*fresh-market[\s\S]*farm-kitchen[\s\S]*night-market/,
    "must keep all three selectable themes");
  includes(read, "src/logic/themes.ts", "export const THEME_ITEM_COUNT = 54");
  includes(read, "src/logic/themes.ts", "modelKind: baseKind");
  includes(read, "src/logic/themes.ts", "assetKind: baseKind");
  includes(read, "src/logic/themes.ts", "chipHueDeg");
  for (const prefix of ["fresh", "farm", "night"]) {
    const baseBlock = read("src/logic/themes.ts").match(
      new RegExp(`const ${prefix}BaseItems:[\\s\\S]*?\\n\\];`),
    )?.[0] ?? "";
    const itemBlock = read("src/logic/themes.ts").match(
      new RegExp(`const ${prefix}Items:[\\s\\S]*?\\n\\];`),
    )?.[0] ?? "";
    invariant((baseBlock.match(/nameKey:/g) ?? []).length === 18, `${prefix}BaseItems must keep exactly 18 authored silhouettes`);
    invariant((baseBlock.match(/sizeBand:/g) ?? []).length === 18, `${prefix}BaseItems must keep size metadata for all 18 authored silhouettes`);
    invariant((baseBlock.match(/silhouette:/g) ?? []).length === 18, `${prefix}BaseItems must keep silhouette metadata for all 18 authored silhouettes`);
    invariant((baseBlock.match(/lookalikeFamily:/g) ?? []).length === 18, `${prefix}BaseItems must keep near-match family metadata for all 18 authored silhouettes`);
    invariant((itemBlock.match(/colorVariant\(/g) ?? []).length === 36, `${prefix}Items must keep exactly 36 authored color-variant identities`);
  }
  includes(read, "src/logic/themes.test.ts", "near-match families");
  includes(read, "src/logic/scenes.ts", "export const SCENE_KIND_POOL_SIZE = 48");
  includes(read, "src/logic/game-rules.ts", "Logical runs grow from 18 to");
  includes(read, "src/logic/game-rules.ts", "1,584 items");
  includes(read, "src/logic/game-rules.ts", "export const MAX_LOGICAL_ITEMS");
  includes(read, "src/logic/game-rules.ts", "item-stream.ts cycles 18–45 live Cannon bodies");
  includes(read, "src/PlayArea.tsx", 't("levelScopeValue", { kinds: levelSpec.kinds, total: levelItemTotal })');
  includes(read, "src/ThemeItemChip.tsx", "String(safeKind).padStart(2, \"0\")");
  includes(read, "src/ThemeItemChip.tsx", "--goose-item-hue");
  includes(read, "src/ThemeItemChip.tsx", "data-variant-index");
  includes(read, "src/scenes/physics-profiles.ts", "variantFactor");
  includes(read, "src/logic/themes.ts", "baseKind * 137.508");
  includes(read, "src/logic/themes.test.ts", "must not collapse into one palette");
  includes(read, "scripts/generate-art.mjs", ".modulate({");
  includes(read, "scripts/generate-art.mjs", "baseKind * 137.508");
  includes(read, "src/scenes/farm-kitchen-models.ts", "bottle-cap-crown");
  includes(read, "src/ThreeGameComponent.test.tsx", "uses the logical full-body colorway asset without an extra marker filter");
  includes(read, "src/logic/game-rules.ts", "randomizedSpecOf");
  includes(read, "src/logic/game-rules.ts", "isBalancedDealComposition");
  includes(read, "src/logic/progress.test.ts", "guarantees rich big/small, silhouette and near-colour composition for every theme");
  includes(read, "src/logic/progress.test.ts", "keeps the tutorial subset and every full challenge order varied across replays");
  includes(read, "src/logic/item-stream.ts", "reserve");
  includes(read, "src/logic/item-stream.test.ts", "keeps hundreds of logical items while exposing only the mobile physics budget");
  includes(read, "src/logic/item-stream.test.ts", "keeps complete triple counts inside the initial pile and every refill wave");
  includes(read, "src/logic/item-stream.test.ts", "opens L2 with eighteen identities, six paired near-match families, and 30 later kinds");
  includes(read, "src/logic/item-stream.test.ts", "opens $id with eighteen identities, fourteen small, two medium and two large bodies");
  includes(read, "src/logic/item-stream.ts", "const usedFamilies = new Set<string>()");
  includes(read, "src/logic/item-stream.ts", "!usedFamilies.has");
  includes(read, "src/logic/item-stream.test.ts", "reshuffles the eighteen opening identities and their treatments across fresh runs");
  includes(read, "src/logic/item-stream.ts", "chooseOpeningTreatments");
  includes(read, "src/logic/item-stream.test.ts", "keeps every randomized $id opening spread across broad colour families");
  includes(read, "src/logic/item-stream.ts", "spreadOpeningPackets");
  includes(read, "src/logic/item-stream.test.ts", "separates identical opening triples across the pile instead of spawning free clumps");
  includes(read, "src/logic/item-stream.test.ts", "waits for a visible deep excavation, then activates one substantial bottom-up layer");
  includes(read, "src/logic/guest-engine.test.ts", "increments for every start/retry and publishes a different layout");
  includes(read, "src/logic/guest-engine.test.ts", "accepts the expanded kind catalog in resumable run snapshots");
  includes(read, "src/logic/guest-engine.ts", "Number(item.kind) < THEME_ITEM_COUNT");
  includes(read, "src/logic/guest-engine.test.ts", "keeps a 1,008-item level behind a dense 54-body window and refills from below");
  includes(read, "src/logic/guest-engine.test.ts", "accepts the 1,584-item late-game reservoir but rejects oversized snapshots");
  includes(read, "src/scenes/pile-density.test.ts", "keeps L2 challenge bodies tightly packed enough to create real overlap");
  includes(read, "src/scenes/pile-density.test.ts", "caps late-level floor growth instead of spreading the live budget into a sparse sheet");
  includes(read, "scripts/run-tests.mjs", "src/scenes/pile-density.test.ts");
  includes(read, "src/logic/guest-engine.test.ts", "drains every L%s reserve wave and wins only with box, reserve, tray and shelf empty");
  includes(read, "src/logic/guest-engine.test.ts", "survives twenty consecutive late-level redeals without exceeding the live-body ceiling");
  includes(read, "src/main.tsx", "if (!isPlaying.get()) guest.enter()");
  includes(read, "src/logic/guest-engine.test.ts", "keeps reserve packets private across shuffle and consumes bottom spawn commands once");
  includes(read, "src/logic/engine-zhuada.test.ts", "clears cross-zone with SHELF copies first (2 shelf + 1 landing)");
  includes(read, "src/logic/engine-zhuada.test.ts", "parks the first 3 occupied tray slots in order");
  includes(read, "src/logic/engine-zhuada.test.ts", "is unavailable while the shelf is occupied");
  includes(read, "src/logic/engine-zhuada.test.ts", "can never create a triple (cross-zone counts stay ≤2)");
  includes(read, "src/logic/engine-zhuada.test.ts", "random playthroughs with mid-run removes end clean on every scene band");
  includes(read, "src/logic/guest-engine.test.ts", "undo restores the same active id once without pulling from the reserve");
  includes(read, "src/logic/guest-engine.test.ts", "allows exactly one recovery feather for a failed run");
  includes(read, "src/logic/guest-engine.test.ts", "returns three jammed tray items to the logical stream when recovering");
  includes(read, "src/logic/guest-engine.test.ts", "expires a jammed run when the tray fills after remove and undo are exhausted");
  includes(read, "src/logic/guest-engine.test.ts", "does not apply win or failure progression twice after reaching a terminal state");
  includes(read, "src/logic/guest-engine.test.ts", "deletes the active-run snapshot as soon as a run fails");
  includes(read, "src/logic/guest-engine.test.ts", "keeps timed foreground countdown drift under 250ms across a 60s run");
  includes(read, "src/logic/guest-engine.test.ts", "pauses timed countdown while hidden and resumes without charging background time");
  includes(read, "src/logic/guest-engine.test.ts", "grants original-trio tools plus hint, and keeps add-time timed-only");
  includes(read, "src/logic/guest-engine.test.ts", "keeps hint unavailable states free and increments the hint pulse only when spent");
  includes(read, "src/logic/guest-engine.test.ts", "charges shuffle only when a live pile exists and invalidates undo targeting");
  includes(read, "src/logic/guest-engine.test.ts", "charges remove only for a free shelf and at least three occupied tray slots");
  includes(read, "src/logic/guest-engine.test.ts", "charges undo only for the last unmatched grab and returns the same item id once");
  includes(read, "src/logic/guest-engine.test.ts", "keeps add-time inert in relaxed mode and bounded to positive timed uses");
  includes(read, "src/logic/tray-motion.ts", "approach");
  includes(read, "src/logic/tray-motion.ts", "highlight");
  includes(read, "src/logic/tray-motion.ts", "compacting");
  includes(read, "src/logic/shake-dynamics.ts", "Math.max(0.65, Math.min(1.35");
  includes(read, "src/logic/use-device-shake.test.tsx", "requires an explicit permission button before enabling phone motion");
  includes(read, "src/logic/use-device-shake.test.tsx", "marks motion as blocked when Android Chrome exposes DeviceMotionEvent but never delivers events");
  includes(read, "src/logic/use-device-shake.test.tsx", "ignores sensor events while inactive or hidden and removes the listener on cleanup");
  includes(read, "scripts/run-tests.mjs", "src/logic/use-device-shake.test.tsx");
  includes(read, "src/scenes/scene-motion.ts", "panTossMs");
  includes(read, "src/logic/motion-quality.test.ts", "keeps tray movement compositor-friendly and naturally eased");
  includes(read, "src/logic/motion-quality.test.ts", "keeps UI controls and shelf clear animations on the shared smooth motion system");
  includes(read, "src/logic/motion-quality.test.ts", "keeps rapid picks visually queued instead of interrupting tray choreography");
  includes(read, "src/logic/motion-quality.test.ts", "keeps 3D tray flight on the same smooth handoff contract as the tray");
  includes(read, "src/AnimatedTray.test.tsx", "queues a second receipt until the first tray choreography settles");
  includes(read, "src/scenes/pick-lock.test.ts", "allows rapid different-item picks while the tray choreography queues receipts");
  includes(read, "src/scenes/pick.ts", "visible authored surface");
  includes(read, "src/scenes/pick-raycast.test.ts", "never lets an oversized invisible proxy steal a tap from a visible surface");
  includes(read, "src/scenes/physics-profiles.test.ts", "visible size ratio");
  includes(read, "src/scenes/physics-profiles.test.ts", "collider size ratio");
  includes(read, "src/scenes/physics-profiles.test.ts", "matches the opening night-market colliders to the round lantern and necked bottle");
  includes(read, "src/logic/motion-quality.test.ts", "moves a tall-phone pile down into the reference composition without shifting desktop");
  includes(read, "src/scenes/ZhuaDaScene.ts", "globally lock the pile");
  includes(read, "scripts/run-tests.mjs", "src/scenes/pick-lock.test.ts");
  includes(read, "scripts/run-tests.mjs", "src/scenes/pick-raycast.test.ts");
  includes(read, "src/logic/motion-quality.test.ts", "Math.pow(1 - e, SCENE_MOTION.panDampingPower)");
  includes(read, "src/PlayArea.scss", "--goose-tray-entry-ms: 692ms");
  includes(read, "src/PlayArea.scss", "--goose-tray-grouping-ms: 620ms");
  includes(read, "src/PlayArea.scss", "--goose-tray-highlight-ms: 240ms");
  includes(read, "src/PlayArea.scss", "--goose-tray-clear-ms: 420ms");
  includes(read, "src/PlayArea.scss", "--goose-tray-compact-ms: 460ms");
  includes(read, "src/PlayArea.scss", "--goose-motion-soft");
  includes(read, "src/PlayArea.scss", "animation: goose-shelf-clear 420ms var(--goose-motion-pop) both");
  includes(read, "src/scenes/scene-motion.ts", "popMiniMs: 420");
  includes(read, "src/scenes/scene-motion.ts", "popBurstMs: 560");
  includes(read, "src/scenes/scene-motion.ts", "panDampingPower: 1.7");
  matches(read, "src/main.tsx", /if \(import\.meta\.env\.DEV\) \{[\s\S]*app\.actions\.register\("debugWin"[\s\S]*app\.actions\.register\("debugLose"[\s\S]*app\.actions\.register\("debugShake"/,
    "must DEV-gate playtest debug actions");
  matches(read, "src/main.tsx", /const simulatorQaParams = import\.meta\.env\.DEV && typeof window !== "undefined"[\s\S]{0,180}new URLSearchParams\(window\.location\.search\)[\s\S]*if \(\s*import\.meta\.env\.DEV &&\s*simulatorQaParams\?\.get\("simQa"\) === "1"[\s\S]*app\.mode\.set\("guest"\)[\s\S]*guest\.startLevel\(progress\.get\(\)\.lastPlayedLevel \|\| 1\)/,
    "must DEV-gate simulator QA setup autostart behind ?simQa=1");
  matches(read, "src/main.tsx", /simulatorQaParams[\s\S]*get\("simTheme"\)[\s\S]*isGameThemeId\(simulatorQaTheme\)[\s\S]*createObservable<GameThemeId>\(initialThemeId\)/,
    "must resolve a validated simulator theme before the guest engine starts");
  matches(read, "src/PlayArea.tsx", /const debug = import\.meta\.env\.DEV &&[\s\S]*get\("debug"\) === "1"/,
    "must DEV-gate the playtest diagnostics panel");
  matches(read, "src/PlayArea.tsx", /if \(!import\.meta\.env\.DEV \|\| typeof window === "undefined"\) return;[\s\S]*simulatorQaAutoStartRef[\s\S]*get\("simQa"\) !== "1"[\s\S]*dispatch\("startLevel"/,
    "must DEV-gate simulator QA autostart behind ?simQa=1");
  matches(read, "src/PlayArea.tsx", /get\("simTheme"\)[\s\S]*isGameThemeId\(requestedTheme\)[\s\S]*dispatch\("setTheme", \{ id: requestedTheme \}\)[\s\S]*dispatch\("startLevel"/,
    "must validate simulator QA theme selection before autostart");
  matches(read, "src/ThreeGameComponent.tsx", /function forcesAndroidSimulatorFallback[\s\S]*!import\.meta\.env\.DEV[\s\S]*get\("simQa"\) === "1"[\s\S]*get\("androidFallback"\) === "1"/,
    "must DEV-gate the Android emulator fallback override");
  includes(read, "src/PlayArea.accessibility.test.tsx", "DEV simulator QA autostarts a level only behind ?simQa=1");
  includes(read, "src/PlayArea.accessibility.test.tsx", "DEV simulator QA selects a requested theme before autostarting");
  includes(read, "src/PlayArea.accessibility.test.tsx", "ignores invalid simulator theme ids and still starts the saved theme");
  includes(read, "src/ThreeGameComponent.tsx", "measuredStageFooterHeight");
  includes(read, "src/ThreeGameComponent.tsx", "MOBILE_FOOTER_SAFETY_PX");
  includes(read, "src/ThreeGameComponent.tsx", "ANDROID_CANVAS_SAMPLE_DELAY_MS");
  includes(read, "src/ThreeGameComponent.tsx", "isAndroidChromeRuntime");
  includes(read, "src/ThreeGameComponent.tsx", "canvasLooksBlank");
  includes(read, "src/ThreeGameComponent.tsx", "canvas.dataset.gooseFrameReady !== \"true\"");
  includes(read, "src/ThreeGameComponent.tsx", "canvas.dataset.gooseSoftwareRenderer === \"true\"");
  includes(read, "src/ThreeGameComponent.tsx", "scene.resume?.()");
  includes(read, "src/ThreeGameComponent.tsx", "Stop the hidden Three/Cannon loop");
  includes(read, "src/scenes/ZhuaDaScene.ts", "this.renderer.domElement.dataset.gooseFrameReady = \"true\"");
  includes(read, "src/scenes/ZhuaDaScene.ts", "gooseSoftwareRenderer");
  includes(read, "src/scenes/ZhuaDaScene.ts", "resume(): void");
  includes(read, "src/ThreeGameComponent.tsx", "goose-android-fallback__item");
  includes(read, "src/ThreeGameComponent.test.tsx", "sizes the mobile board from measured tray and tool footer height");
  includes(read, "src/ThreeGameComponent.test.tsx", "shows a real-asset Android fallback pile when Chrome renders a blank WebGL canvas");
  includes(read, "src/ThreeGameComponent.test.tsx", "keeps a healthy Android WebGL board through rapid item updates");
  includes(read, "src/ThreeGameComponent.test.tsx", "uses the compatibility pile when Android reports a software renderer");
  includes(read, "src/scenes/model-cache.test.ts", "keeps every production 3D item layered while merging authored parts into a mobile draw-call budget");
  includes(read, "src/scenes/model-cache.test.ts", "mobile draw-call budget");
  includes(read, "src/scenes/model-kit.ts", "goose-skin-v5:");
  includes(read, "src/scenes/model-kit.ts", "surfaceSkinVariant");
  includes(read, "src/scenes/night-market-models.ts", "geometry.setAttribute(\"uv\"");
  includes(read, "src/scenes/model-cache.test.ts", 'finishExamples.get("glaze")!.normalScale.x');
  includes(read, "src/scenes/models.ts", "mergeTemplateSurfaces");
  includes(read, "src/scenes/render-quality.test.ts", "keeps full illustrated lighting on normal phone GPUs");
  includes(read, "src/scenes/render-quality.test.ts", "uses a cheaper render path on SwiftShader without reducing gameplay bodies");
  includes(read, "src/scenes/render-quality.test.ts", "protects real low-memory four-core phones");
  includes(read, "src/scenes/render-quality.ts", "isSoftwareRendererLabel");
  includes(read, "src/scenes/render-quality.ts", "android emulator openGL ES translator");
  includes(read, "scripts/run-tests.mjs", "src/scenes/render-quality.test.ts");
  includes(read, "src/scenes/model-cache.test.ts", "keeps every visible production surface opaque so the basket never shows through");
  includes(read, "src/scenes/model-cache.test.ts", "seals every large lathe opening that used to expose the basket");
  includes(read, "src/scenes/model-cache.test.ts", "material variety");
  includes(read, "src/scenes/model-cache.test.ts", "mobile shadow budget");
  includes(read, "src/scenes/model-cache.test.ts", "keeps the first-run night-market models faithful to their approved item art");
  includes(read, "src/scenes/model-cache.test.ts", "builds the zongzi from layered leaf panels without marker-like cord or vein lines");
  includes(read, "src/scenes/model-cache.test.ts", "keeps rolling night-market circular faces recognizable without painted markers");
  includes(read, "src/scenes/model-cache.test.ts", "keeps fresh-market packages and cut food readable from both tumble faces");
  includes(read, "src/scenes/model-cache.test.ts", "keeps authored silhouettes free of identity-marker noise");
  includes(read, "src/scenes/model-cache.test.ts", "keeps farm-kitchen silhouettes clean after physics rolls them over");
  includes(read, "src/scenes/pile-dynamics.ts", "settleReadableFace");
  includes(read, "src/scenes/pile-dynamics.test.ts", "starts thin authored faces upward and physically corrects an edge-on rest");
  includes(read, "src/scenes/pile-dynamics.ts", "settleReadableUpright");
  includes(read, "src/scenes/pile-dynamics.test.ts", "keeps open cookware physically biased toward its authored top face");
  includes(read, "src/PlayArea.scss", ".goose-overlay__card[data-wide=\"true\"]::-webkit-scrollbar");
  includes(read, "src/PlayArea.scss", ".goose-android-fallback__basket");
  includes(read, "src/PlayArea.scss", "goose-android-fallback-shake");
  includes(read, "src/PlayArea.scss", ".goose-android-fallback__item img");
  includes(read, "src/PlayArea.scss", "max-height: min(100%, calc(100dvh - 16px))");
  includes(read, "src/PlayArea.scss", ".goose-theme-picker__head p");
  includes(read, "src/PlayArea.scss", "flex-basis: min(45%, 142px)");
  includes(read, "src/PlayArea.scss", "[data-game-status=\"idle\"]");
  includes(read, "src/PlayArea.accessibility.test.tsx", "keeps the in-game lobby immersive");
  includes(read, "src/PlayArea.accessibility.test.tsx", "keeps the active-run drawer visible in-stage on desktop and above mobile browser chrome");
  includes(read, "src/PlayArea.accessibility.test.tsx", "teaches the first level in-place and dismisses each lesson from real play state");
  includes(read, "src/PlayArea.accessibility.test.tsx", "turns a recoverable full tray into an assertive last-stand prompt");
  includes(read, "src/PlayArea.accessibility.test.tsx", "names terminal tray failure directly and offers a concrete recovery action");

  // Resource and audio completeness.
  includes(read, "scripts/verify-assets.mjs", "186 images");
  const assetVerifier = read("scripts/verify-assets.mjs");
  invariant((assetVerifier.match(/"ambient-/g) ?? []).length === 3,
    "verify-assets.mjs must check three ambience loops");
  for (const cue of ["land", "pick", "match", "combo", "win", "fail", "powerup", "shuffle", "click", "tick", "unlock", "shake"]) {
    invariant(assetVerifier.includes(`"${cue}"`), `verify-assets.mjs must check cue ${cue}`);
  }
  includes(read, "scripts/audio-quality.test.mjs", "keeps all gameplay SFX audible, unclipped, and duration-distinct");
  includes(read, "scripts/audio-quality.test.mjs", "unique waveform fingerprints");
  includes(read, "scripts/audio-quality.test.mjs", "theme ambience loops must be unique per theme");
  includes(read, "scripts/run-tests.mjs", "scripts/audio-quality.test.mjs");
  includes(read, "src/logic/sound.test.ts", "dense collision bursts collapse to one land cue instead of stacking dozens of thuds");
  includes(read, "src/logic/sound.test.ts", "stops gameplay voices immediately after muting an already-created context");
  includes(read, "scripts/image-quality.test.mjs", "keeps every item icon visible, padded, transparent, and visually detailed");
  includes(read, "scripts/image-quality.test.mjs", "162 runtime item icons unique");
  includes(read, "scripts/image-quality.test.mjs", "expected 25-68% visible subject coverage");
  includes(read, "scripts/run-tests.mjs", "scripts/image-quality.test.mjs");
  includes(read, "scripts/generate-art.mjs", "Array.from({ length: 9 }");
  includes(read, "scripts/verify-assets.mjs", "expected 23 PNG entries");
  includes(read, "README.md", "186 image");
  includes(read, "README.md", "15 PCM");
  includes(read, "README.md", "Long levels use a streamed bottom reservoir");
  includes(read, "README.md", "`npm run build` uses npm's `prebuild` lifecycle");
  includes(read, "README.md", "before the build script itself");

  // Compliance boundary from the user's referenced material.
  for (const phrase of [
    "does not specify a license",
    "CC 4.0 BY-SA",
    "Do not copy article code or assets",
    "Do not extract or reproduce art",
    "Commercial proprietary game",
  ]) {
    includes(read, "REFERENCE-IMPLEMENTATION-COMPLIANCE.md", phrase);
  }

  // Device-release chain: real hardware evidence is still required and must be
  // exported, bundled, and verified offline before unconditional production.
  includes(read, "src/logic/device-qa.ts", "buildDeviceQaEvidenceChecklist");
  includes(read, "src/logic/device-qa.ts", "DEVICE_QA_REQUIRED_THEME_IDS");
  includes(read, "src/logic/device-qa.ts", "DeviceQaFeedbackEvidence");
  includes(read, "src/logic/device-qa.ts", "DeviceQaStabilityEvidence");
  includes(read, "src/logic/device-qa.ts", "DEVICE_QA_REQUIRED_TRANSITION_EVENTS");
  includes(read, "src/logic/device-qa.ts", "DEVICE_QA_MAX_SINGLE_FRAME_MS = 80");
  includes(read, "src/logic/device-qa.ts", "DEVICE_QA_MAX_LONG_FRAME_PERCENT = 0.6");
  includes(read, "src/logic/device-qa.ts", "DEVICE_QA_MAX_JANK_BURST_FRAMES = 2");
  includes(read, "src/logic/device-qa.ts", "Longest foreground frame");
  includes(read, "src/logic/device-qa.ts", "Worst slow-frame burst");
  includes(read, "src/logic/device-qa.ts", "missingDeviceQaTransitionCoverage");
  includes(read, "src/logic/device-qa.ts", "restartResumeCycles");
  includes(read, "src/logic/device-qa.ts", "Memory/GPU timeline shows monotonic growth");
  includes(read, "src/DeviceQaPanel.test.tsx", "exports structured stability evidence from the in-game QA panel");
  includes(read, "scripts/run-tests.mjs", "src/DeviceQaPanel.test.tsx");
  includes(read, "src/logic/device-qa.ts", "qaAudioTestCount");
  includes(read, "src/logic/device-qa.ts", "qaHapticTestCount");
  includes(read, "src/logic/haptics.ts", "navigator.vibrate(0)");
  includes(read, "src/logic/haptics.ts", "shake: [18, 35, 28]");
  includes(read, "src/logic/haptics.test.ts", "maps every gameplay cue to the intended vibration pattern");
  includes(read, "src/logic/haptics.test.ts", "silently degrades on unsupported browsers such as iOS Safari");
  includes(read, "src/logic/haptics.test.ts", "browser vibration exception break gameplay");
  includes(read, "src/logic/device-qa.test.ts", "does not accept full-flow signoff unless all three themes are explicitly covered");
  includes(read, "src/logic/device-qa.test.ts", "requires runtime feedback proof in addition to manual audio and haptic signoff");
  includes(read, "src/logic/device-qa.test.ts", "requires transition evidence from real gameplay and feedback motion");
  includes(read, "src/logic/device-qa.test.ts", "requires long-session memory/GPU stability evidence");
  includes(read, "src/logic/device-qa.test.ts", "fails physical signoff on visible animation jank bursts");
  includes(read, "src/DeviceQaPanel.tsx", "复制证据包清单");
  includes(read, "src/DeviceQaPanel.tsx", "长局稳定性");
  includes(read, "src/DeviceQaPanel.tsx", "最长帧");
  includes(read, "src/DeviceQaPanel.tsx", "长帧");
  includes(read, "src/DeviceQaPanel.tsx", "memoryTimelineEvidence");
  includes(read, "src/DeviceQaPanel.tsx", "feedback-audio-test");
  includes(read, "src/DeviceQaPanel.tsx", "feedback-haptic-test");
  includes(read, "scripts/init-device-qa-evidence.mjs", "zhuada-e-device-qa-v1");
  includes(read, "scripts/init-device-qa-evidence.mjs", "audioContextState");
  includes(read, "scripts/init-device-qa-evidence.mjs", "requiredTransitionEvents");
  includes(read, "scripts/init-device-qa-evidence.mjs", "feedback-haptic-test when haptics are enabled");
  includes(read, "scripts/init-device-qa-evidence.mjs", "reserveCount > 0 and trayCount > 0");
  includes(read, "scripts/init-device-qa-evidence.mjs", "memory/GPU timeline");
  includes(read, "scripts/init-device-qa-evidence.mjs", "foreground frame continuity with no visible jank bursts");
  includes(read, "scripts/init-device-qa-evidence.mjs", "20 start/retry/exit/resume cycles");
  includes(read, "scripts/init-device-qa-evidence.mjs", "device-report.template.json");
  includes(read, "scripts/init-device-qa-evidence.mjs", "fresh-market\", \"farm-kitchen\", \"night-market");
  includes(read, "scripts/init-device-qa-evidence.mjs", "--strict-evidence-files");
  includes(read, "scripts/init-device-qa-evidence.test.mjs", "creates a physical-device QA evidence skeleton without passing the run");
  includes(read, "scripts/init-device-qa-evidence.test.mjs", "Required runtime transitions");
  includes(read, "scripts/run-tests.mjs", "scripts/init-device-qa-evidence.test.mjs");
  includes(read, "scripts/run-tests.mjs", "scripts/digest-dist.test.mjs");
  includes(read, "scripts/digest-dist.mjs", "dist tree digest");
  includes(read, "scripts/digest-dist.mjs", "sorted relative file manifest");
  includes(read, "scripts/verify-device-qa-env.mjs", "VITE_BUILD_SHA must be set to the real git commit SHA");
  includes(read, "scripts/verify-device-qa-env.mjs", "7-40 character hexadecimal git commit SHA");
  includes(read, "scripts/verify-device-qa-env.test.mjs", "rejects the runtime placeholder build id");
  includes(read, "scripts/run-tests.mjs", "scripts/verify-device-qa-env.test.mjs");
  includes(read, "scripts/run-tests.mjs", "scripts/verify-device-qa-report.test.mjs");
  includes(read, "scripts/verify-device-qa-report.mjs", "TARGET_MEDIAN_FPS = 55");
  includes(read, "scripts/verify-device-qa-report.mjs", "MAX_SINGLE_FRAME_MS = 80");
  includes(read, "scripts/verify-device-qa-report.mjs", "MAX_LONG_FRAME_PERCENT = 0.6");
  includes(read, "scripts/verify-device-qa-report.mjs", "MAX_JANK_BURST_FRAMES = 2");
  includes(read, "scripts/verify-device-qa-report.mjs", "function requireNumber");
  includes(read, "scripts/verify-device-qa-report.mjs", "is missing or not a finite number");
  includes(read, "scripts/verify-device-qa-report.test.mjs", "rejects reports without runtime feedback proof");
  includes(read, "scripts/verify-device-qa-report.test.mjs", "rejects reports without long-session memory/GPU stability evidence");
  includes(read, "scripts/verify-device-qa-report.test.mjs", "rejects visible animation jank");
  includes(read, "scripts/verify-device-qa-report.test.mjs", "reports missing foreground jank fields as missing evidence instead of Infinity failures");
  includes(read, "scripts/verify-device-qa-report.test.mjs", "rejects unstable memory or restart trends");
  includes(read, "scripts/verify-device-qa-report.mjs", "feedback runtime evidence is missing");
  includes(read, "scripts/verify-device-qa-report.mjs", "stability evidence is missing");
  includes(read, "scripts/verify-device-qa-report.mjs", "Memory/GPU timeline evidence file not found");
  includes(read, "scripts/verify-device-qa-report.mjs", "Device QA audio test button");
  includes(read, "scripts/verify-device-qa-report.mjs", "Device QA haptic test button");
  includes(read, "scripts/verify-device-qa-report.mjs", "REQUIRED_TRANSITION_EVENTS");
  includes(read, "scripts/verify-device-qa-report.mjs", "Transition coverage missing");
  includes(read, "scripts/verify-device-qa-report.mjs", "phone-like CSS viewport");
  includes(read, "scripts/verify-device-qa-report.test.mjs", "rejects desktop-sized viewports");
  includes(read, "scripts/verify-device-qa-report.test.mjs", "rejects reports without real gameplay transition coverage");
  includes(read, "scripts/verify-device-qa-suite.mjs", "iOS/Safari");
  includes(read, "scripts/verify-device-qa-suite.mjs", "Android/Chrome");
  includes(read, "scripts/verify-device-qa-suite.mjs", "phoneViewport");
  includes(read, "scripts/verify-device-qa-suite.mjs", "--strict-evidence-files");
  includes(read, "scripts/verify-device-qa-suite.test.mjs", "accepts one strict iOS/Safari and one strict Android/Chrome report");
  includes(read, "scripts/verify-device-qa-suite.test.mjs", "rejects missing iOS coverage");
  includes(read, "scripts/verify-device-qa-suite.test.mjs", "does not accept desktop Safari as iOS hardware coverage");
  includes(read, "scripts/verify-device-qa-suite.test.mjs", "does not accept non-Chrome Android WebView as Android Chrome coverage");
  includes(read, "scripts/verify-device-qa-suite.test.mjs", "does not accept an iPhone-labeled report captured at desktop viewport size");
  includes(read, "scripts/run-tests.mjs", "scripts/verify-device-qa-suite.test.mjs");
  includes(read, "scripts/verify-simulator-qa-evidence.mjs", "zhuada-e-simulator-qa-v1");
  includes(read, "scripts/verify-simulator-qa-evidence.mjs", "tray count increasing");
  includes(read, "scripts/verify-simulator-qa-evidence.mjs", "androidFallbackActive");
  includes(read, "scripts/verify-simulator-qa-evidence.mjs", "networkBridge");
  includes(read, "scripts/verify-simulator-qa-evidence.test.mjs", "accepts adb reverse when the dev server only listens on host localhost");
  includes(read, "scripts/verify-simulator-qa-evidence.test.mjs", "rejects missing Android localhost bridge evidence");
  includes(read, "scripts/verify-simulator-qa-evidence.test.mjs", "accepts iOS plus Android playable simulator evidence");
  includes(read, "scripts/verify-simulator-qa-evidence.test.mjs", "rejects Android evidence that does not prove a pick changed the tray");
  includes(read, "scripts/run-tests.mjs", "scripts/verify-simulator-qa-evidence.test.mjs");
  includes(read, "scripts/verify-device-qa-report.mjs", "TARGET_FRAME_MS = 25");
  includes(read, "scripts/verify-device-qa-report.mjs", "REQUIRED_THEME_IDS");
  includes(read, "scripts/verify-production-bundle.mjs", "dist/");
  includes(read, "scripts/verify-production-bundle.mjs", "DeviceQaPanel");
  includes(read, "scripts/verify-production-bundle.mjs", "debugWin");
  includes(read, "scripts/verify-production-bundle.mjs", "html|js|css|json");
  includes(read, "scripts/verify-production-bundle.mjs", "requiredProductionFiles");
  includes(read, "scripts/verify-production-bundle.mjs", "Array.from({ length: 9 }");
  includes(read, "scripts/verify-production-bundle.mjs", "production bundle missing required asset");
  includes(read, "scripts/verify-production-bundle.mjs", "production runtime leak");
  includes(read, "scripts/verify-production-bundle.test.mjs", "requires all nine collection-goose portraits in a production bundle");
  includes(read, "scripts/verify-production-bundle.test.mjs", "scans production CSS so Device QA panel styles cannot leak");
  includes(read, "scripts/verify-production-bundle.test.mjs", "rejects a production dist missing any required art, audio, manifest, or notice file");
  includes(read, "scripts/run-tests.mjs", "scripts/verify-production-bundle.test.mjs");
  includes(read, "scripts/verify-device-qa-bundle.mjs", "dist-device-qa/");
  includes(read, "scripts/verify-device-qa-bundle.mjs", "DeviceQaPanel");
  includes(read, "scripts/verify-device-qa-bundle.mjs", "requiredProductionFiles");
  includes(read, "scripts/verify-device-qa-bundle.mjs", "Device QA bundle missing required asset");
  includes(read, "scripts/verify-device-qa-bundle.mjs", "zhuada-e-device-qa-v1");
  includes(read, "scripts/verify-device-qa-bundle.mjs", "zhuada-e:device-qa-render");
  includes(read, "scripts/verify-device-qa-bundle.mjs", "debugWin");
  includes(read, "scripts/verify-device-qa-bundle.mjs", "playtest shortcut");
  includes(read, "scripts/verify-device-qa-bundle.mjs", "MAX_QA_SCENE_GZIP_BYTES");
  includes(read, "scripts/verify-device-qa-bundle.mjs", "MAX_DEVICE_QA_PANEL_GZIP_BYTES");
  includes(read, "scripts/verify-device-qa-bundle.mjs", "three-render");
  includes(read, "scripts/verify-device-qa-bundle.mjs", "physics-engine");
  includes(read, "scripts/verify-device-qa-bundle.test.mjs", "rejects a QA bundle missing any required art, audio, manifest, or notice file");
  includes(read, "scripts/run-tests.mjs", "scripts/verify-device-qa-bundle.test.mjs");
  includes(read, "scripts/verify-vendored-shims.mjs", "sourceMappingURL");
  includes(read, "scripts/verify-vendored-shims.mjs", "noble-(?:hashes|curves)");
  includes(read, "../vite.shared.react.ts", "three-render");
  includes(read, "../vite.shared.react.ts", "physics-engine");
  includes(read, "../vite.shared.react.ts", "configResolved(config)");
  includes(read, "../vite.shared.react.ts", "resolvedOutDir = config.build.outDir");
  includes(read, "vite.config.ts", "chunkSizeWarningLimit: 560");
  includes(read, "scripts/verify-bundle-budget.mjs", "MAX_SCENE_GZIP_BYTES");
  includes(read, "scripts/verify-bundle-budget.mjs", "MAX_THREE_GZIP_BYTES");
  includes(read, "scripts/verify-bundle-budget.mjs", "MAX_PHYSICS_GZIP_BYTES");
  includes(read, "scripts/verify-bundle-budget.mjs", "three-render");
  includes(read, "scripts/verify-bundle-budget.mjs", "physics-engine");
  includes(read, "scripts/sync-staged-dist.mjs", "refusing to replace unexpected staged directory");
  includes(read, "scripts/sync-staged-dist.mjs", "dist/ is empty; refusing to stage an empty release");
  includes(read, "scripts/sync-staged-dist.test.mjs", "replaces stale host files with the exact current dist tree");
  includes(read, "scripts/run-tests.mjs", "scripts/sync-staged-dist.test.mjs");
  includes(read, "scripts/verify-staged-dist.mjs", "platform/host-app/public/miniapps/zhuada-e");
  includes(read, "scripts/verify-staged-dist.mjs", "crypto.createHash(\"sha256\")");
  includes(read, "scripts/verify-staged-dist.mjs", "missing staged file");
  includes(read, "scripts/verify-staged-dist.mjs", "extra staged file");
  includes(read, "PRODUCTION-READINESS.md", "CONDITIONAL RELEASE CANDIDATE");
  includes(read, "PRODUCTION-READINESS.md", "npm run device-qa:verify");
  includes(read, "PRODUCTION-READINESS.md", "npm run device-qa:init");
  includes(read, "PRODUCTION-READINESS.md", "npm run bundle:verify:device-qa");
  includes(read, "PRODUCTION-READINESS.md", "npm run device-qa:verify-suite");
  includes(read, "PRODUCTION-READINESS.md", "iOS/Safari");
  includes(read, "PRODUCTION-READINESS.md", "Android/Chrome");
  includes(read, "PRODUCTION-READINESS.md", "--strict-evidence-files");
  includes(read, "PRODUCTION-READINESS.md", "runtime transition coverage");
  includes(read, "PRODUCTION-READINESS.md", "`motion-signal`");
  includes(read, "README.md", "runtime transition");
  includes(read, "README.md", "structured stability evidence");
  includes(read, "README.md", "stability.memoryTimelineEvidence");
  includes(read, "README.md", "longest foreground frame at or");
  includes(read, "README.md", "slow-frame burst at or below 2 frames");
  includes(read, "README.md", "memoryTrend=flat");
  includes(read, "PRODUCTION-READINESS.md", "fresh-market`, `farm-kitchen`, and `night-market");
  includes(read, "PRODUCTION-READINESS.md", "VITE_BUILD_SHA=<git-sha> npm run build:device-qa");
  includes(read, "PRODUCTION-READINESS.md", "`build:device-qa` first rejects missing, placeholder, or non-hex");
  includes(read, "PRODUCTION-READINESS.md", "deterministic art/audio regeneration through the `prebuild` lifecycle");
  includes(read, "PRODUCTION-READINESS.md", "`npm run build:device-qa` regenerates the deterministic art/audio bank");
  includes(read, "PRODUCTION-READINESS.md", "vendored-shim hygiene");
  includes(read, "PRODUCTION-READINESS.md", "gzip bundle budget");
  includes(read, "PRODUCTION-READINESS.md", "npm run dist:digest");
  includes(read, "PRODUCTION-READINESS.md", "npm run staged:verify");
  includes(read, "PRODUCTION-READINESS.md", "staged host parity");
  includes(read, "PRODUCTION-READINESS.md", "package, `neo-manifest.json`, and runtime `APP_VERSION`");
  includes(read, "PRODUCTION-READINESS.md", "Device QA entry, scene");
  includes(read, "PRODUCTION-READINESS.md", "structured stability evidence");
  includes(read, "PRODUCTION-READINESS.md", "`stability` block must record at least 20 start/retry/exit/resume cycles");
  includes(read, "PRODUCTION-READINESS.md", "`stability.memoryTimelineEvidence` pointing to the local");
  includes(read, "PRODUCTION-READINESS.md", "longest foreground frame ≤80ms");
  includes(read, "PRODUCTION-READINESS.md", "worst consecutive slow-frame burst ≤2 frames");
  includes(read, "PRODUCTION-READINESS.md", "`memoryTrend=flat`, `restartSlowdown=none`, and");
  includes(read, "PRODUCTION-READINESS.md", "Do not paste a dist digest into this document");
  includes(read, "PRODUCTION-READINESS.md", "Do not preserve hard-coded test counts here");
  includes(read, "PRODUCTION-READINESS.md", "all 24 levels draining to solved");
  includes(read, "PRODUCTION-READINESS.md", "18–1,584 logical objects");
  includes(read, "PRODUCTION-READINESS.md", "186 checked production images");
  includes(read, "PRODUCTION-READINESS.md", "nine transparent goose portraits");
  includes(read, "README.md", "18–1,584");
  includes(read, "README.md", "all 186 image dimensions/alpha requirements");
  includes(read, "SIMULATOR-QA.md", "does not replace the physical Device QA release gate");
  includes(read, "SIMULATOR-QA.md", "npm run simulator-qa:verify");
  includes(read, "SIMULATOR-QA.md", "tray count");
  includes(read, "SIMULATOR-QA.md", "positive non-empty render marker");
  includes(read, "SIMULATOR-QA.md", "emergency real-asset pile remains available for true blank boot");
  notIncludes(read, "PRODUCTION-READINESS.md", "d40bbbf67c9da54944c8ee41144519362823909383ad44b6fe2f142689384f9a");
  notIncludes(read, "PRODUCTION-READINESS.md", "22 test files / 152 tests");
  notIncludes(read, "PRODUCTION-READINESS.md", "catalog versions are all");
  notIncludes(read, "PRODUCTION-READINESS.md", "staged/source manifest version parity");
  notIncludes(read, "PRODUCTION-READINESS.md", "74b817781e56aaa3350cefd1a13ee5341e25e642568f4a08a91afe6a84d7e7d1");
  notIncludes(read, "PRODUCTION-READINESS.md", "22052940ef19f3c1d37c9f02ee7f2dca25c376b3a4ba78016983e1f424c94e0f");
  includes(read, "REFERENCE-VIDEO-AUDIT.md", "入槽与分组动画采用 692ms 可读节奏");
  includes(read, "REFERENCE-VIDEO-AUDIT.md", "三消完整编舞约 1812ms");
  includes(read, "REFERENCE-VIDEO-AUDIT.md", "前台 60s 漂移 ≤250ms，隐藏页不扣后台时间");
  includes(read, "REFERENCE-VIDEO-AUDIT.md", "不可用不扣次数、可用时扣次数并触发 nonce/状态变化");
  includes(read, "REFERENCE-VIDEO-AUDIT.md", "显式授权按钮、Android 无事件 blocked 降级、后台/暂停忽略传感器、卸载清理监听器");
  includes(read, "REFERENCE-VIDEO-AUDIT.md", "36 次密集落地只保留一次落地声");
  includes(read, "design-qa.md", "普通入槽/归组采用 692ms 可读节奏");
  includes(read, "design-qa.md", "总视觉编舞约 1812ms");
  includes(read, "design-qa.md", "420ms 镜头微震、820ms 颠锅回弹");
  notIncludes(read, "design-qa.md", "普通入槽约 534ms");
  notIncludes(read, "design-qa.md", "总视觉段约 1.29s");
  notIncludes(read, "design-qa.md", "360ms 镜头微震、720ms 颠锅回弹");
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  runReleaseAudit();
  console.log("Release audit passed: product completeness, compliance, resources, motion and Device QA gates are wired.");
}
