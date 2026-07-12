import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const script = path.join(root, "scripts", "init-device-qa-evidence.mjs");

function run(args) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

describe("init-device-qa-evidence", () => {
  it("creates a physical-device QA evidence skeleton without passing the run", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zhuada-device-qa-"));
    const result = run([dir, "--session", "device-test", "--build", "abc123", "--device", "iPhone 15 / Safari"]);
    assert.equal(result.status, 0, result.stderr);

    const report = JSON.parse(fs.readFileSync(path.join(dir, "device-report.template.json"), "utf8"));
    assert.equal(report.schema, "zhuada-e-device-qa-v1");
    assert.equal(report.verdict, "incomplete");
    assert.equal(report.buildId, "abc123");
    assert.equal(report.runtime.deviceLabel, "iPhone 15 / Safari");
    assert.equal(report.feedback.audioContextState, "not-created");
    assert.equal(report.feedback.qaAudioTestCount, 0);
    assert.equal(report.feedback.qaHapticTestCount, 0);
    assert.equal(report.frame.maxFrameMs, 0);
    assert.equal(report.frame.longFramePercent, 0);
    assert.equal(report.frame.jankBurstCount, 0);
    assert.equal(report.frame.worstJankBurstFrames, 0);
    assert.equal(report.stability.restartResumeCycles, 0);
    assert.equal(report.stability.memoryTrend, "unknown");
    assert.equal(report.stability.memoryTimelineEvidence, "evidence/stability/memory-timeline.json");
    assert.equal(report.manual.fullFlow.note.includes("fresh-market, farm-kitchen, night-market"), true);

    for (const key of [
      "permissionFallback",
      "softShakeControlled",
      "strongShakeContained",
      "audioAudible",
      "hapticsVerified",
      "orientationSafe",
      "backgroundResume",
      "contextRecovery",
      "fullFlow",
    ]) {
      assert.equal(fs.existsSync(path.join(dir, "evidence", key, "README.md")), true, `${key} folder missing`);
    }

    const readme = fs.readFileSync(path.join(dir, "README.md"), "utf8");
    assert.match(readme, /npm run build:device-qa/);
    assert.match(readme, /--strict-evidence-files/);
    assert.match(readme, /motion-signal/);
    assert.match(readme, /game-shake/);
    assert.match(readme, /feedback-audio-test/);
    assert.match(readme, /feedback-haptic-test when haptics are enabled/);
    assert.match(readme, /reserveCount > 0 and trayCount > 0/);
    assert.match(readme, /20 start\/retry\/exit\/resume cycles/);
    assert.match(readme, /foreground frame continuity with no visible jank bursts/);
    assert.match(readme, /memory\/GPU timeline/);

    const fullFlowReadme = fs.readFileSync(path.join(dir, "evidence", "fullFlow", "README.md"), "utf8");
    assert.match(fullFlowReadme, /Required runtime transitions/);
    const stabilityReadme = fs.readFileSync(path.join(dir, "evidence", "stability", "README.md"), "utf8");
    assert.match(stabilityReadme, /Long-session memory\/GPU stability/);
  });

  it("refuses to overwrite existing evidence unless explicitly forced", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zhuada-device-qa-"));
    assert.equal(run([dir]).status, 0);
    const second = run([dir]);
    assert.notEqual(second.status, 0);
    assert.match(second.stderr, /already exists/);
    assert.equal(run([dir, "--force"]).status, 0);
  });
});
