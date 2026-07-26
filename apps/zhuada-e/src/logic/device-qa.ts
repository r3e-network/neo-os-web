import type { MotionPermissionState } from "./device-motion";

export const DEVICE_QA_QUERY_PARAM = "deviceQa";
export const DEVICE_QA_RENDER_EVENT = "zhuada-e:device-qa-render";
export const DEVICE_QA_FRAME_EVENT = "zhuada-e:device-qa-frame";
export const DEVICE_QA_SHAKE_EVENT = "zhuada-e:device-qa-shake";
export const DEVICE_QA_CONTEXT_EVENT = "zhuada-e:device-qa-context-loss";

export const DEVICE_QA_TARGET_FRAME_MS = 25;
export const DEVICE_QA_TARGET_MEDIAN_FPS = 55;
export const DEVICE_QA_MAX_SINGLE_FRAME_MS = 80;
export const DEVICE_QA_MAX_LONG_FRAME_PERCENT = 0.6;
export const DEVICE_QA_MAX_JANK_BURST_FRAMES = 2;
export const DEVICE_QA_MIN_SAMPLE_MS = 60_000;
export const DEVICE_QA_REQUIRED_THEME_IDS = [
  "fresh-market",
  "farm-kitchen",
  "night-market",
] as const;
export const DEVICE_QA_REQUIRED_TRANSITION_EVENTS = [
  "game-state",
  "motion-signal",
  "game-shake",
  "feedback-audio-test",
] as const;

export interface DeviceQaRenderSample {
  at: number;
  frameTimeMs: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
  activeVisuals: number;
  physicsBodies: number;
  sleepingBodies: number;
  escapedBodies: number;
  maxHorizontalVelocity: number;
  maxVerticalVelocity: number;
  pixelRatio: number;
  canvasWidth: number;
  canvasHeight: number;
  qualityTier?: "full" | "constrained";
  rendererLabel?: string;
}

export interface DeviceQaMotionEvidence {
  permission: MotionPermissionState;
  enabled: boolean;
  eventCount: number;
  eventRateHz: number;
  lastEventAt: number | null;
  lastRawMagnitude: number;
  maxRawMagnitude: number;
  directAccelerationEvents: number;
  gravityIncludedEvents: number;
  softSignals: number;
  strongSignals: number;
  lastSignalAt: number | null;
  lastSignalIntensity: number;
  lastSignalMagnitude: number;
  acceptedGameShakes: number;
  cooldownRejected: number;
}

export interface DeviceQaFeedbackEvidence {
  audioMuted: boolean;
  audioContextState: string;
  audioDecodedSamples: number;
  audioLoadingSamples: number;
  ambienceName: string;
  ambiencePlaying: boolean;
  hapticsSupported: boolean;
  hapticsEnabled: boolean;
  qaAudioTestCount: number;
  qaHapticTestCount: number;
}

export interface DeviceQaFrameSummary {
  sampleCount: number;
  activeDurationMs: number;
  p50FrameMs: number;
  p95FrameMs: number;
  maxFrameMs: number;
  medianFps: number;
  slowFramePercent: number;
  longFramePercent: number;
  jankBurstCount: number;
  worstJankBurstFrames: number;
  backgroundGapCount: number;
}

export interface DeviceQaStabilityEvidence {
  restartResumeCycles: number;
  longLevel15Run: boolean;
  memoryTimelineEvidence: string;
  memoryTrend: "unknown" | "flat" | "growing";
  restartSlowdown: "unknown" | "none" | "present";
  contextLossLoop: boolean;
  notes: string;
}

export const DEVICE_QA_MANUAL_CHECKS = [
  ["permissionFallback", "拒绝/阻止运动权限后，屏幕按钮仍可玩"],
  ["softShakeControlled", "轻甩只扰动部分物件，反馈可控"],
  ["strongShakeContained", "重甩翻动更强，但没有物件飞出容器"],
  ["audioAudible", "首次操作、碰撞、三消、胜负和环境音可辨且无爆音"],
  ["hapticsVerified", "触觉可感知，或不支持时能静默降级"],
  ["orientationSafe", "旋转与安全区没有遮挡、横滚或误触"],
  ["backgroundResume", "切后台/锁屏后计时和局内恢复符合规则"],
  ["contextRecovery", "WebGL 中断时出现恢复入口，重试后可继续"],
  ["fullFlow", "三主题完整走过匹配、补货、道具、胜负、重开与续局，并在备注/证据中列出 fresh-market、farm-kitchen、night-market"],
] as const;

export type DeviceQaManualKey = typeof DEVICE_QA_MANUAL_CHECKS[number][0];
export type DeviceQaManualStatus = "pending" | "pass" | "fail";
export interface DeviceQaManualResult {
  status: DeviceQaManualStatus;
  note: string;
  evidence: string;
}
export type DeviceQaManualChecks = Record<DeviceQaManualKey, DeviceQaManualResult>;

export interface DeviceQaRuntimeEvidence {
  deviceLabel: string;
  userAgent: string;
  platform: string;
  language: string;
  viewport: { width: number; height: number; dpr: number };
  orientation: string;
  secureContext: boolean;
  online: boolean;
  reducedMotion: boolean;
  embedded: boolean;
  storageAccess: "direct" | "bridged" | "blocked";
  entryAssets: string[];
}

export interface DeviceQaGameSnapshot {
  gameStatus: string;
  level: number;
  themeId: string;
  activeCount: number;
  reserveCount: number;
  trayCount: number;
  shakeNonce: number;
  lastStatus: string;
}

export interface DeviceQaRenderEvidence {
  latest: DeviceQaRenderSample | null;
  peakDrawCalls: number;
  peakTriangles: number;
  peakActiveVisuals: number;
  peakPhysicsBodies: number;
  peakEscapedBodies: number;
  peakHorizontalVelocity: number;
  peakVerticalVelocity: number;
  contextLosses: number;
}

export interface DeviceQaReportInput {
  appVersion: string;
  buildId: string;
  sessionId: string;
  startedAt: string;
  generatedAt: string;
  runtime: DeviceQaRuntimeEvidence;
  frame: DeviceQaFrameSummary;
  motion: DeviceQaMotionEvidence;
  feedback: DeviceQaFeedbackEvidence;
  render: DeviceQaRenderEvidence;
  stability: DeviceQaStabilityEvidence;
  game: DeviceQaGameSnapshot;
  manual: DeviceQaManualChecks;
  transitions: Array<Record<string, unknown>>;
}

export interface DeviceQaReport extends DeviceQaReportInput {
  schema: "zhuada-e-device-qa-v1";
  verdict: "pass" | "incomplete" | "fail";
  failures: string[];
  missingEvidence: string[];
  privacy: "local-only; no automatic upload";
}

export function isDeviceQaEnabled(
  search?: string,
  buildEnabled = import.meta.env.VITE_DEVICE_QA === "1",
): boolean {
  if (!buildEnabled) return false;
  const value = search ?? (typeof window !== "undefined" ? window.location.search : "");
  return new URLSearchParams(value).get(DEVICE_QA_QUERY_PARAM) === "1";
}

function percentile(sorted: readonly number[], ratio: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1));
  return sorted[index] ?? 0;
}

export function summarizeFrameIntervals(intervals: readonly number[]): DeviceQaFrameSummary {
  const valid: number[] = [];
  let currentJankBurst = 0;
  let worstJankBurstFrames = 0;
  let jankBurstCount = 0;
  let backgroundGapCount = 0;
  for (const raw of intervals) {
    const value = Number(raw);
    if (!Number.isFinite(value) || value <= 0) continue;
    // rAF gaps above 250ms represent backgrounding, debugging pauses or a
    // sleeping display. Keep them visible as gaps, but do not mislabel them as
    // foreground frame time.
    if (value > 250) {
      backgroundGapCount += 1;
      if (currentJankBurst > DEVICE_QA_MAX_JANK_BURST_FRAMES) jankBurstCount += 1;
      worstJankBurstFrames = Math.max(worstJankBurstFrames, currentJankBurst);
      currentJankBurst = 0;
      continue;
    }
    valid.push(value);
    if (value > DEVICE_QA_TARGET_FRAME_MS) {
      currentJankBurst += 1;
    } else {
      if (currentJankBurst > DEVICE_QA_MAX_JANK_BURST_FRAMES) jankBurstCount += 1;
      worstJankBurstFrames = Math.max(worstJankBurstFrames, currentJankBurst);
      currentJankBurst = 0;
    }
  }
  if (currentJankBurst > DEVICE_QA_MAX_JANK_BURST_FRAMES) jankBurstCount += 1;
  worstJankBurstFrames = Math.max(worstJankBurstFrames, currentJankBurst);
  valid.sort((a, b) => a - b);
  const p50FrameMs = percentile(valid, 0.5);
  const p95FrameMs = percentile(valid, 0.95);
  const slowFrames = valid.filter((value) => value > DEVICE_QA_TARGET_FRAME_MS).length;
  const longFrames = valid.filter((value) => value > DEVICE_QA_MAX_SINGLE_FRAME_MS).length;
  return {
    sampleCount: valid.length,
    activeDurationMs: valid.reduce((sum, value) => sum + value, 0),
    p50FrameMs,
    p95FrameMs,
    maxFrameMs: valid[valid.length - 1] ?? 0,
    medianFps: p50FrameMs > 0 ? 1000 / p50FrameMs : 0,
    slowFramePercent: valid.length > 0 ? (slowFrames / valid.length) * 100 : 0,
    longFramePercent: valid.length > 0 ? (longFrames / valid.length) * 100 : 0,
    jankBurstCount,
    worstJankBurstFrames,
    backgroundGapCount,
  };
}

export function emptyManualChecks(): DeviceQaManualChecks {
  return Object.fromEntries(
    DEVICE_QA_MANUAL_CHECKS.map(([key]) => [key, { status: "pending", note: "", evidence: "" }]),
  ) as DeviceQaManualChecks;
}

export function missingFullFlowThemeCoverage(result: DeviceQaManualResult): string[] {
  const text = `${result.note} ${result.evidence}`.toLowerCase();
  return DEVICE_QA_REQUIRED_THEME_IDS.filter((themeId) => !text.includes(themeId));
}

function transitionEventName(transition: Record<string, unknown>): string {
  return typeof transition.event === "string" ? transition.event : "";
}

export function missingDeviceQaTransitionCoverage(input: Pick<DeviceQaReportInput, "feedback" | "transitions">): string[] {
  const transitions = input.transitions.filter((transition) => transition && typeof transition === "object");
  const events = new Set(transitions.map(transitionEventName).filter(Boolean));
  const missing = DEVICE_QA_REQUIRED_TRANSITION_EVENTS
    .filter((event) => !events.has(event))
    .map((event) => `transition:${event}`);
  if (input.feedback.hapticsEnabled && !events.has("feedback-haptic-test")) {
    missing.push("transition:feedback-haptic-test");
  }

  const gameStates = transitions.filter((transition) => transitionEventName(transition) === "game-state");
  if (!gameStates.some((transition) => Number(transition.activeCount) > 0 && String(transition.gameStatus) === "dealt")) {
    missing.push("game-state:active-play");
  }
  if (!gameStates.some((transition) => Number(transition.trayCount) > 0)) {
    missing.push("game-state:picked-tray");
  }
  if (!gameStates.some((transition) => Number(transition.reserveCount) > 0)) {
    missing.push("game-state:bottom-reserve");
  }
  return missing;
}

export function buildDeviceQaReport(input: DeviceQaReportInput): DeviceQaReport {
  const failures: string[] = [];
  const missingEvidence: string[] = [];
  const { frame, motion, render, runtime, stability, manual } = input;
  const feedback = input.feedback;

  if (!runtime.secureContext) failures.push("Secure context is required for production motion permission.");
  if (runtime.storageAccess === "blocked") {
    failures.push("Web Storage is blocked at this release entry; progress and run recovery cannot be guaranteed.");
  }
  if (frame.activeDurationMs >= DEVICE_QA_MIN_SAMPLE_MS) {
    if (frame.medianFps < DEVICE_QA_TARGET_MEDIAN_FPS) {
      failures.push(`Median FPS ${frame.medianFps.toFixed(1)} is below ${DEVICE_QA_TARGET_MEDIAN_FPS}.`);
    }
    if (frame.p95FrameMs > DEVICE_QA_TARGET_FRAME_MS) {
      failures.push(`P95 frame time ${frame.p95FrameMs.toFixed(1)}ms exceeds ${DEVICE_QA_TARGET_FRAME_MS}ms.`);
    }
    if (frame.maxFrameMs > DEVICE_QA_MAX_SINGLE_FRAME_MS) {
      failures.push(`Longest foreground frame ${frame.maxFrameMs.toFixed(1)}ms exceeds ${DEVICE_QA_MAX_SINGLE_FRAME_MS}ms.`);
    }
    if (frame.longFramePercent > DEVICE_QA_MAX_LONG_FRAME_PERCENT) {
      failures.push(`Long-frame rate ${frame.longFramePercent.toFixed(2)}% exceeds ${DEVICE_QA_MAX_LONG_FRAME_PERCENT}%.`);
    }
    if (frame.worstJankBurstFrames > DEVICE_QA_MAX_JANK_BURST_FRAMES) {
      failures.push(`Worst slow-frame burst ${frame.worstJankBurstFrames} frames exceeds ${DEVICE_QA_MAX_JANK_BURST_FRAMES}.`);
    }
  } else {
    missingEvidence.push("Collect at least 60 seconds of foreground frame samples.");
  }
  if (motion.permission !== "granted") missingEvidence.push("Grant motion permission for the sensor-delivery run.");
  if (motion.eventCount === 0) missingEvidence.push("No real devicemotion events were recorded.");
  if (motion.softSignals === 0) missingEvidence.push("No soft shake signal was recorded.");
  if (motion.strongSignals === 0) missingEvidence.push("No strong shake signal was recorded.");
  if (feedback.audioMuted) missingEvidence.push("Unmute audio for the physical audio-mix run.");
  if (feedback.audioContextState !== "running") missingEvidence.push(`AudioContext must be running during the physical audio-mix run; got ${feedback.audioContextState}.`);
  if (feedback.audioDecodedSamples < 12) missingEvidence.push(`Decoded SFX sample count is incomplete: ${feedback.audioDecodedSamples}/12.`);
  if (feedback.qaAudioTestCount <= 0) missingEvidence.push("Use the Device QA panel audio test button during the recorded run.");
  if (feedback.hapticsEnabled && feedback.qaHapticTestCount <= 0) missingEvidence.push("Use the Device QA panel haptic test button during the recorded run.");
  if (!render.latest) missingEvidence.push("No WebGL renderer telemetry was recorded during active play.");
  if (render.peakActiveVisuals > 54) failures.push(`Active visual ceiling exceeded: ${render.peakActiveVisuals}.`);
  if (render.peakEscapedBodies > 0) failures.push(`${render.peakEscapedBodies} body/bodies escaped the container boundary.`);
  if (stability.restartResumeCycles < 20) {
    missingEvidence.push(`Run at least 20 start/retry/exit/resume stability cycles; got ${stability.restartResumeCycles}.`);
  }
  if (!stability.longLevel15Run) missingEvidence.push("Complete at least one long Level 15 stability run.");
  if (!stability.memoryTimelineEvidence.trim()) missingEvidence.push("Attach a memory/GPU timeline evidence path for the stability run.");
  if (stability.memoryTrend === "unknown") missingEvidence.push("Classify memory/GPU trend as flat before release signoff.");
  if (stability.memoryTrend === "growing") failures.push("Memory/GPU timeline shows monotonic growth.");
  if (stability.restartSlowdown === "unknown") missingEvidence.push("Classify restart slowdown as none before release signoff.");
  if (stability.restartSlowdown === "present") failures.push("Repeated restart/resume cycles became progressively slower.");
  if (stability.contextLossLoop) failures.push("WebGL context loss loop observed during stability run.");
  if (!input.runtime.deviceLabel.trim()) missingEvidence.push("Enter the physical device model and OS/browser label.");
  if (!input.buildId.trim() || input.buildId === "local-unbound") {
    missingEvidence.push("Build ID is not bound; set VITE_BUILD_SHA for the physical-device QA build.");
  }
  for (const [key, label] of DEVICE_QA_MANUAL_CHECKS) {
    const result = manual[key];
    if (result.status === "fail") {
      failures.push(`Manual check failed: ${label}${result.note ? ` (${result.note})` : ""}`);
    } else if (result.status !== "pass") {
      missingEvidence.push(`Manual check incomplete: ${label}`);
    } else if (!result.evidence.trim()) {
      missingEvidence.push(`Manual check evidence missing: ${label}`);
    }
  }
  const missingThemes = missingFullFlowThemeCoverage(manual.fullFlow);
  if (manual.fullFlow.status === "pass" && missingThemes.length > 0) {
    missingEvidence.push(`Manual fullFlow coverage must list all three theme ids; missing ${missingThemes.join(", ")}.`);
  }
  const missingTransitions = missingDeviceQaTransitionCoverage(input);
  if (missingTransitions.length > 0) {
    missingEvidence.push(`Transition coverage must include real gameplay motion events; missing ${missingTransitions.join(", ")}.`);
  }

  return {
    ...input,
    schema: "zhuada-e-device-qa-v1",
    verdict: failures.length > 0 ? "fail" : missingEvidence.length > 0 ? "incomplete" : "pass",
    failures,
    missingEvidence,
    privacy: "local-only; no automatic upload",
  };
}

export function buildDeviceQaEvidenceChecklist(report: DeviceQaReport): string {
  const lines = [
    `Device QA evidence bundle — ${report.sessionId}`,
    `App version: ${report.appVersion}`,
    `Build ID: ${report.buildId}`,
    `Device: ${report.runtime.deviceLabel || "<fill physical device / OS / browser>"}`,
    `Generated: ${report.generatedAt}`,
    "",
    "Required files / stable IDs:",
    `- ${report.sessionId}.json — exported Device QA report`,
    ...DEVICE_QA_MANUAL_CHECKS.map(([key, label]) => {
      const evidence = report.manual[key]?.evidence.trim();
      return `- ${key}: ${label} — ${evidence || "<recording/trace/screenshot path or stable lab ID>"}`;
    }),
    `- stability.memoryTimelineEvidence: ${report.stability.memoryTimelineEvidence || "<memory/GPU timeline trace path>"}`,
    "",
    `Full-flow coverage note must include: ${DEVICE_QA_REQUIRED_THEME_IDS.join(", ")}`,
    "",
    "Offline verification:",
    `npm run device-qa:verify -- ${report.sessionId}.json --evidence-root ./evidence-bundle --strict-evidence-files`,
    "",
    "Release rule: the in-game verdict must be PASS and the offline verifier must accept the same JSON.",
  ];
  return lines.join("\n");
}

export function createDeviceQaSessionId(now = Date.now()): string {
  const random = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8)
    : Math.random().toString(36).slice(2, 10);
  return `device-${now.toString(36)}-${random}`;
}
