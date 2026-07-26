import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptTests = [
  "scripts/init-device-qa-evidence.test.mjs",
  "scripts/audio-quality.test.mjs",
  "scripts/image-quality.test.mjs",
  "scripts/digest-dist.test.mjs",
  "scripts/release-audit.test.mjs",
  "scripts/sync-staged-dist.test.mjs",
  "scripts/verify-device-qa-env.test.mjs",
  "scripts/verify-production-bundle.test.mjs",
  "scripts/verify-device-qa-bundle.test.mjs",
  "scripts/verify-device-qa-report.test.mjs",
  "scripts/verify-device-qa-suite.test.mjs",
  "scripts/verify-simulator-qa-evidence.test.mjs",
];
const vitest = fileURLToPath(new URL("../../../node_modules/vitest/vitest.mjs", import.meta.url));
const groups = [
  [
    "src/logic/device-motion.test.ts",
    "src/logic/use-device-shake.test.tsx",
    "src/logic/device-qa.test.ts",
    "src/logic/engine-zhuada.test.ts",
    "src/logic/game-rules.production.test.ts",
    "src/logic/game-rules.test.ts",
    "src/logic/game-storage.test.ts",
    "src/logic/guest-engine.test.ts",
    "src/logic/item-stream.test.ts",
    "src/logic/motion-quality.test.ts",
    "src/logic/progress-store.test.ts",
    "src/logic/progress.test.ts",
    "src/logic/shake-dynamics.test.ts",
    "src/logic/sound.test.ts",
    "src/logic/themes.test.ts",
    "src/logic/tray-motion.test.ts",
  ],
  ["src/PlayArea.accessibility.test.tsx"],
  ["src/DeviceQaPanel.test.tsx"],
  ["src/AnimatedTray.test.tsx"],
  ["src/ThreeGameComponent.test.tsx", "src/GooseChip.test.ts"],
  [
    "src/scenes/model-cache.test.ts",
    "src/scenes/pile-density.test.ts",
    "src/scenes/pile-dynamics.test.ts",
    "src/scenes/pick-lock.test.ts",
    "src/scenes/physics-profiles.test.ts",
    "src/scenes/pick-raycast.test.ts",
    "src/scenes/render-quality.test.ts",
  ],
];

for (const file of scriptTests) {
  const run = spawnSync(process.execPath, [
    "--test",
    file,
  ], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: process.env,
    stdio: "inherit",
  });
  if (run.status !== 0) process.exit(run.status ?? 1);
}

for (const files of groups) {
  const run = spawnSync(process.execPath, [
    vitest,
    "run",
    "--maxWorkers=1",
    ...files,
  ], {
    cwd: fileURLToPath(new URL("..", import.meta.url)),
    env: process.env,
    stdio: "inherit",
  });
  if (run.status !== 0) process.exit(run.status ?? 1);
}
