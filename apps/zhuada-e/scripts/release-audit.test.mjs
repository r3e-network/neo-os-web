import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { defaultRoot, runReleaseAudit } from "./release-audit.mjs";

const requiredFiles = [
  "package.json",
  "neo-manifest.json",
  "src/logic/themes.ts",
  "src/logic/scenes.ts",
  "src/logic/game-rules.ts",
  "src/logic/progress.test.ts",
  "src/logic/engine-zhuada.test.ts",
  "src/logic/guest-engine.test.ts",
  "src/logic/item-stream.ts",
  "src/logic/item-stream.test.ts",
  "src/logic/tray-motion.ts",
  "src/logic/shake-dynamics.ts",
  "src/logic/use-device-shake.test.tsx",
  "src/logic/motion-quality.test.ts",
  "src/scenes/scene-motion.ts",
  "src/scenes/ZhuaDaScene.ts",
  "src/scenes/pile-dynamics.ts",
  "src/scenes/pile-dynamics.test.ts",
  "src/scenes/pile-density.test.ts",
  "src/scenes/pick.ts",
  "src/scenes/pick-raycast.test.ts",
  "src/scenes/physics-profiles.test.ts",
  "src/scenes/pick-lock.test.ts",
  "src/scenes/model-kit.ts",
  "src/scenes/model-cache.test.ts",
  "src/scenes/models.ts",
  "src/scenes/render-quality.ts",
  "src/scenes/render-quality.test.ts",
  "src/main.tsx",
  "src/manifest.ts",
  "src/PlayArea.tsx",
  "src/PlayArea.scss",
  "src/PlayArea.accessibility.test.tsx",
  "src/ThreeGameComponent.tsx",
  "src/ThreeGameComponent.test.tsx",
  "src/ThemeItemChip.tsx",
  "scripts/generate-art.mjs",
  "scripts/verify-assets.mjs",
  "scripts/audio-quality.test.mjs",
  "scripts/image-quality.test.mjs",
  "README.md",
  "REFERENCE-IMPLEMENTATION-COMPLIANCE.md",
  "src/logic/device-qa.ts",
  "src/logic/device-qa.test.ts",
  "src/logic/sound.test.ts",
  "src/logic/haptics.ts",
  "src/logic/haptics.test.ts",
  "src/DeviceQaPanel.tsx",
  "src/DeviceQaPanel.test.tsx",
  "scripts/init-device-qa-evidence.mjs",
  "scripts/init-device-qa-evidence.test.mjs",
  "scripts/digest-dist.mjs",
  "scripts/digest-dist.test.mjs",
  "scripts/sync-staged-dist.mjs",
  "scripts/sync-staged-dist.test.mjs",
  "scripts/run-tests.mjs",
  "scripts/verify-device-qa-env.mjs",
  "scripts/verify-device-qa-env.test.mjs",
  "scripts/verify-production-bundle.test.mjs",
  "scripts/verify-device-qa-report.mjs",
  "scripts/verify-device-qa-report.test.mjs",
  "scripts/verify-device-qa-suite.mjs",
  "scripts/verify-device-qa-suite.test.mjs",
  "scripts/verify-simulator-qa-evidence.mjs",
  "scripts/verify-simulator-qa-evidence.test.mjs",
  "scripts/verify-production-bundle.mjs",
  "scripts/verify-device-qa-bundle.mjs",
  "scripts/verify-device-qa-bundle.test.mjs",
  "scripts/verify-vendored-shims.mjs",
  "scripts/verify-bundle-budget.mjs",
  "scripts/verify-staged-dist.mjs",
  "../vite.shared.react.ts",
  "vite.config.ts",
  "PRODUCTION-READINESS.md",
  "REFERENCE-VIDEO-AUDIT.md",
  "design-qa.md",
  "SIMULATOR-QA.md",
];

function baselineOverrides() {
  return Object.fromEntries(
    requiredFiles.map((relative) => [
      relative,
      fs.readFileSync(path.join(defaultRoot, relative), "utf8"),
    ]),
  );
}

function expectAuditFailure(overrides, expected) {
  assert.throws(
    () => runReleaseAudit({ overrides }),
    (error) => error instanceof Error && error.message.includes(expected),
  );
}

describe("release audit script", () => {
  it("accepts the current product completeness contract", () => {
    assert.doesNotThrow(() => runReleaseAudit({ overrides: baselineOverrides() }));
  });

  it("rejects commercial-game branding drift", () => {
    const overrides = baselineOverrides();
    const manifest = JSON.parse(overrides["neo-manifest.json"]);
    manifest.name_zh = "抓大鹅";
    overrides["neo-manifest.json"] = JSON.stringify(manifest);
    expectAuditFailure(overrides, "manifest Chinese name drifted");
  });

  it("rejects a missing selectable theme", () => {
    const overrides = baselineOverrides();
    overrides["src/logic/themes.ts"] = overrides["src/logic/themes.ts"].replaceAll("night-market", "night_market_removed");
    expectAuditFailure(overrides, "must keep all three selectable themes");
  });

  it("rejects weakened source/reference compliance boundaries", () => {
    const overrides = baselineOverrides();
    overrides["REFERENCE-IMPLEMENTATION-COMPLIANCE.md"] =
      overrides["REFERENCE-IMPLEMENTATION-COMPLIANCE.md"].replace("Do not extract or reproduce art", "Art reuse allowed");
    expectAuditFailure(overrides, "Do not extract or reproduce art");
  });

  it("rejects a missing offline Device QA verifier chain", () => {
    const overrides = baselineOverrides();
    const packageJson = JSON.parse(overrides["package.json"]);
    delete packageJson.scripts["device-qa:verify"];
    overrides["package.json"] = JSON.stringify(packageJson);
    expectAuditFailure(overrides, "package.json must expose device-qa:verify");
  });

  it("rejects a missing Device QA evidence initializer chain", () => {
    const overrides = baselineOverrides();
    const packageJson = JSON.parse(overrides["package.json"]);
    delete packageJson.scripts["device-qa:init"];
    overrides["package.json"] = JSON.stringify(packageJson);
    expectAuditFailure(overrides, "package.json must expose device-qa:init");
  });

  it("rejects missing haptic feedback guardrails", () => {
    const overrides = baselineOverrides();
    overrides["src/logic/haptics.test.ts"] =
      overrides["src/logic/haptics.test.ts"].replace(
        "silently degrades on unsupported browsers such as iOS Safari",
        "basic haptics smoke test",
      );
    expectAuditFailure(overrides, "silently degrades on unsupported browsers such as iOS Safari");
  });

  it("rejects missing generated-audio quality guardrails", () => {
    const overrides = baselineOverrides();
    overrides["scripts/audio-quality.test.mjs"] =
      overrides["scripts/audio-quality.test.mjs"].replace(
        "keeps all gameplay SFX audible, unclipped, and duration-distinct",
        "checks generated audio exists",
      );
    expectAuditFailure(overrides, "keeps all gameplay SFX audible, unclipped, and duration-distinct");
  });

  it("rejects missing high-frequency audio pressure guardrails", () => {
    const overrides = baselineOverrides();
    overrides["src/logic/sound.test.ts"] =
      overrides["src/logic/sound.test.ts"].replace(
        "dense collision bursts collapse to one land cue instead of stacking dozens of thuds",
        "checks land cue smoke test",
      );
    expectAuditFailure(overrides, "dense collision bursts collapse to one land cue instead of stacking dozens of thuds");
  });

  it("rejects missing generated-image quality guardrails", () => {
    const overrides = baselineOverrides();
    overrides["scripts/image-quality.test.mjs"] =
      overrides["scripts/image-quality.test.mjs"].replace(
        "keeps every item icon visible, padded, transparent, and visually detailed",
        "checks generated images exist",
      );
    expectAuditFailure(overrides, "keeps every item icon visible, padded, transparent, and visually detailed");
  });

  it("rejects palette collapse between unrelated near-match families", () => {
    const runtimeOverrides = baselineOverrides();
    runtimeOverrides["src/logic/themes.ts"] =
      runtimeOverrides["src/logic/themes.ts"].replace("baseKind * 137.508", "0 * 137.508");
    expectAuditFailure(runtimeOverrides, "baseKind * 137.508");

    const iconOverrides = baselineOverrides();
    iconOverrides["scripts/generate-art.mjs"] =
      iconOverrides["scripts/generate-art.mjs"].replace("baseKind * 137.508", "0 * 137.508");
    expectAuditFailure(iconOverrides, "baseKind * 137.508");
  });

  it("rejects weakened 3D model quality guardrails", () => {
    const overrides = baselineOverrides();
    overrides["src/scenes/model-cache.test.ts"] =
      overrides["src/scenes/model-cache.test.ts"].replace(
        "keeps every production 3D item layered while merging authored parts into a mobile draw-call budget",
        "keeps model cache working",
      );
    expectAuditFailure(overrides, "keeps every production 3D item layered while merging authored parts into a mobile draw-call budget");
  });

  it("rejects flattening the material-specific skin hierarchy", () => {
    const overrides = baselineOverrides();
    overrides["src/scenes/model-kit.ts"] =
      overrides["src/scenes/model-kit.ts"].replace("goose-skin-v5:", "goose-skin-flat:");
    expectAuditFailure(overrides, "goose-skin-v5:");
  });

  it("rejects removal of low-end mobile and software-renderer quality guardrails", () => {
    const overrides = baselineOverrides();
    overrides["src/scenes/render-quality.test.ts"] =
      overrides["src/scenes/render-quality.test.ts"].replace(
        "uses a cheaper render path on SwiftShader without reducing gameplay bodies",
        "checks software rendering",
      );
    expectAuditFailure(overrides, "uses a cheaper render path on SwiftShader without reducing gameplay bodies");
  });

  it("rejects removal of the automatic Android emulator renderer classification", () => {
    const overrides = baselineOverrides();
    overrides["src/scenes/render-quality.ts"] =
      overrides["src/scenes/render-quality.ts"].replace(
        "android emulator openGL ES translator",
        "unrecognized emulator renderer",
      );
    expectAuditFailure(overrides, "android emulator openGL ES translator");
  });

  it("rejects missing approved-art fidelity guardrails for opening night-market items", () => {
    const overrides = baselineOverrides();
    overrides["src/scenes/model-cache.test.ts"] =
      overrides["src/scenes/model-cache.test.ts"].replace(
        "keeps the first-run night-market models faithful to their approved item art",
        "checks the first-run night models",
      );
    expectAuditFailure(overrides, "keeps the first-run night-market models faithful to their approved item art");
  });

  it("rejects missing two-sided circular-face detail guardrails", () => {
    const overrides = baselineOverrides();
    overrides["src/scenes/model-cache.test.ts"] =
      overrides["src/scenes/model-cache.test.ts"].replace(
        "keeps rolling night-market circular faces recognizable without painted markers",
        "checks circular faces",
      );
    expectAuditFailure(overrides, "keeps rolling night-market circular faces recognizable without painted markers");
  });

  it("rejects missing two-sided detail guardrails for the bright themes", () => {
    for (const title of [
      "keeps fresh-market packages and cut food readable from both tumble faces",
      "keeps farm-kitchen silhouettes clean after physics rolls them over",
    ]) {
      const overrides = baselineOverrides();
      overrides["src/scenes/model-cache.test.ts"] =
        overrides["src/scenes/model-cache.test.ts"].replace(title, "checks bright-theme details");
      expectAuditFailure(overrides, title);
    }
  });

  it("rejects missing collider fidelity guardrails for opening night-market items", () => {
    const overrides = baselineOverrides();
    overrides["src/scenes/physics-profiles.test.ts"] =
      overrides["src/scenes/physics-profiles.test.ts"].replace(
        "matches the opening night-market colliders to the round lantern and necked bottle",
        "checks the first-run night colliders",
      );
    expectAuditFailure(overrides, "matches the opening night-market colliders to the round lantern and necked bottle");
  });

  it("rejects weakened long-run streaming gameplay guardrails", () => {
    const overrides = baselineOverrides();
    overrides["src/logic/item-stream.test.ts"] =
      overrides["src/logic/item-stream.test.ts"].replace(
        "keeps complete triple counts inside the initial pile and every refill wave",
        "keeps refill smoke tests",
      );
    expectAuditFailure(overrides, "keeps complete triple counts inside the initial pile and every refill wave");
  });

  it("rejects weakened dense-pile geometry and 48-kind near-match streaming guardrails", () => {
    const densityOverrides = baselineOverrides();
    densityOverrides["src/scenes/pile-density.test.ts"] =
      densityOverrides["src/scenes/pile-density.test.ts"].replace(
        "keeps L2 challenge bodies tightly packed enough to create real overlap",
        "checks L2 dimensions",
      );
    expectAuditFailure(
      densityOverrides,
      "keeps L2 challenge bodies tightly packed enough to create real overlap",
    );

    const mixOverrides = baselineOverrides();
    mixOverrides["src/logic/item-stream.test.ts"] =
      mixOverrides["src/logic/item-stream.test.ts"].replace(
        "opens L2 with eighteen identities, six paired near-match families, and 30 later kinds",
        "checks L2 opening",
      );
    expectAuditFailure(
      mixOverrides,
      "opens L2 with eighteen identities, six paired near-match families, and 30 later kinds",
    );

    const sizeMixOverrides = baselineOverrides();
    sizeMixOverrides["src/logic/item-stream.test.ts"] =
      sizeMixOverrides["src/logic/item-stream.test.ts"].replace(
        "opens $id with eighteen identities, fourteen small, two medium and two large bodies",
        "checks L2 packet sizes",
      );
    expectAuditFailure(
      sizeMixOverrides,
      "opens $id with eighteen identities, fourteen small, two medium and two large bodies",
    );

    const familyDiversityOverrides = baselineOverrides();
    familyDiversityOverrides["src/logic/item-stream.ts"] =
      familyDiversityOverrides["src/logic/item-stream.ts"].replace(
        "const usedFamilies = new Set<string>()",
        "opening selection score",
      );
    expectAuditFailure(
      familyDiversityOverrides,
      "const usedFamilies = new Set<string>()",
    );

    const replayMixOverrides = baselineOverrides();
    replayMixOverrides["src/logic/item-stream.test.ts"] =
      replayMixOverrides["src/logic/item-stream.test.ts"].replace(
        "reshuffles the eighteen opening identities and their treatments across fresh runs",
        "checks opening variety",
      );
    expectAuditFailure(
      replayMixOverrides,
      "reshuffles the eighteen opening identities and their treatments across fresh runs",
    );

    const colourBalanceOverrides = baselineOverrides();
    colourBalanceOverrides["src/logic/item-stream.test.ts"] =
      colourBalanceOverrides["src/logic/item-stream.test.ts"].replace(
        "keeps every randomized $id opening spread across broad colour families",
        "checks opening colours",
      );
    expectAuditFailure(
      colourBalanceOverrides,
      "keeps every randomized $id opening spread across broad colour families",
    );

    const packetSpreadOverrides = baselineOverrides();
    packetSpreadOverrides["src/logic/item-stream.test.ts"] =
      packetSpreadOverrides["src/logic/item-stream.test.ts"].replace(
        "separates identical opening triples across the pile instead of spawning free clumps",
        "checks opening positions",
      );
    expectAuditFailure(
      packetSpreadOverrides,
      "separates identical opening triples across the pile instead of spawning free clumps",
    );
  });

  it("rejects weakened fresh-redeal gameplay guardrails", () => {
    const overrides = baselineOverrides();
    overrides["src/logic/guest-engine.test.ts"] =
      overrides["src/logic/guest-engine.test.ts"].replace(
        "survives twenty consecutive late-level redeals without exceeding the live-body ceiling",
        "survives late-level redeals",
      );
    expectAuditFailure(overrides, "survives twenty consecutive late-level redeals without exceeding the live-body ceiling");
  });

  it("rejects removal of balanced, replay-varying item composition guardrails", () => {
    const overrides = baselineOverrides();
    overrides["src/logic/themes.ts"] = overrides["src/logic/themes.ts"].replace(
      'sizeBand: "large"',
      'weightBand: "large"',
    );
    expectAuditFailure(overrides, "must keep size metadata for all 18 authored silhouettes");

    const replayOverrides = baselineOverrides();
    replayOverrides["src/logic/progress.test.ts"] = replayOverrides["src/logic/progress.test.ts"].replace(
      "keeps the tutorial subset and every full challenge order varied across replays",
      "keeps replay subsets valid",
    );
    expectAuditFailure(replayOverrides, "keeps the tutorial subset and every full challenge order varied across replays");
  });

  it("rejects weakened shelf rescue rule guardrails", () => {
    const overrides = baselineOverrides();
    overrides["src/logic/engine-zhuada.test.ts"] =
      overrides["src/logic/engine-zhuada.test.ts"].replace(
        "clears cross-zone with SHELF copies first (2 shelf + 1 landing)",
        "checks shelf smoke test",
      );
    expectAuditFailure(overrides, "clears cross-zone with SHELF copies first (2 shelf + 1 landing)");
  });

  it("rejects weakened failure recovery guardrails", () => {
    const overrides = baselineOverrides();
    overrides["src/logic/guest-engine.test.ts"] =
      overrides["src/logic/guest-engine.test.ts"].replace(
        "allows exactly one recovery feather for a failed run",
        "allows recovery",
      );
    expectAuditFailure(overrides, "allows exactly one recovery feather for a failed run");
  });

  it("rejects missing timed countdown pause and drift guardrails", () => {
    const overrides = baselineOverrides();
    overrides["src/logic/guest-engine.test.ts"] =
      overrides["src/logic/guest-engine.test.ts"].replace(
        "pauses timed countdown while hidden and resumes without charging background time",
        "pauses timed countdown smoke test",
      );
    expectAuditFailure(overrides, "pauses timed countdown while hidden and resumes without charging background time");
  });

  it("rejects weakened power-up boundary guardrails", () => {
    const overrides = baselineOverrides();
    overrides["src/logic/guest-engine.test.ts"] =
      overrides["src/logic/guest-engine.test.ts"].replace(
        "charges remove only for a free shelf and at least three occupied tray slots",
        "checks remove tool smoke test",
      );
    expectAuditFailure(overrides, "charges remove only for a free shelf and at least three occupied tray slots");
  });

  it("rejects missing phone shake permission and fallback guardrails", () => {
    const overrides = baselineOverrides();
    overrides["src/logic/use-device-shake.test.tsx"] =
      overrides["src/logic/use-device-shake.test.tsx"].replace(
        "marks motion as blocked when Android Chrome exposes DeviceMotionEvent but never delivers events",
        "checks motion smoke test",
      );
    expectAuditFailure(overrides, "marks motion as blocked when Android Chrome exposes DeviceMotionEvent but never delivers events");
  });

  it("rejects a missing Device QA suite verifier chain", () => {
    const overrides = baselineOverrides();
    const packageJson = JSON.parse(overrides["package.json"]);
    delete packageJson.scripts["device-qa:verify-suite"];
    overrides["package.json"] = JSON.stringify(packageJson);
    expectAuditFailure(overrides, "package.json must expose device-qa:verify-suite");
  });

  it("rejects a missing simulator QA evidence verifier chain", () => {
    const overrides = baselineOverrides();
    const packageJson = JSON.parse(overrides["package.json"]);
    delete packageJson.scripts["simulator-qa:verify"];
    overrides["package.json"] = JSON.stringify(packageJson);
    expectAuditFailure(overrides, "package.json must expose simulator-qa:verify");
  });

  it("rejects a missing Device QA build environment gate", () => {
    const overrides = baselineOverrides();
    const packageJson = JSON.parse(overrides["package.json"]);
    delete packageJson.scripts["device-qa:env"];
    packageJson.scripts["build:device-qa"] = packageJson.scripts["build:device-qa"].replace("npm run device-qa:env && ", "");
    overrides["package.json"] = JSON.stringify(packageJson);
    expectAuditFailure(overrides, "package.json must expose device-qa:env");
  });

  it("rejects a Device QA build that can use stale generated assets", () => {
    const overrides = baselineOverrides();
    const packageJson = JSON.parse(overrides["package.json"]);
    packageJson.scripts["build:device-qa"] = packageJson.scripts["build:device-qa"].replace("npm run prebuild && ", "");
    overrides["package.json"] = JSON.stringify(packageJson);
    expectAuditFailure(overrides, "build:device-qa must regenerate and verify art/audio before bundling");
  });

  it("rejects a Device QA build that skips instrumented bundle verification", () => {
    const overrides = baselineOverrides();
    const packageJson = JSON.parse(overrides["package.json"]);
    delete packageJson.scripts["bundle:verify:device-qa"];
    packageJson.scripts["build:device-qa"] = packageJson.scripts["build:device-qa"].replace(" && npm run bundle:verify:device-qa", "");
    overrides["package.json"] = JSON.stringify(packageJson);
    expectAuditFailure(overrides, "package.json must expose bundle:verify:device-qa");
  });

  it("rejects a production build that can ship stale generated resources", () => {
    const overrides = baselineOverrides();
    const packageJson = JSON.parse(overrides["package.json"]);
    delete packageJson.scripts["prebuild"];
    overrides["package.json"] = JSON.stringify(packageJson);
    expectAuditFailure(overrides, "npm run build must use the prebuild lifecycle to regenerate art/audio");
  });

  it("rejects art generation that leaves chapter-2 goose portraits stale", () => {
    const overrides = baselineOverrides();
    overrides["scripts/generate-art.mjs"] = overrides["scripts/generate-art.mjs"].replace(
      "Array.from({ length: 9 }",
      "Array.from({ length: 6 }",
    );
    expectAuditFailure(overrides, "Array.from({ length: 9 }");
  });

  it("rejects restoring the flat procedural portrait generator", () => {
    const overrides = baselineOverrides();
    const packageJson = JSON.parse(overrides["package.json"]);
    packageJson.scripts["geese:generate"] = "node scripts/generate-goose-portraits.mjs";
    overrides["package.json"] = JSON.stringify(packageJson);
    expectAuditFailure(overrides, "must not ship the obsolete procedural portrait generator");
  });

  it("rejects stale production-build resource lifecycle docs", () => {
    const overrides = baselineOverrides();
    overrides["README.md"] = overrides["README.md"].replace(
      "`npm run build` uses npm's `prebuild` lifecycle",
      "`npm run build` regenerates every runtime asset",
    );
    expectAuditFailure(overrides, "`npm run build` uses npm's `prebuild` lifecycle");
  });

  it("rejects stale release-gate resource lifecycle docs", () => {
    const overrides = baselineOverrides();
    overrides["PRODUCTION-READINESS.md"] = overrides["PRODUCTION-READINESS.md"].replace(
      "deterministic art/audio regeneration through the `prebuild` lifecycle",
      "deterministic art/audio regeneration",
    );
    expectAuditFailure(overrides, "deterministic art/audio regeneration through the `prebuild` lifecycle");
  });

  it("rejects stale README stability evidence docs", () => {
    const overrides = baselineOverrides();
    overrides["README.md"] = overrides["README.md"].replace(
      "structured stability evidence",
      "manual stability notes",
    );
    expectAuditFailure(overrides, "structured stability evidence");
  });

  it("rejects stale production stability evidence docs", () => {
    const overrides = baselineOverrides();
    overrides["PRODUCTION-READINESS.md"] = overrides["PRODUCTION-READINESS.md"].replace(
      "`stability` block must record at least 20 start/retry/exit/resume cycles",
      "`stability` block should summarize long-session testing",
    );
    expectAuditFailure(overrides, "`stability` block must record at least 20 start/retry/exit/resume cycles");
  });

  it("rejects a release command that skips tests or lint", () => {
    const overrides = baselineOverrides();
    const packageJson = JSON.parse(overrides["package.json"]);
    packageJson.scripts["verify:release"] = packageJson.scripts["verify:release"]
      .replace("npm test && npm run lint && ", "");
    overrides["package.json"] = JSON.stringify(packageJson);
    expectAuditFailure(overrides, "verify:release must start with tests and lint");
  });

  it("rejects a release command that skips balance audit", () => {
    const overrides = baselineOverrides();
    const packageJson = JSON.parse(overrides["package.json"]);
    packageJson.scripts["verify:release"] = packageJson.scripts["verify:release"]
      .replace(" && node scripts/tune.mjs", "");
    overrides["package.json"] = JSON.stringify(packageJson);
    expectAuditFailure(overrides, "verify:release must include the 24-level balance audit");
  });

  it("rejects a release command that skips production dependency audit", () => {
    const overrides = baselineOverrides();
    const packageJson = JSON.parse(overrides["package.json"]);
    packageJson.scripts["verify:release"] = packageJson.scripts["verify:release"]
      .replace(" && npm audit --omit=dev", "");
    overrides["package.json"] = JSON.stringify(packageJson);
    expectAuditFailure(overrides, "verify:release must include production dependency audit");
  });

  it("rejects a release command that skips vendored shim verification", () => {
    const overrides = baselineOverrides();
    const packageJson = JSON.parse(overrides["package.json"]);
    delete packageJson.scripts["shims:verify"];
    packageJson.scripts["verify:release"] = packageJson.scripts["verify:release"].replace(" && npm run shims:verify", "");
    overrides["package.json"] = JSON.stringify(packageJson);
    expectAuditFailure(overrides, "package.json must expose shims:verify");
  });

  it("rejects a release command that skips production bundle budgets", () => {
    const overrides = baselineOverrides();
    const packageJson = JSON.parse(overrides["package.json"]);
    delete packageJson.scripts["bundle:budget"];
    packageJson.scripts["verify:release"] = packageJson.scripts["verify:release"].replace(" && npm run bundle:budget", "");
    overrides["package.json"] = JSON.stringify(packageJson);
    expectAuditFailure(overrides, "package.json must expose bundle:budget");
  });

  it("rejects a release command that skips staged host parity verification", () => {
    const overrides = baselineOverrides();
    const packageJson = JSON.parse(overrides["package.json"]);
    delete packageJson.scripts["staged:verify"];
    packageJson.scripts["verify:release"] = packageJson.scripts["verify:release"].replace(" && npm run staged:verify", "");
    overrides["package.json"] = JSON.stringify(packageJson);
    expectAuditFailure(overrides, "package.json must expose staged:verify");
  });

  it("rejects a release command that skips the dist digest", () => {
    const overrides = baselineOverrides();
    const packageJson = JSON.parse(overrides["package.json"]);
    delete packageJson.scripts["dist:digest"];
    packageJson.scripts["verify:release"] = packageJson.scripts["verify:release"].replace(" && npm run dist:digest", "");
    overrides["package.json"] = JSON.stringify(packageJson);
    expectAuditFailure(overrides, "package.json must expose dist:digest");
  });

  it("rejects a release command that verifies stale staged files without syncing dist first", () => {
    const overrides = baselineOverrides();
    const packageJson = JSON.parse(overrides["package.json"]);
    delete packageJson.scripts["dist:stage"];
    packageJson.scripts["verify:release"] = packageJson.scripts["verify:release"].replace(" && npm run dist:stage", "");
    overrides["package.json"] = JSON.stringify(packageJson);
    expectAuditFailure(overrides, "package.json must expose dist:stage");
  });

  it("rejects weakened three-theme Device QA signoff", () => {
    const overrides = baselineOverrides();
    overrides["src/logic/device-qa.ts"] =
      overrides["src/logic/device-qa.ts"].replaceAll("DEVICE_QA_REQUIRED_THEME_IDS", "REQUIRED_THEMES_REMOVED");
    expectAuditFailure(overrides, "DEVICE_QA_REQUIRED_THEME_IDS");
  });

  it("rejects missing Device QA stability evidence guardrails", () => {
    const overrides = baselineOverrides();
    overrides["scripts/verify-device-qa-report.mjs"] =
      overrides["scripts/verify-device-qa-report.mjs"].replace(
        "stability evidence is missing",
        "stability smoke test",
      );
    expectAuditFailure(overrides, "stability evidence is missing");
  });

  it("rejects missing Device QA foreground jank guardrails", () => {
    const overrides = baselineOverrides();
    overrides["src/logic/device-qa.ts"] =
      overrides["src/logic/device-qa.ts"].replace(
        "DEVICE_QA_MAX_SINGLE_FRAME_MS = 80",
        "DEVICE_QA_MAX_SINGLE_FRAME_MS = 120",
      );
    expectAuditFailure(overrides, "DEVICE_QA_MAX_SINGLE_FRAME_MS = 80");
  });

  it("rejects missing offline verifier jank rejection coverage", () => {
    const overrides = baselineOverrides();
    overrides["scripts/verify-device-qa-report.test.mjs"] =
      overrides["scripts/verify-device-qa-report.test.mjs"].replace(
        "rejects visible animation jank",
        "accepts average frame metrics",
      );
    expectAuditFailure(overrides, "rejects visible animation jank");
  });

  it("rejects offline verifier jank missing-field regressions", () => {
    const overrides = baselineOverrides();
    overrides["scripts/verify-device-qa-report.test.mjs"] =
      overrides["scripts/verify-device-qa-report.test.mjs"].replace(
        "reports missing foreground jank fields as missing evidence instead of Infinity failures",
        "reports missing foreground jank fields",
      );
    expectAuditFailure(overrides, "reports missing foreground jank fields as missing evidence instead of Infinity failures");
  });

  it("rejects missing in-game stability export controls", () => {
    const overrides = baselineOverrides();
    overrides["src/DeviceQaPanel.tsx"] =
      overrides["src/DeviceQaPanel.tsx"].replaceAll(
        "memoryTimelineEvidence",
        "memoryTraceNote",
      );
    expectAuditFailure(overrides, "memoryTimelineEvidence");
  });

  it("rejects missing in-game stability export coverage", () => {
    const overrides = baselineOverrides();
    overrides["src/DeviceQaPanel.test.tsx"] =
      overrides["src/DeviceQaPanel.test.tsx"].replace(
        "exports structured stability evidence from the in-game QA panel",
        "renders the Device QA panel",
      );
    expectAuditFailure(overrides, "exports structured stability evidence from the in-game QA panel");
  });

  it("rejects stale motion acceptance documentation", () => {
    const overrides = baselineOverrides();
    overrides["REFERENCE-VIDEO-AUDIT.md"] =
      overrides["REFERENCE-VIDEO-AUDIT.md"].replace("入槽与分组动画采用 750ms 可读节奏", "入槽动画建议 220–380ms");
    expectAuditFailure(overrides, "入槽与分组动画采用 750ms 可读节奏");
  });

  it("rejects weakened rapid-pick input guardrails", () => {
    const overrides = baselineOverrides();
    overrides["src/scenes/pick-lock.test.ts"] =
      overrides["src/scenes/pick-lock.test.ts"].replace(
        "allows rapid different-item picks while the tray choreography queues receipts",
        "checks pick lock smoke test",
      );
    expectAuditFailure(overrides, "allows rapid different-item picks while the tray choreography queues receipts");
  });

  it("rejects invisible tap proxies stealing picks from visible objects", () => {
    const overrides = baselineOverrides();
    overrides["src/scenes/pick-raycast.test.ts"] =
      overrides["src/scenes/pick-raycast.test.ts"].replace(
        "never lets an oversized invisible proxy steal a tap from a visible surface",
        "checks proxy raycasts",
      );
    expectAuditFailure(
      overrides,
      "never lets an oversized invisible proxy steal a tap from a visible surface",
    );
  });

  it("rejects a late guest reload that can cancel an immediate start or resume", () => {
    const overrides = baselineOverrides();
    overrides["src/main.tsx"] = overrides["src/main.tsx"].replace(
      "if (!isPlaying.get()) guest.enter();",
      "guest.enter();",
    );
    expectAuditFailure(overrides, "if (!isPlaying.get()) guest.enter()");
  });

  it("rejects removal of the overhead-readable physical rest guard", () => {
    const overrides = baselineOverrides();
    overrides["src/scenes/pile-dynamics.ts"] =
      overrides["src/scenes/pile-dynamics.ts"].replace(
        "settleReadableFace",
        "settleUnreadableEdge",
      );
    expectAuditFailure(overrides, "settleReadableFace");
  });

  it("rejects removal of the authored-top cookware rest guard", () => {
    const overrides = baselineOverrides();
    // replaceAll, not replace: the token appears twice in pile-dynamics, so
    // rewriting only the first left the guard in place - the audit had nothing
    // to reject, and the mutation proved nothing while reporting a failure.
    overrides["src/scenes/pile-dynamics.ts"] =
      overrides["src/scenes/pile-dynamics.ts"].replaceAll(
        "settleReadableUpright",
        "settleUnreadableUnderside",
      );
    expectAuditFailure(overrides, "settleReadableUpright");
  });

  it("rejects stale design QA motion timings", () => {
    const overrides = baselineOverrides();
    overrides["design-qa.md"] =
      overrides["design-qa.md"].replace(
        "普通入槽/归组采用 750ms 可读节奏",
        "普通入槽约 534ms",
      );
    expectAuditFailure(overrides, "普通入槽/归组采用 750ms 可读节奏");
  });

  it("rejects shortened tray entry motion tokens", () => {
    const overrides = baselineOverrides();
    overrides["src/PlayArea.scss"] =
      overrides["src/PlayArea.scss"].replace("--goose-tray-entry-ms: 750ms", "--goose-tray-entry-ms: 360ms");
    expectAuditFailure(overrides, "--goose-tray-entry-ms: 750ms");
  });

  it("rejects removal of the production size-spectrum and portrait-composition gates", () => {
    const overrides = baselineOverrides();
    overrides["src/scenes/physics-profiles.test.ts"] = overrides["src/scenes/physics-profiles.test.ts"]
      .replace("visible size ratio", "uniform visible size");
    expectAuditFailure(overrides, "visible size ratio");

    const portraitOverrides = baselineOverrides();
    portraitOverrides["src/logic/motion-quality.test.ts"] = portraitOverrides["src/logic/motion-quality.test.ts"]
      .replace(
        "moves a tall-phone pile down into the reference composition without shifting desktop",
        "keeps the pile centered everywhere",
      );
    expectAuditFailure(portraitOverrides, "moves a tall-phone pile down into the reference composition without shifting desktop");
  });

  it("rejects removal of the mobile Safari drawer safe-area gate", () => {
    const overrides = baselineOverrides();
    overrides["src/PlayArea.accessibility.test.tsx"] = overrides["src/PlayArea.accessibility.test.tsx"]
      .replace(
        "keeps the active-run drawer visible in-stage on desktop and above mobile browser chrome",
        "keeps the active-run drawer in normal document flow",
      );
    expectAuditFailure(overrides, "keeps the active-run drawer visible in-stage on desktop and above mobile browser chrome");
  });

  it("rejects removal of the in-play first-level teaching flow", () => {
    const overrides = baselineOverrides();
    overrides["src/PlayArea.accessibility.test.tsx"] = overrides["src/PlayArea.accessibility.test.tsx"]
      .replace(
        "teaches the first level in-place and dismisses each lesson from real play state",
        "renders a static first-level hint",
      );
    expectAuditFailure(overrides, "teaches the first level in-place and dismisses each lesson from real play state");
  });

  it("rejects stale release evidence counts and build digests", () => {
    const overrides = baselineOverrides();
    overrides["PRODUCTION-READINESS.md"] =
      overrides["PRODUCTION-READINESS.md"].replace(
        "Do not preserve hard-coded test counts here; they drift as coverage is added.",
        "22 test files / 152 tests",
      );
    expectAuditFailure(overrides, "Do not preserve hard-coded test counts here");
  });

  it("rejects unsupported catalog-version release claims", () => {
    const overrides = baselineOverrides();
    overrides["PRODUCTION-READINESS.md"] =
      overrides["PRODUCTION-READINESS.md"].replace(
        "package, `neo-manifest.json`, and runtime `APP_VERSION` are all `3.1.0` and checked by `npm run assets:verify`.",
        "source, built, staged and catalog versions are all `3.1.0`.",
      );
    expectAuditFailure(overrides, "package, `neo-manifest.json`, and runtime `APP_VERSION`");
  });

  it("rejects stale level and resource counts in release documentation", () => {
    const overrides = baselineOverrides();
    overrides["PRODUCTION-READINESS.md"] = overrides["PRODUCTION-READINESS.md"]
      .replace("18–1,584 logical objects", "18–432 logical objects");
    expectAuditFailure(overrides, "18–1,584 logical objects");

    const readmeOverrides = baselineOverrides();
    readmeOverrides["README.md"] = readmeOverrides["README.md"]
      .replace("all 186 image dimensions/alpha requirements", "all 175 image dimensions/alpha requirements");
    expectAuditFailure(readmeOverrides, "186 image");
  });

  it("rejects playtest debug actions outside the dev-only branch", () => {
    const overrides = baselineOverrides();
    overrides["src/main.tsx"] =
      overrides["src/main.tsx"].replace("if (import.meta.env.DEV) {", "if (true) {");
    expectAuditFailure(overrides, "must DEV-gate playtest debug actions");
  });

  it("rejects simulator QA autostart outside the dev-only query gate", () => {
    const overrides = baselineOverrides();
    overrides["src/PlayArea.tsx"] =
      overrides["src/PlayArea.tsx"].replace("if (!import.meta.env.DEV || typeof window === \"undefined\") return;", "if (typeof window === \"undefined\") return;");
    expectAuditFailure(overrides, "must DEV-gate simulator QA autostart behind ?simQa=1");
  });

  it("rejects simulator QA direct play outside the dev-only query gate", () => {
    const overrides = baselineOverrides();
    overrides["src/manifest.ts"] =
      overrides["src/manifest.ts"].replace("import.meta.env.DEV &&", "true &&");
    expectAuditFailure(overrides, "must keep simulator QA direct play behind DEV ?simQa=1");
  });

  it("rejects simulator QA setup autostart outside the dev-only query gate", () => {
    const overrides = baselineOverrides();
    overrides["src/main.tsx"] =
      overrides["src/main.tsx"].replace(
        "const simulatorQaParams = import.meta.env.DEV &&",
        "const simulatorQaParams = true &&",
      );
    expectAuditFailure(overrides, "must DEV-gate simulator QA setup autostart behind ?simQa=1");
  });

  it("rejects a simulator theme applied after the guest engine has already started", () => {
    const overrides = baselineOverrides();
    overrides["src/main.tsx"] = overrides["src/main.tsx"].replace(
      "createObservable<GameThemeId>(initialThemeId)",
      "createObservable<GameThemeId>(loadThemePref())",
    );
    expectAuditFailure(overrides, "must resolve a validated simulator theme before the guest engine starts");
  });

  it("rejects an Android emulator fallback override outside the dev-only query gate", () => {
    const overrides = baselineOverrides();
    overrides["src/ThreeGameComponent.tsx"] = overrides["src/ThreeGameComponent.tsx"]
      .replace("if (!import.meta.env.DEV || typeof window === \"undefined\") return false;", "if (typeof window === \"undefined\") return false;");
    expectAuditFailure(overrides, "must DEV-gate the Android emulator fallback override");
  });

  it("rejects a missing production bundle verifier chain", () => {
    const overrides = baselineOverrides();
    const packageJson = JSON.parse(overrides["package.json"]);
    delete packageJson.scripts["bundle:verify"];
    packageJson.scripts["verify:release"] = packageJson.scripts["verify:release"].replace(" && npm run bundle:verify", "");
    overrides["package.json"] = JSON.stringify(packageJson);
    expectAuditFailure(overrides, "package.json must expose bundle:verify");
  });

  it("rejects a production bundle verifier that does not scan CSS", () => {
    const overrides = baselineOverrides();
    overrides["scripts/verify-production-bundle.mjs"] =
      overrides["scripts/verify-production-bundle.mjs"].replace("html|js|css|json", "html|js|json");
    expectAuditFailure(overrides, "html|js|css|json");
  });

  it("rejects a production bundle verifier without required static asset coverage", () => {
    const overrides = baselineOverrides();
    overrides["scripts/verify-production-bundle.mjs"] =
      overrides["scripts/verify-production-bundle.mjs"].replace(
        "production bundle missing required asset",
        "production bundle missing runtime chunk",
      );
    expectAuditFailure(overrides, "production bundle missing required asset");
  });

  it("rejects a production bundle verifier that omits chapter-2 goose portraits", () => {
    const overrides = baselineOverrides();
    overrides["scripts/verify-production-bundle.mjs"] =
      overrides["scripts/verify-production-bundle.mjs"].replace(
        "Array.from({ length: 9 }",
        "Array.from({ length: 6 }",
      );
    expectAuditFailure(overrides, "Array.from({ length: 9 }");
  });

  it("rejects a Device QA bundle verifier without required static asset coverage", () => {
    const overrides = baselineOverrides();
    overrides["scripts/verify-device-qa-bundle.mjs"] =
      overrides["scripts/verify-device-qa-bundle.mjs"].replace(
        "Device QA bundle missing required asset",
        "Device QA bundle missing runtime chunk",
      );
    expectAuditFailure(overrides, "Device QA bundle missing required asset");
  });

  it("rejects manifest copy logic that ignores CLI outDir overrides", () => {
    const overrides = baselineOverrides();
    overrides["../vite.shared.react.ts"] =
      overrides["../vite.shared.react.ts"].replace(
        "resolvedOutDir = config.build.outDir",
        "resolvedOutDir = \"dist\"",
      );
    expectAuditFailure(overrides, "resolvedOutDir = config.build.outDir");
  });

  it("rejects missing Android blank-WebGL fallback coverage", () => {
    const overrides = baselineOverrides();
    overrides["src/ThreeGameComponent.test.tsx"] =
      overrides["src/ThreeGameComponent.test.tsx"].replace(
        "shows a real-asset Android fallback pile when Chrome renders a blank WebGL canvas",
        "renders Android smoke fallback",
      );
    expectAuditFailure(overrides, "shows a real-asset Android fallback pile when Chrome renders a blank WebGL canvas");
  });

  it("rejects Android fallback probes that interrupt rapid live play", () => {
    const overrides = baselineOverrides();
    overrides["src/ThreeGameComponent.test.tsx"] =
      overrides["src/ThreeGameComponent.test.tsx"].replace(
        "keeps a healthy Android WebGL board through rapid item updates",
        "allows Android fallback probes after every item update",
      );
    expectAuditFailure(overrides, "keeps a healthy Android WebGL board through rapid item updates");

    const markerOverrides = baselineOverrides();
    markerOverrides["src/scenes/ZhuaDaScene.ts"] =
      markerOverrides["src/scenes/ZhuaDaScene.ts"].replace(
        "this.renderer.domElement.dataset.gooseFrameReady = \"true\"",
        "this.renderer.domElement.dataset.gooseFrameReady = \"false\"",
      );
    expectAuditFailure(markerOverrides, "this.renderer.domElement.dataset.gooseFrameReady = \"true\"");
  });

  it("rejects stale simulator conclusions that call healthy Android WebGL blank", () => {
    const overrides = baselineOverrides();
    overrides["SIMULATOR-QA.md"] = overrides["SIMULATOR-QA.md"].replace(
      "positive non-empty render marker",
      "transparent pixel readback",
    );
    expectAuditFailure(overrides, "positive non-empty render marker");
  });
});
