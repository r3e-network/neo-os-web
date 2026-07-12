import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const script = path.join(root, "scripts", "verify-device-qa-suite.mjs");
const manualKeys = [
  "permissionFallback",
  "softShakeControlled",
  "strongShakeContained",
  "audioAudible",
  "hapticsVerified",
  "orientationSafe",
  "backgroundResume",
  "contextRecovery",
  "fullFlow",
];

function makeReport(deviceLabel, overrides = {}) {
  const manual = Object.fromEntries(manualKeys.map((key) => [
    key,
    {
      status: "pass",
      note: key === "fullFlow" ? "fresh-market farm-kitchen night-market full run" : "",
      evidence: `evidence/${key}/${key}.txt`,
    },
  ]));
  return {
    schema: "zhuada-e-device-qa-v1",
    verdict: "pass",
    failures: [],
    missingEvidence: [],
    privacy: "local-only; no automatic upload",
    appVersion: "3.1.0",
    buildId: "suite-build",
    sessionId: deviceLabel.replace(/\W+/g, "-").toLowerCase(),
    startedAt: "2026-07-11T00:00:00.000Z",
    generatedAt: "2026-07-11T00:01:01.000Z",
    runtime: {
      deviceLabel,
      userAgent: deviceLabel,
      platform: deviceLabel,
      viewport: { width: 390, height: 844, dpr: 3 },
      secureContext: true,
      storageAccess: "direct",
    },
    frame: {
      sampleCount: 3600,
      activeDurationMs: 60_000,
      medianFps: 58,
      p95FrameMs: 22,
      maxFrameMs: 34,
      longFramePercent: 0,
      jankBurstCount: 0,
      worstJankBurstFrames: 1,
    },
    motion: { permission: "granted", eventCount: 100, softSignals: 2, strongSignals: 2, acceptedGameShakes: 2 },
    feedback: {
      audioMuted: false,
      audioContextState: "running",
      audioDecodedSamples: 12,
      qaAudioTestCount: 1,
      hapticsEnabled: true,
      qaHapticTestCount: 1,
    },
    render: { latest: { frameTimeMs: 16.7 }, peakActiveVisuals: 54, peakEscapedBodies: 0, contextLosses: 0 },
    stability: {
      restartResumeCycles: 20,
      longLevel15Run: true,
      memoryTimelineEvidence: "evidence/stability/memory-timeline.json",
      memoryTrend: "flat",
      restartSlowdown: "none",
      contextLossLoop: false,
      notes: "20 restart/resume cycles and L15 stable.",
    },
    manual,
    transitions: [
      { event: "game-state", gameStatus: "dealt", level: 15, themeId: "fresh-market", activeCount: 48, reserveCount: 384, trayCount: 0 },
      { event: "game-state", gameStatus: "dealt", level: 15, themeId: "fresh-market", activeCount: 47, reserveCount: 384, trayCount: 1 },
      { event: "motion-signal", strength: "soft", intensity: 0.8 },
      { event: "game-shake", source: "device-motion", accepted: true, strength: "strong" },
      { event: "feedback-audio-test", count: 1 },
      { event: "feedback-haptic-test", count: 1, supported: true },
    ],
    ...overrides,
  };
}

function writeEvidenceBundle(suiteRoot, name, report) {
  const dir = path.join(suiteRoot, name);
  for (const key of manualKeys) {
    const file = path.join(dir, "evidence", key, `${key}.txt`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${key} evidence`);
  }
  const stabilityFile = path.join(dir, "evidence", "stability", "memory-timeline.json");
  fs.mkdirSync(path.dirname(stabilityFile), { recursive: true });
  fs.writeFileSync(stabilityFile, "{}\n");
  fs.writeFileSync(path.join(dir, `${name}.json`), `${JSON.stringify(report, null, 2)}\n`);
}

function run(suiteRoot) {
  return spawnSync(process.execPath, [script, suiteRoot], {
    cwd: root,
    encoding: "utf8",
  });
}

describe("verify-device-qa-suite", () => {
  it("accepts one strict iOS/Safari and one strict Android/Chrome report for the same build", () => {
    const suiteRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zhuada-device-suite-"));
    writeEvidenceBundle(suiteRoot, "ios", makeReport("iPhone 15 / iOS Safari"));
    writeEvidenceBundle(suiteRoot, "android", makeReport("Android mid-range / Chrome"));
    const result = run(suiteRoot);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Device QA suite accepted/);
  });

  it("rejects missing iOS coverage", () => {
    const suiteRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zhuada-device-suite-"));
    writeEvidenceBundle(suiteRoot, "android-a", makeReport("Android mid-range / Chrome"));
    writeEvidenceBundle(suiteRoot, "android-b", makeReport("Android flagship / Chrome"));
    const result = run(suiteRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /MISSING accepted iOS\/Safari report/);
  });

  it("does not accept desktop Safari as iOS hardware coverage", () => {
    const suiteRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zhuada-device-suite-"));
    writeEvidenceBundle(suiteRoot, "desktop-safari", makeReport("macOS / Safari"));
    writeEvidenceBundle(suiteRoot, "android", makeReport("Android mid-range / Chrome"));
    const result = run(suiteRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /MISSING accepted iOS\/Safari report/);
  });

  it("does not accept an iPhone-labeled report captured at desktop viewport size", () => {
    const suiteRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zhuada-device-suite-"));
    writeEvidenceBundle(suiteRoot, "ios-desktop", makeReport("iPhone 15 / iOS Safari", {
      runtime: {
        deviceLabel: "iPhone 15 / iOS Safari",
        userAgent: "iPhone 15 / iOS Safari",
        platform: "iPhone 15 / iOS Safari",
        viewport: { width: 1280, height: 900, dpr: 1 },
        secureContext: true,
        storageAccess: "direct",
      },
    }));
    writeEvidenceBundle(suiteRoot, "android", makeReport("Android mid-range / Chrome"));
    const result = run(suiteRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /phone-like CSS viewport|MISSING accepted iOS\/Safari report/);
  });

  it("does not accept non-Chrome Android WebView as Android Chrome coverage", () => {
    const suiteRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zhuada-device-suite-"));
    writeEvidenceBundle(suiteRoot, "ios", makeReport("iPhone 15 / iOS Safari"));
    writeEvidenceBundle(suiteRoot, "android-webview", makeReport("Android mid-range / WebView"));
    const result = run(suiteRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /MISSING accepted Android\/Chrome report/);
  });

  it("rejects mixed build IDs", () => {
    const suiteRoot = fs.mkdtempSync(path.join(os.tmpdir(), "zhuada-device-suite-"));
    writeEvidenceBundle(suiteRoot, "ios", makeReport("iPhone 15 / iOS Safari"));
    writeEvidenceBundle(suiteRoot, "android", makeReport("Android mid-range / Chrome", { buildId: "different-build" }));
    const result = run(suiteRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /one appVersion and one buildId/);
  });
});
