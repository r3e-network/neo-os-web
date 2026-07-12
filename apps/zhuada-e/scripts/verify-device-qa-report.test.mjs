import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const script = path.join(root, "scripts", "verify-device-qa-report.mjs");
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

function makeEvidenceRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zhuada-device-verify-"));
  for (const key of manualKeys) {
    const file = path.join(dir, "evidence", key, `${key}.txt`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${key} evidence`);
  }
  const stabilityFile = path.join(dir, "evidence", "stability", "memory-timeline.json");
  fs.mkdirSync(path.dirname(stabilityFile), { recursive: true });
  fs.writeFileSync(stabilityFile, "{}\n");
  return dir;
}

function makeReport() {
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
    buildId: "abc123",
    sessionId: "device-script-test",
    startedAt: "2026-07-11T00:00:00.000Z",
    generatedAt: "2026-07-11T00:01:01.000Z",
    runtime: {
      deviceLabel: "Android midrange / Chrome",
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
    motion: {
      permission: "granted",
      eventCount: 100,
      softSignals: 2,
      strongSignals: 2,
      acceptedGameShakes: 2,
    },
    feedback: {
      audioMuted: false,
      audioContextState: "running",
      audioDecodedSamples: 12,
      qaAudioTestCount: 1,
      hapticsEnabled: true,
      qaHapticTestCount: 1,
    },
    render: {
      latest: { frameTimeMs: 16.7 },
      peakActiveVisuals: 54,
      peakEscapedBodies: 0,
      contextLosses: 0,
    },
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
  };
}

function run(report, evidenceRoot) {
  const reportPath = path.join(evidenceRoot, "report.json");
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return spawnSync(process.execPath, [
    script,
    reportPath,
    "--evidence-root",
    evidenceRoot,
    "--strict-evidence-files",
  ], {
    cwd: root,
    encoding: "utf8",
  });
}

describe("verify-device-qa-report", () => {
  it("accepts a complete exported report with strict evidence files", () => {
    const evidenceRoot = makeEvidenceRoot();
    const result = run(makeReport(), evidenceRoot);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Device QA report accepted/);
  });

  it("rejects reports without runtime feedback proof", () => {
    const evidenceRoot = makeEvidenceRoot();
    const report = makeReport();
    delete report.feedback;
    const result = run(report, evidenceRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /feedback runtime evidence is missing/);
  });

  it("rejects desktop-sized viewports even when other evidence is complete", () => {
    const evidenceRoot = makeEvidenceRoot();
    const report = makeReport();
    report.runtime.viewport = { width: 1280, height: 900, dpr: 1 };
    const result = run(report, evidenceRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /phone-like CSS viewport/);
  });

  it("rejects reports without real gameplay transition coverage", () => {
    const evidenceRoot = makeEvidenceRoot();
    const report = makeReport();
    report.transitions = [{ event: "game-state", gameStatus: "idle", activeCount: 0, reserveCount: 0, trayCount: 0 }];
    const result = run(report, evidenceRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Transition coverage missing/);
    assert.match(result.stderr, /transition:motion-signal/);
    assert.match(result.stderr, /game-state:picked-tray/);
  });

  it("rejects reports without long-session memory/GPU stability evidence", () => {
    const evidenceRoot = makeEvidenceRoot();
    const report = makeReport();
    delete report.stability;
    const result = run(report, evidenceRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /stability evidence is missing/);
  });

  it("rejects visible animation jank even when median FPS and P95 look acceptable", () => {
    const evidenceRoot = makeEvidenceRoot();
    const report = makeReport();
    report.frame.medianFps = 59;
    report.frame.p95FrameMs = 22;
    report.frame.maxFrameMs = 97;
    report.frame.longFramePercent = 0.9;
    report.frame.worstJankBurstFrames = 4;
    const result = run(report, evidenceRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Longest foreground frame/);
    assert.match(result.stderr, /Long-frame rate/);
    assert.match(result.stderr, /Worst slow-frame burst/);
  });

  it("reports missing foreground jank fields as missing evidence instead of Infinity failures", () => {
    const evidenceRoot = makeEvidenceRoot();
    const report = makeReport();
    delete report.frame.maxFrameMs;
    delete report.frame.longFramePercent;
    delete report.frame.worstJankBurstFrames;
    const result = run(report, evidenceRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /MISSING frame\.maxFrameMs is missing or not a finite number/);
    assert.match(result.stderr, /MISSING frame\.longFramePercent is missing or not a finite number/);
    assert.match(result.stderr, /MISSING frame\.worstJankBurstFrames is missing or not a finite number/);
    assert.doesNotMatch(result.stderr, /Infinity/);
  });

  it("rejects unstable memory or restart trends", () => {
    const evidenceRoot = makeEvidenceRoot();
    const report = makeReport();
    report.stability.memoryTrend = "growing";
    report.stability.restartSlowdown = "present";
    report.stability.contextLossLoop = true;
    const result = run(report, evidenceRoot);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Memory\/GPU timeline shows unacceptable trend/);
    assert.match(result.stderr, /progressively slower/);
    assert.match(result.stderr, /context loss loop/);
  });
});
