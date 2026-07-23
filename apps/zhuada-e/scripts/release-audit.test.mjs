import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { defaultRoot, runReleaseAudit } from "./release-audit.mjs";

const requiredFiles = [
  "package.json",
  "neo-manifest.json",
  "src/logic/themes.ts",
  "src/logic/game-rules.ts",
  "src/logic/engine-zhuada.test.ts",
  "src/logic/guest-engine.test.ts",
  "src/logic/item-stream.ts",
  "src/logic/item-stream.test.ts",
  "src/logic/tray-motion.ts",
  "src/logic/shake-dynamics.ts",
  "src/logic/use-device-shake.test.tsx",
  "src/logic/motion-quality.test.ts",
  "src/scenes/scene-motion.ts",
  "src/scenes/physics-profiles.test.ts",
  "src/scenes/pick-lock.test.ts",
  "src/scenes/model-cache.test.ts",
  "src/main.tsx",
  "src/manifest.ts",
  "src/PlayArea.tsx",
  "src/PlayArea.scss",
  "src/ThreeGameComponent.tsx",
  "src/ThreeGameComponent.test.tsx",
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

  it("rejects weakened 3D model quality guardrails", () => {
    const overrides = baselineOverrides();
    overrides["src/scenes/model-cache.test.ts"] =
      overrides["src/scenes/model-cache.test.ts"].replace(
        "keeps every production 3D item as a layered multi-material mesh with a pick proxy",
        "keeps model cache working",
      );
    expectAuditFailure(overrides, "keeps every production 3D item as a layered multi-material mesh with a pick proxy");
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

  it("rejects weakened fresh-redeal gameplay guardrails", () => {
    const overrides = baselineOverrides();
    overrides["src/logic/guest-engine.test.ts"] =
      overrides["src/logic/guest-engine.test.ts"].replace(
        "survives twenty consecutive late-level redeals without exceeding the live-body ceiling",
        "survives late-level redeals",
      );
    expectAuditFailure(overrides, "survives twenty consecutive late-level redeals without exceeding the live-body ceiling");
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
      overrides["REFERENCE-VIDEO-AUDIT.md"].replace("入槽与分组动画采用 692ms 可读节奏", "入槽动画建议 220–380ms");
    expectAuditFailure(overrides, "入槽与分组动画采用 692ms 可读节奏");
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

  it("rejects a late guest reload that can cancel an immediate start or resume", () => {
    const overrides = baselineOverrides();
    overrides["src/main.tsx"] = overrides["src/main.tsx"].replace(
      "if (!isPlaying.get()) guest.enter();",
      "guest.enter();",
    );
    expectAuditFailure(overrides, "if (!isPlaying.get()) guest.enter()");
  });

  it("rejects stale design QA motion timings", () => {
    const overrides = baselineOverrides();
    overrides["design-qa.md"] =
      overrides["design-qa.md"].replace(
        "普通入槽/归组采用 692ms 可读节奏",
        "普通入槽约 534ms",
      );
    expectAuditFailure(overrides, "普通入槽/归组采用 692ms 可读节奏");
  });

  it("rejects shortened tray entry motion tokens", () => {
    const overrides = baselineOverrides();
    overrides["src/PlayArea.scss"] =
      overrides["src/PlayArea.scss"].replace("--goose-tray-entry-ms: 692ms", "--goose-tray-entry-ms: 360ms");
    expectAuditFailure(overrides, "--goose-tray-entry-ms: 692ms");
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
      overrides["src/main.tsx"].replace("import.meta.env.DEV &&\n      typeof window", "true &&\n      typeof window");
    expectAuditFailure(overrides, "must DEV-gate simulator QA setup autostart behind ?simQa=1");
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
});
