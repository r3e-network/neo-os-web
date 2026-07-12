import { describe, expect, it } from "vitest";
import {
  buildDeviceQaReport,
  buildDeviceQaEvidenceChecklist,
  DEVICE_QA_MANUAL_CHECKS,
  DEVICE_QA_REQUIRED_TRANSITION_EVENTS,
  DEVICE_QA_REQUIRED_THEME_IDS,
  emptyManualChecks,
  isDeviceQaEnabled,
  missingDeviceQaTransitionCoverage,
  missingFullFlowThemeCoverage,
  summarizeFrameIntervals,
  type DeviceQaReportInput,
} from "./device-qa";

function reportInput(): DeviceQaReportInput {
  const manual = emptyManualChecks();
  for (const key of Object.keys(manual) as Array<keyof typeof manual>) {
    manual[key] = { status: "pass", note: "", evidence: `/tmp/zhuada-device-qa/${String(key)}.mp4` };
  }
  manual.fullFlow = {
    status: "pass",
    note: "Covered fresh-market, farm-kitchen, night-market: match, refill, tools, win, loss, retry and resume.",
    evidence: "/tmp/zhuada-device-qa/fullFlow.mp4",
  };
  return {
    appVersion: "3.1.0",
    buildId: "abc123def456",
    sessionId: "device-test",
    startedAt: "2026-07-11T00:00:00.000Z",
    generatedAt: "2026-07-11T00:01:02.000Z",
    runtime: {
      deviceLabel: "Test Phone / Test OS / Test Browser",
      userAgent: "test",
      platform: "test",
      language: "zh-CN",
      viewport: { width: 390, height: 844, dpr: 3 },
      orientation: "portrait-primary",
      secureContext: true,
      online: true,
      reducedMotion: false,
      embedded: false,
      storageAccess: "direct",
      entryAssets: ["/assets/index-test.js"],
    },
    frame: {
      sampleCount: 3600,
      activeDurationMs: 60_100,
      p50FrameMs: 16.7,
      p95FrameMs: 22,
      maxFrameMs: 34,
      medianFps: 59.88,
      slowFramePercent: 1,
      longFramePercent: 0,
      jankBurstCount: 0,
      worstJankBurstFrames: 1,
      backgroundGapCount: 0,
    },
    motion: {
      permission: "granted",
      enabled: true,
      eventCount: 1800,
      eventRateHz: 30,
      lastEventAt: Date.now(),
      lastRawMagnitude: 2,
      maxRawMagnitude: 32,
      directAccelerationEvents: 1800,
      gravityIncludedEvents: 0,
      softSignals: 2,
      strongSignals: 2,
      lastSignalAt: Date.now(),
      lastSignalIntensity: 1.2,
      lastSignalMagnitude: 24,
      acceptedGameShakes: 4,
      cooldownRejected: 0,
    },
    feedback: {
      audioMuted: false,
      audioContextState: "running",
      audioDecodedSamples: 12,
      audioLoadingSamples: 0,
      ambienceName: "night",
      ambiencePlaying: true,
      hapticsSupported: true,
      hapticsEnabled: true,
      qaAudioTestCount: 1,
      qaHapticTestCount: 1,
    },
    render: {
      latest: {
        at: Date.now(),
        frameTimeMs: 16.7,
        drawCalls: 420,
        triangles: 100_000,
        geometries: 81,
        textures: 2,
        activeVisuals: 54,
        physicsBodies: 54,
        sleepingBodies: 10,
        escapedBodies: 0,
        maxHorizontalVelocity: 3.8,
        maxVerticalVelocity: 5.35,
        pixelRatio: 1.5,
        canvasWidth: 585,
        canvasHeight: 900,
      },
      peakDrawCalls: 430,
      peakTriangles: 110_000,
      peakActiveVisuals: 54,
      peakPhysicsBodies: 54,
      peakEscapedBodies: 0,
      peakHorizontalVelocity: 3.8,
      peakVerticalVelocity: 5.35,
      contextLosses: 0,
    },
    stability: {
      restartResumeCycles: 20,
      longLevel15Run: true,
      memoryTimelineEvidence: "/tmp/zhuada-device-qa/memory-timeline.json",
      memoryTrend: "flat",
      restartSlowdown: "none",
      contextLossLoop: false,
      notes: "20 cycles and one L15 long run stayed stable.",
    },
    game: {
      gameStatus: "dealt",
      level: 15,
      themeId: "night-market",
      activeCount: 48,
      reserveCount: 384,
      trayCount: 0,
      shakeNonce: 4,
      lastStatus: "playing",
    },
    manual,
    transitions: [
      { at: "2026-07-11T00:00:03.000Z", event: "game-state", gameStatus: "dealt", level: 15, themeId: "fresh-market", activeCount: 48, reserveCount: 384, trayCount: 0 },
      { at: "2026-07-11T00:00:06.000Z", event: "game-state", gameStatus: "dealt", level: 15, themeId: "fresh-market", activeCount: 47, reserveCount: 384, trayCount: 1 },
      { at: "2026-07-11T00:00:08.000Z", event: "motion-signal", strength: "soft", intensity: 0.8 },
      { at: "2026-07-11T00:00:09.000Z", event: "game-shake", source: "device-motion", accepted: true, strength: "strong" },
      { at: "2026-07-11T00:00:10.000Z", event: "feedback-audio-test", count: 1 },
      { at: "2026-07-11T00:00:11.000Z", event: "feedback-haptic-test", count: 1, supported: true },
    ],
  };
}

describe("device QA evidence", () => {
  it("requires both the QA build and the exact query flag", () => {
    expect(isDeviceQaEnabled("?deviceQa=1", true)).toBe(true);
    expect(isDeviceQaEnabled("?deviceQa=1", false)).toBe(false);
    expect(isDeviceQaEnabled("?deviceQa=0", true)).toBe(false);
    expect(isDeviceQaEnabled("?debug=1", true)).toBe(false);
  });

  it("summarizes foreground frame time while separating background gaps", () => {
    const summary = summarizeFrameIntervals([16, 17, 20, 30, 28, 27, 16, 90, 1000, Number.NaN]);
    expect(summary.sampleCount).toBe(8);
    expect(summary.backgroundGapCount).toBe(1);
    expect(summary.p50FrameMs).toBe(20);
    expect(summary.p95FrameMs).toBe(90);
    expect(summary.maxFrameMs).toBe(90);
    expect(summary.slowFramePercent).toBe(50);
    expect(summary.longFramePercent).toBe(12.5);
    expect(summary.jankBurstCount).toBe(1);
    expect(summary.worstJankBurstFrames).toBe(3);
  });

  it("passes only with sensor, renderer, 60-second performance and manual evidence", () => {
    const report = buildDeviceQaReport(reportInput());
    expect(report.verdict).toBe("pass");
    expect(report.failures).toEqual([]);
    expect(report.missingEvidence).toEqual([]);
  });

  it("builds a release evidence checklist tied to the exported report", () => {
    const report = buildDeviceQaReport(reportInput());
    const checklist = buildDeviceQaEvidenceChecklist(report);
    expect(checklist).toContain("Device QA evidence bundle — device-test");
    expect(checklist).toContain("Build ID: abc123def456");
    expect(checklist).toContain("device-test.json");
    expect(checklist).toContain("stability.memoryTimelineEvidence");
    expect(checklist).toContain("npm run device-qa:verify -- device-test.json");
    expect(checklist).toContain(`Full-flow coverage note must include: ${DEVICE_QA_REQUIRED_THEME_IDS.join(", ")}`);
    for (const [key, label] of DEVICE_QA_MANUAL_CHECKS) {
      expect(checklist).toContain(`${key}: ${label}`);
    }
  });

  it("distinguishes incomplete evidence from a measured performance failure", () => {
    const incomplete = reportInput();
    incomplete.motion.eventCount = 0;
    incomplete.feedback.qaAudioTestCount = 0;
    incomplete.manual.fullFlow = { status: "pending", note: "", evidence: "" };
    expect(buildDeviceQaReport(incomplete).verdict).toBe("incomplete");

    const missingManualEvidence = reportInput();
    missingManualEvidence.manual.fullFlow = { status: "pass", note: "", evidence: "" };
    const missingEvidenceReport = buildDeviceQaReport(missingManualEvidence);
    expect(missingEvidenceReport.verdict).toBe("incomplete");
    expect(missingEvidenceReport.missingEvidence.join(" ")).toContain("evidence missing");

    const failed = reportInput();
    failed.frame.p95FrameMs = 31;
    failed.render.peakEscapedBodies = 1;
    const report = buildDeviceQaReport(failed);
    expect(report.verdict).toBe("fail");
    expect(report.failures.join(" ")).toContain("P95");
    expect(report.failures.join(" ")).toContain("escaped");

    const manualFailure = reportInput();
    manualFailure.manual.audioAudible = { status: "fail", note: "left speaker clips", evidence: "/tmp/audio-fail.mov" };
    expect(buildDeviceQaReport(manualFailure).verdict).toBe("fail");
    expect(buildDeviceQaReport(manualFailure).failures.join(" ")).toContain("left speaker clips");

    const blockedStorage = reportInput();
    blockedStorage.runtime.storageAccess = "blocked";
    expect(buildDeviceQaReport(blockedStorage).verdict).toBe("fail");
    expect(buildDeviceQaReport(blockedStorage).failures.join(" ")).toContain("Web Storage");
  });

  it("fails physical signoff on visible animation jank bursts, not only low median FPS", () => {
    const failed = reportInput();
    failed.frame.medianFps = 59;
    failed.frame.p95FrameMs = 22;
    failed.frame.maxFrameMs = 96;
    failed.frame.longFramePercent = 0.9;
    failed.frame.worstJankBurstFrames = 4;
    const report = buildDeviceQaReport(failed);
    expect(report.verdict).toBe("fail");
    expect(report.failures.join(" ")).toContain("Longest foreground frame");
    expect(report.failures.join(" ")).toContain("Long-frame rate");
    expect(report.failures.join(" ")).toContain("Worst slow-frame burst");
  });

  it("requires long-session memory/GPU stability evidence", () => {
    const missing = reportInput();
    missing.stability.restartResumeCycles = 12;
    missing.stability.longLevel15Run = false;
    missing.stability.memoryTimelineEvidence = "";
    missing.stability.memoryTrend = "unknown";
    missing.stability.restartSlowdown = "unknown";
    const missingReport = buildDeviceQaReport(missing);
    expect(missingReport.verdict).toBe("incomplete");
    expect(missingReport.missingEvidence.join(" ")).toContain("20 start/retry/exit/resume");
    expect(missingReport.missingEvidence.join(" ")).toContain("Level 15");
    expect(missingReport.missingEvidence.join(" ")).toContain("memory/GPU timeline");

    const failed = reportInput();
    failed.stability.memoryTrend = "growing";
    failed.stability.restartSlowdown = "present";
    failed.stability.contextLossLoop = true;
    const failedReport = buildDeviceQaReport(failed);
    expect(failedReport.verdict).toBe("fail");
    expect(failedReport.failures.join(" ")).toContain("monotonic growth");
    expect(failedReport.failures.join(" ")).toContain("progressively slower");
    expect(failedReport.failures.join(" ")).toContain("context loss loop");
  });

  it("requires runtime feedback proof in addition to manual audio and haptic signoff", () => {
    const muted = reportInput();
    muted.feedback.audioMuted = true;
    muted.feedback.audioContextState = "suspended";
    muted.feedback.audioDecodedSamples = 6;
    muted.feedback.qaAudioTestCount = 0;
    const mutedReport = buildDeviceQaReport(muted);
    expect(mutedReport.verdict).toBe("incomplete");
    expect(mutedReport.missingEvidence.join(" ")).toContain("Unmute audio");
    expect(mutedReport.missingEvidence.join(" ")).toContain("AudioContext");
    expect(mutedReport.missingEvidence.join(" ")).toContain("Decoded SFX");
    expect(mutedReport.missingEvidence.join(" ")).toContain("audio test button");

    const haptic = reportInput();
    haptic.feedback.qaHapticTestCount = 0;
    expect(buildDeviceQaReport(haptic).missingEvidence.join(" ")).toContain("haptic test button");

    const unsupportedHaptic = reportInput();
    unsupportedHaptic.feedback.hapticsSupported = false;
    unsupportedHaptic.feedback.hapticsEnabled = false;
    unsupportedHaptic.feedback.qaHapticTestCount = 0;
    expect(buildDeviceQaReport(unsupportedHaptic).verdict).toBe("pass");
  });

  it("requires transition evidence from real gameplay and feedback motion", () => {
    const report = reportInput();
    expect(missingDeviceQaTransitionCoverage(report)).toEqual([]);
    for (const event of DEVICE_QA_REQUIRED_TRANSITION_EVENTS) {
      expect(report.transitions.some((transition) => transition.event === event)).toBe(true);
    }

    const missing = reportInput();
    missing.transitions = [{ event: "game-state", gameStatus: "idle", activeCount: 0, reserveCount: 0, trayCount: 0 }];
    const result = buildDeviceQaReport(missing);
    expect(result.verdict).toBe("incomplete");
    expect(result.missingEvidence.join(" ")).toContain("Transition coverage");
    expect(result.missingEvidence.join(" ")).toContain("transition:motion-signal");
    expect(result.missingEvidence.join(" ")).toContain("game-state:picked-tray");
  });

  it("does not accept full-flow signoff unless all three themes are explicitly covered", () => {
    const report = reportInput();
    report.manual.fullFlow = {
      status: "pass",
      note: "Covered fresh-market and farm-kitchen only.",
      evidence: "/tmp/zhuada-device-qa/fullFlow.mp4",
    };
    expect(missingFullFlowThemeCoverage(report.manual.fullFlow)).toEqual(["night-market"]);
    const result = buildDeviceQaReport(report);
    expect(result.verdict).toBe("incomplete");
    expect(result.missingEvidence.join(" ")).toContain("missing night-market");
  });
});
