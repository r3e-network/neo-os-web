#!/usr/bin/env node
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, isAbsolute, join, resolve } from "node:path";

const TARGET_FRAME_MS = 25;
const TARGET_MEDIAN_FPS = 55;
const MAX_SINGLE_FRAME_MS = 80;
const MAX_LONG_FRAME_PERCENT = 0.6;
const MAX_JANK_BURST_FRAMES = 2;
const MIN_SAMPLE_MS = 60_000;
const MAX_ACTIVE_VISUALS = 54;
const MIN_PHONE_SHORT_EDGE = 280;
const MAX_PHONE_SHORT_EDGE = 520;
const MIN_PHONE_LONG_EDGE = 560;
const MAX_PHONE_LONG_EDGE = 960;
const SCHEMA = "zhuada-e-device-qa-v1";
const REQUIRED_THEME_IDS = ["fresh-market", "farm-kitchen", "night-market"];
const REQUIRED_TRANSITION_EVENTS = [
  "game-state",
  "motion-signal",
  "game-shake",
  "feedback-audio-test",
];
const MANUAL_KEYS = [
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

function usage() {
  console.error([
    "Usage: node scripts/verify-device-qa-report.mjs <report.json> [--evidence-root <dir>] [--strict-evidence-files]",
    "",
    "Verifies an exported zhuada-e Device QA JSON report before mobile release signoff.",
    "--evidence-root resolves relative recording/trace/screenshot paths.",
    "--strict-evidence-files requires every manual evidence value to resolve to an existing file.",
  ].join("\n"));
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let reportPath = "";
  let evidenceRoot = "";
  let strictEvidenceFiles = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--evidence-root") {
      evidenceRoot = args[i + 1] ?? "";
      i += 1;
    } else if (arg === "--strict-evidence-files") {
      strictEvidenceFiles = true;
    } else if (!reportPath) {
      reportPath = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }
  return {
    reportPath,
    evidenceRoot: evidenceRoot ? resolve(evidenceRoot) : "",
    strictEvidenceFiles,
  };
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read JSON report: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function numberAt(report, path) {
  const value = path.split(".").reduce((cursor, key) => isObject(cursor) ? cursor[key] : undefined, report);
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function stringAt(report, path) {
  const value = path.split(".").reduce((cursor, key) => isObject(cursor) ? cursor[key] : undefined, report);
  return typeof value === "string" ? value : undefined;
}

function requireNumber(report, path, missing) {
  const value = numberAt(report, path);
  if (value === undefined) missing.push(`${path} is missing or not a finite number.`);
  return value;
}

function phoneViewportAt(report) {
  const width = numberAt(report, "runtime.viewport.width") ?? 0;
  const height = numberAt(report, "runtime.viewport.height") ?? 0;
  const dpr = numberAt(report, "runtime.viewport.dpr") ?? 0;
  const shortEdge = Math.min(width, height);
  const longEdge = Math.max(width, height);
  return {
    width,
    height,
    dpr,
    ok: shortEdge >= MIN_PHONE_SHORT_EDGE
      && shortEdge <= MAX_PHONE_SHORT_EDGE
      && longEdge >= MIN_PHONE_LONG_EDGE
      && longEdge <= MAX_PHONE_LONG_EDGE
      && dpr >= 1,
  };
}

function fileLikeEvidence(value) {
  return /[\\/]/.test(value) || /\.(mp4|mov|webm|json|trace|har|png|jpe?g|webp|txt|md)$/i.test(value);
}

function resolveEvidence(value, evidenceRoot) {
  if (isAbsolute(value)) return value;
  if (evidenceRoot) return join(evidenceRoot, value);
  return resolve(value);
}

function evidenceExists(value, evidenceRoot) {
  const candidate = resolveEvidence(value, evidenceRoot);
  if (!existsSync(candidate)) return false;
  try {
    return statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function validateManualEvidence(report, evidenceRoot, strictEvidenceFiles, failures, missing) {
  const manual = report.manual;
  if (!isObject(manual)) {
    failures.push("manual is missing or not an object.");
    return;
  }
  for (const key of MANUAL_KEYS) {
    const result = manual[key];
    if (!isObject(result)) {
      missing.push(`Manual check missing: ${key}.`);
      continue;
    }
    if (result.status !== "pass") {
      failures.push(`Manual check is not pass: ${key} (${String(result.status ?? "missing")}).`);
      continue;
    }
    const evidence = typeof result.evidence === "string" ? result.evidence.trim() : "";
    if (!evidence) {
      missing.push(`Manual evidence missing: ${key}.`);
      continue;
    }
    const mustExist = strictEvidenceFiles || fileLikeEvidence(evidence);
    if (mustExist && !evidenceExists(evidence, evidenceRoot)) {
      missing.push(`Manual evidence file not found: ${key} -> ${evidence}${evidenceRoot ? ` (root ${evidenceRoot})` : ""}.`);
    }
    if (key === "fullFlow") {
      const note = typeof result.note === "string" ? result.note : "";
      const coverageText = `${note} ${evidence}`.toLowerCase();
      const missingThemes = REQUIRED_THEME_IDS.filter((themeId) => !coverageText.includes(themeId));
      if (missingThemes.length > 0) {
        missing.push(`Manual fullFlow coverage must list all three theme ids; missing ${missingThemes.join(", ")}.`);
      }
    }
  }
}

function transitionEventName(transition) {
  return isObject(transition) && typeof transition.event === "string" ? transition.event : "";
}

function validateTransitionEvidence(report, missing) {
  if (!Array.isArray(report.transitions)) {
    missing.push("transitions is missing or not an array.");
    return;
  }
  const events = new Set(report.transitions.map(transitionEventName).filter(Boolean));
  for (const event of REQUIRED_TRANSITION_EVENTS) {
    if (!events.has(event)) missing.push(`Transition coverage missing: transition:${event}.`);
  }
  if (report.feedback?.hapticsEnabled === true && !events.has("feedback-haptic-test")) {
    missing.push("Transition coverage missing: transition:feedback-haptic-test.");
  }

  const gameStates = report.transitions.filter((transition) => transitionEventName(transition) === "game-state");
  if (!gameStates.some((transition) => numberAt(transition, "activeCount") > 0 && stringAt(transition, "gameStatus") === "dealt")) {
    missing.push("Transition coverage missing: game-state:active-play.");
  }
  if (!gameStates.some((transition) => numberAt(transition, "trayCount") > 0)) {
    missing.push("Transition coverage missing: game-state:picked-tray.");
  }
  if (!gameStates.some((transition) => numberAt(transition, "reserveCount") > 0)) {
    missing.push("Transition coverage missing: game-state:bottom-reserve.");
  }
}

function validateReport(report, options) {
  const failures = [];
  const missing = [];

  if (!isObject(report)) failures.push("Report root is not an object.");
  if (report.schema !== SCHEMA) failures.push(`schema must be ${SCHEMA}.`);
  if (report.verdict !== "pass") failures.push(`verdict must be pass, got ${String(report.verdict)}.`);
  if (Array.isArray(report.failures) && report.failures.length > 0) {
    failures.push(`report.failures is not empty: ${report.failures.join(" | ")}.`);
  }
  if (Array.isArray(report.missingEvidence) && report.missingEvidence.length > 0) {
    missing.push(`report.missingEvidence is not empty: ${report.missingEvidence.join(" | ")}.`);
  }

  const buildId = stringAt(report, "buildId")?.trim() ?? "";
  if (!buildId || buildId === "local-unbound") missing.push("Build ID is missing or local-unbound; set VITE_BUILD_SHA for the QA build.");
  const appVersion = stringAt(report, "appVersion")?.trim() ?? "";
  if (!appVersion) missing.push("appVersion is missing.");
  const sessionId = stringAt(report, "sessionId")?.trim() ?? "";
  if (!sessionId) missing.push("sessionId is missing.");

  if (stringAt(report, "runtime.deviceLabel")?.trim()) {
    // ok
  } else {
    missing.push("runtime.deviceLabel is missing.");
  }
  const viewport = phoneViewportAt(report);
  if (!viewport.ok) {
    missing.push(`runtime.viewport must be a phone-like CSS viewport (${MIN_PHONE_SHORT_EDGE}-${MAX_PHONE_SHORT_EDGE} short edge, ${MIN_PHONE_LONG_EDGE}-${MAX_PHONE_LONG_EDGE} long edge, dpr >= 1); got ${viewport.width}x${viewport.height}@${viewport.dpr}.`);
  }
  if (report.runtime?.secureContext !== true) failures.push("runtime.secureContext must be true.");
  if (report.runtime?.storageAccess === "blocked") failures.push("runtime.storageAccess is blocked.");

  const activeDurationMs = requireNumber(report, "frame.activeDurationMs", missing) ?? 0;
  const medianFps = requireNumber(report, "frame.medianFps", missing) ?? 0;
  const p95FrameMs = requireNumber(report, "frame.p95FrameMs", missing);
  const maxFrameMs = requireNumber(report, "frame.maxFrameMs", missing);
  const longFramePercent = requireNumber(report, "frame.longFramePercent", missing);
  const worstJankBurstFrames = requireNumber(report, "frame.worstJankBurstFrames", missing);
  const sampleCount = requireNumber(report, "frame.sampleCount", missing) ?? 0;
  if (activeDurationMs < MIN_SAMPLE_MS) missing.push(`Frame sample duration ${activeDurationMs}ms is below ${MIN_SAMPLE_MS}ms.`);
  if (sampleCount <= 0) missing.push("No foreground frame samples were recorded.");
  if (medianFps < TARGET_MEDIAN_FPS) failures.push(`Median FPS ${medianFps.toFixed(1)} is below ${TARGET_MEDIAN_FPS}.`);
  if (p95FrameMs !== undefined && p95FrameMs > TARGET_FRAME_MS) failures.push(`P95 frame time ${p95FrameMs.toFixed(1)}ms exceeds ${TARGET_FRAME_MS}ms.`);
  if (maxFrameMs !== undefined && maxFrameMs > MAX_SINGLE_FRAME_MS) failures.push(`Longest foreground frame ${maxFrameMs.toFixed(1)}ms exceeds ${MAX_SINGLE_FRAME_MS}ms.`);
  if (longFramePercent !== undefined && longFramePercent > MAX_LONG_FRAME_PERCENT) failures.push(`Long-frame rate ${longFramePercent.toFixed(2)}% exceeds ${MAX_LONG_FRAME_PERCENT}%.`);
  if (worstJankBurstFrames !== undefined && worstJankBurstFrames > MAX_JANK_BURST_FRAMES) failures.push(`Worst slow-frame burst ${worstJankBurstFrames} frames exceeds ${MAX_JANK_BURST_FRAMES}.`);

  if (report.motion?.permission !== "granted") missing.push("Motion permission was not granted.");
  if ((numberAt(report, "motion.eventCount") ?? 0) <= 0) missing.push("No real devicemotion events were recorded.");
  if ((numberAt(report, "motion.softSignals") ?? 0) <= 0) missing.push("No soft shake signal was recorded.");
  if ((numberAt(report, "motion.strongSignals") ?? 0) <= 0) missing.push("No strong shake signal was recorded.");
  if ((numberAt(report, "motion.acceptedGameShakes") ?? 0) <= 0) missing.push("No accepted device-motion game shake was recorded.");

  if (!isObject(report.feedback)) missing.push("feedback runtime evidence is missing.");
  if (report.feedback?.audioMuted === true) missing.push("Audio was muted during the physical audio-mix run.");
  const audioState = stringAt(report, "feedback.audioContextState") ?? "";
  if (audioState !== "running") missing.push(`AudioContext was not running during the physical audio-mix run: ${audioState || "missing"}.`);
  const decodedSamples = numberAt(report, "feedback.audioDecodedSamples") ?? 0;
  if (decodedSamples < 12) missing.push(`Decoded SFX sample count is incomplete: ${decodedSamples}/12.`);
  if ((numberAt(report, "feedback.qaAudioTestCount") ?? 0) <= 0) {
    missing.push("Device QA audio test button was not used during the recorded run.");
  }
  if (report.feedback?.hapticsEnabled === true && (numberAt(report, "feedback.qaHapticTestCount") ?? 0) <= 0) {
    missing.push("Device QA haptic test button was not used while haptics were enabled.");
  }

  if (!isObject(report.render?.latest)) missing.push("render.latest is missing.");
  const activeVisuals = numberAt(report, "render.peakActiveVisuals") ?? 0;
  if (activeVisuals <= 0) missing.push("render.peakActiveVisuals is missing.");
  if (activeVisuals > MAX_ACTIVE_VISUALS) failures.push(`Active visual ceiling exceeded: ${activeVisuals}.`);
  const escaped = numberAt(report, "render.peakEscapedBodies") ?? 0;
  if (escaped > 0) failures.push(`${escaped} body/bodies escaped the container boundary.`);
  if ((numberAt(report, "render.contextLosses") ?? 0) > 0 && !report.manual?.contextRecovery?.evidence?.trim()) {
    missing.push("WebGL context loss occurred but contextRecovery evidence is missing.");
  }

  if (!isObject(report.stability)) {
    missing.push("stability evidence is missing.");
  } else {
    const cycles = numberAt(report, "stability.restartResumeCycles") ?? 0;
    if (cycles < 20) missing.push(`Run at least 20 start/retry/exit/resume stability cycles; got ${cycles}.`);
    if (report.stability.longLevel15Run !== true) missing.push("Complete at least one long Level 15 stability run.");
    const timeline = stringAt(report, "stability.memoryTimelineEvidence")?.trim() ?? "";
    if (!timeline) {
      missing.push("Memory/GPU timeline evidence is missing.");
    } else if ((options.strictEvidenceFiles || fileLikeEvidence(timeline)) && !evidenceExists(timeline, options.evidenceRoot)) {
      missing.push(`Memory/GPU timeline evidence file not found: ${timeline}${options.evidenceRoot ? ` (root ${options.evidenceRoot})` : ""}.`);
    }
    const memoryTrend = stringAt(report, "stability.memoryTrend") ?? "unknown";
    if (memoryTrend === "unknown") missing.push("Memory/GPU trend must be classified as flat.");
    else if (memoryTrend !== "flat") failures.push(`Memory/GPU timeline shows unacceptable trend: ${memoryTrend}.`);
    const restartSlowdown = stringAt(report, "stability.restartSlowdown") ?? "unknown";
    if (restartSlowdown === "unknown") missing.push("Restart/resume slowdown must be classified as none.");
    else if (restartSlowdown !== "none") failures.push(`Repeated restart/resume cycles became progressively slower: ${restartSlowdown}.`);
    if (report.stability.contextLossLoop === true) failures.push("WebGL context loss loop observed during stability run.");
  }

  validateManualEvidence(report, options.evidenceRoot, options.strictEvidenceFiles, failures, missing);
  validateTransitionEvidence(report, missing);

  return { failures, missing };
}

function main() {
  let options;
  try {
    options = parseArgs(process.argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    usage();
    process.exit(2);
  }
  if (!options.reportPath) {
    usage();
    process.exit(2);
  }
  const reportPath = resolve(options.reportPath);
  const report = readJson(reportPath);
  const { failures, missing } = validateReport(report, options);
  if (failures.length > 0 || missing.length > 0) {
    console.error(`Device QA report rejected: ${basename(reportPath)}`);
    for (const failure of failures) console.error(`FAIL ${failure}`);
    for (const item of missing) console.error(`MISSING ${item}`);
    process.exit(1);
  }
  console.log(`Device QA report accepted: ${basename(reportPath)} · ${report.appVersion} · ${report.buildId}`);
}

main();
