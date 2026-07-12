#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));

const schema = "zhuada-e-device-qa-v1";
const requiredThemes = ["fresh-market", "farm-kitchen", "night-market"];
const requiredTransitionEvents = [
  "game-state",
  "motion-signal",
  "game-shake",
  "feedback-audio-test",
  "feedback-haptic-test when haptics are enabled",
  "game-state active play with reserveCount > 0 and trayCount > 0",
];
const manualChecks = [
  ["permissionFallback", "拒绝/阻止运动权限后，屏幕按钮仍可玩"],
  ["softShakeControlled", "轻甩只扰动部分物件，反馈可控"],
  ["strongShakeContained", "重甩翻动更强，但没有物件飞出容器"],
  ["audioAudible", "首次操作、碰撞、三消、胜负和环境音可辨且无爆音"],
  ["hapticsVerified", "触觉可感知，或不支持时能静默降级"],
  ["orientationSafe", "旋转与安全区没有遮挡、横滚或误触"],
  ["backgroundResume", "切后台/锁屏后计时和局内恢复符合规则"],
  ["contextRecovery", "WebGL 中断时出现恢复入口，重试后可继续"],
  ["fullFlow", "三主题完整走过匹配、补货、道具、胜负、重开与续局"],
];

function usage() {
  console.error([
    "Usage: node scripts/init-device-qa-evidence.mjs <output-dir> [--session <id>] [--build <sha>] [--device <label>] [--force]",
    "",
    "Creates a local-only physical-device QA evidence bundle skeleton.",
    "It does not mark evidence as passed; testers must fill it from the in-game Device QA panel export.",
  ].join("\n"));
}

function parseArgs(argv) {
  const args = argv.slice(2);
  let outDir = "";
  let session = "";
  let build = process.env.VITE_BUILD_SHA || "";
  let device = "";
  let force = false;
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--session") {
      session = args[++i] ?? "";
    } else if (arg === "--build") {
      build = args[++i] ?? "";
    } else if (arg === "--device") {
      device = args[++i] ?? "";
    } else if (arg === "--force") {
      force = true;
    } else if (!outDir) {
      outDir = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }
  if (!outDir) throw new Error("Missing output directory.");
  return {
    outDir: path.resolve(outDir),
    session: session || `device-${new Date().toISOString().replace(/[:.]/g, "-")}`,
    build: build || "local-unbound",
    device,
    force,
  };
}

function writeNew(file, content, force) {
  if (!force && fs.existsSync(file)) {
    throw new Error(`${path.relative(process.cwd(), file)} already exists. Pass --force to overwrite generated templates.`);
  }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function manualTemplate() {
  return Object.fromEntries(
    manualChecks.map(([key]) => [
      key,
      {
        status: "pending",
        note: key === "fullFlow" ? `Must include ${requiredThemes.join(", ")}.` : "",
        evidence: `evidence/${key}/`,
      },
    ]),
  );
}

function reportTemplate(options) {
  const now = new Date().toISOString();
  return {
    schema,
    verdict: "incomplete",
    privacy: "local-only; no automatic upload",
    failures: [],
    missingEvidence: [
      "Replace this template with the JSON exported by the in-game Device QA panel before signoff.",
    ],
    appVersion: packageJson.version,
    buildId: options.build,
    sessionId: options.session,
    startedAt: now,
    generatedAt: now,
    runtime: {
      deviceLabel: options.device,
      userAgent: "",
      platform: "",
      language: "",
      viewport: { width: 0, height: 0, dpr: 0 },
      orientation: "",
      secureContext: false,
      online: true,
      reducedMotion: false,
      embedded: false,
      storageAccess: "blocked",
      entryAssets: [],
    },
    frame: {
      sampleCount: 0,
      activeDurationMs: 0,
      p50FrameMs: 0,
      p95FrameMs: 0,
      maxFrameMs: 0,
      medianFps: 0,
      slowFramePercent: 0,
      longFramePercent: 0,
      jankBurstCount: 0,
      worstJankBurstFrames: 0,
      backgroundGapCount: 0,
    },
    motion: {
      permission: "unknown",
      enabled: false,
      eventCount: 0,
      eventRateHz: 0,
      lastEventAt: null,
      lastRawMagnitude: 0,
      maxRawMagnitude: 0,
      directAccelerationEvents: 0,
      gravityIncludedEvents: 0,
      softSignals: 0,
      strongSignals: 0,
      lastSignalAt: null,
      lastSignalIntensity: 0,
      lastSignalMagnitude: 0,
      acceptedGameShakes: 0,
      cooldownRejected: 0,
    },
    feedback: {
      audioMuted: true,
      audioContextState: "not-created",
      audioDecodedSamples: 0,
      audioLoadingSamples: 0,
      ambienceName: "",
      ambiencePlaying: false,
      hapticsSupported: false,
      hapticsEnabled: false,
      qaAudioTestCount: 0,
      qaHapticTestCount: 0,
    },
    render: {
      latest: null,
      peakDrawCalls: 0,
      peakTriangles: 0,
      peakActiveVisuals: 0,
      peakPhysicsBodies: 0,
      peakEscapedBodies: 0,
      peakHorizontalVelocity: 0,
      peakVerticalVelocity: 0,
      contextLosses: 0,
    },
    stability: {
      restartResumeCycles: 0,
      longLevel15Run: false,
      memoryTimelineEvidence: "evidence/stability/memory-timeline.json",
      memoryTrend: "unknown",
      restartSlowdown: "unknown",
      contextLossLoop: false,
      notes: "",
    },
    game: {
      gameStatus: "idle",
      level: 0,
      themeId: "",
      activeCount: 0,
      reserveCount: 0,
      trayCount: 0,
      shakeNonce: 0,
      lastStatus: "",
    },
    manual: manualTemplate(),
    transitions: [],
  };
}

function checklist(options) {
  return [
    `# Device QA evidence bundle — ${options.session}`,
    "",
    `App version: ${packageJson.version}`,
    `Build ID: ${options.build}`,
    `Device: ${options.device || "<fill physical device / OS / browser>"}`,
    "",
    "## Required flow",
    "",
    "1. Build the instrumented bundle:",
    "",
    "   ```bash",
    "   VITE_BUILD_SHA=<git-sha> npm run build:device-qa",
    "   ```",
    "",
    "2. Open the device QA build over HTTPS or a secure localhost tunnel with `?deviceQa=1`.",
    "3. In the in-game Device QA panel, enter the physical device label.",
    "4. Record the run and attach evidence under the matching `evidence/<key>/` folders.",
    "5. While recording, exercise the required runtime transition events:",
    "",
    ...requiredTransitionEvents.map((event) => `   - ${event}`),
    "",
    "6. Record stability evidence: 20 start/retry/exit/resume cycles, at least one long Level 15 run, foreground frame continuity with no visible jank bursts, and a memory/GPU timeline at `evidence/stability/memory-timeline.json`.",
    "7. Copy/export the in-game JSON report and replace `device-report.template.json` with the exported report.",
    "8. Verify offline before signoff:",
    "",
    "   ```bash",
    `   npm run device-qa:verify -- ${options.session}.json --evidence-root ${path.basename(options.outDir)} --strict-evidence-files`,
    "   ```",
    "",
    "## Manual checks",
    "",
    ...manualChecks.map(([key, label]) => `- [ ] ${key}: ${label} — evidence/${key}/`),
    "- [ ] stability: 20 restart/resume cycles, one long Level 15 run, flat memory/GPU trend, no restart slowdown, no context-loss loop — evidence/stability/",
    "",
    `Full-flow evidence must explicitly include: ${requiredThemes.join(", ")}`,
    `Runtime transition evidence must include: ${requiredTransitionEvents.join("; ")}`,
    "",
    "The template starts as `incomplete` by design. Only the in-game panel export plus the offline verifier can promote a device run to pass.",
    "",
  ].join("\n");
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

  fs.mkdirSync(options.outDir, { recursive: true });
  for (const [key, label] of manualChecks) {
    const transitionHint = key === "fullFlow"
      ? `\nRequired runtime transitions in exported JSON:\n${requiredTransitionEvents.map((event) => `- ${event}`).join("\n")}\n`
      : "";
    writeNew(path.join(options.outDir, "evidence", key, "README.md"), `${label}\n\nPut recordings, traces, screenshots, or lab notes for ${key} here.${transitionHint}\n`, options.force);
  }
  writeNew(path.join(options.outDir, "evidence", "stability", "README.md"), [
    "Long-session memory/GPU stability",
    "",
    "Required before release signoff:",
    "- 20 start/retry/exit/resume cycles",
    "- at least one long Level 15 run",
    "- memory/GPU timeline saved as memory-timeline.json",
    "- memoryTrend = flat",
    "- restartSlowdown = none",
    "- contextLossLoop = false",
    "",
  ].join("\n"), options.force);
  writeNew(path.join(options.outDir, "README.md"), checklist(options), options.force);
  writeNew(path.join(options.outDir, "device-report.template.json"), `${JSON.stringify(reportTemplate(options), null, 2)}\n`, options.force);

  console.log(`Device QA evidence bundle initialized: ${options.outDir}`);
  console.log(`Next: replace device-report.template.json with the in-game export, then run npm run device-qa:verify -- <report.json> --evidence-root ${options.outDir} --strict-evidence-files`);
}

main();
