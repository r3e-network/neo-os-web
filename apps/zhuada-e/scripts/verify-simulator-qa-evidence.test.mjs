import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const verifier = path.join(root, "scripts", "verify-simulator-qa-evidence.mjs");

function tempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "zhuada-simulator-qa-"));
}

function writeFixture(overrides = {}) {
  const dir = tempDir();
  fs.writeFileSync(path.join(dir, "ios.png"), "png");
  fs.writeFileSync(path.join(dir, "android.png"), "png");
  const report = {
    schema: "zhuada-e-simulator-qa-v1",
    appVersion: "3.1.0",
    devUrl: "http://localhost:5174/?simQa=1",
    distDigest: "c9887f23c297637117dc96d8b2ea62926c951cbac0f1b6f016efbce2ef65ed81",
    verifiedAt: "2026-07-12T02:10:00+08:00",
    themesCovered: ["fresh-market", "farm-kitchen", "night-market"],
    ios: {
      simulator: "iPhone 17 Pro",
      runtime: "iOS 26.5 Safari",
      screenshot: "ios.png",
      gameVisible: true,
      topViewVisible: true,
      trayVisible: true,
      singleTrayLayout: true,
    },
    android: {
      emulator: "onegate_api36",
      runtime: "Android Emulator Chrome 133",
      url: "http://10.0.2.2:5174/?simQa=1",
      networkBridge: "emulator-host-loopback",
      screenshotAfterPick: "android.png",
      gameVisible: true,
      topViewVisible: true,
      trayVisible: true,
      singleTrayLayout: true,
      webglCanvasPresent: true,
      androidFallbackActive: true,
      fallbackReason: "Android emulator Chrome blank WebGL canvas; real-asset fallback active.",
      fallbackItemsAfterPick: 17,
      pickProof: {
        trayCountBefore: 0,
        trayCountAfter: 1,
        bodyTextAfterPick: "Tray: 1/7.",
      },
    },
    ...overrides,
  };
  const file = path.join(dir, "report.json");
  fs.writeFileSync(file, JSON.stringify(report, null, 2));
  return file;
}

function run(file, ...args) {
  return spawnSync(process.execPath, [verifier, file, ...args], {
    cwd: root,
    encoding: "utf8",
  });
}

describe("simulator QA evidence verifier", () => {
  it("accepts iOS plus Android playable simulator evidence", () => {
    const result = run(writeFixture());
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    assert.match(result.stdout, /Simulator QA evidence accepted/);
  });

  it("rejects Android evidence that does not prove a pick changed the tray", () => {
    const file = writeFixture({
      android: {
        emulator: "onegate_api36",
        runtime: "Android Emulator Chrome 133",
        url: "http://10.0.2.2:5174/?simQa=1",
        networkBridge: "emulator-host-loopback",
        screenshotAfterPick: "android.png",
        gameVisible: true,
        topViewVisible: true,
        trayVisible: true,
        singleTrayLayout: true,
        webglCanvasPresent: true,
        androidFallbackActive: true,
        fallbackReason: "fallback active",
        fallbackItemsAfterPick: 17,
        pickProof: {
          trayCountBefore: 1,
          trayCountAfter: 1,
          bodyTextAfterPick: "Tray: 1/7.",
        },
      },
    });
    const result = run(file);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /tray count increasing/);
  });

  it("accepts adb reverse when the dev server only listens on host localhost", () => {
    const file = writeFixture({
      android: {
        emulator: "onegate_api36",
        runtime: "Android Emulator Chrome 133",
        url: "http://127.0.0.1:5174/?simQa=1",
        networkBridge: "adb-reverse",
        reverseCommand: "adb -s emulator-5554 reverse tcp:5174 tcp:5174",
        screenshotAfterPick: "android.png",
        gameVisible: true,
        topViewVisible: true,
        trayVisible: true,
        singleTrayLayout: true,
        webglCanvasPresent: true,
        androidFallbackActive: false,
        pickProof: {
          trayCountBefore: 0,
          trayCountAfter: 1,
          bodyTextAfterPick: "Tray: 1/7.",
        },
      },
    });
    const result = run(file);
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
  });

  it("rejects missing Android localhost bridge evidence", () => {
    const file = writeFixture({
      android: {
        emulator: "onegate_api36",
        runtime: "Android Emulator Chrome 133",
        url: "http://127.0.0.1:5174/?simQa=1",
        screenshotAfterPick: "android.png",
        gameVisible: true,
        topViewVisible: true,
        trayVisible: true,
        singleTrayLayout: true,
        webglCanvasPresent: true,
        androidFallbackActive: false,
        pickProof: {
          trayCountBefore: 0,
          trayCountAfter: 1,
          bodyTextAfterPick: "Tray: 1/7.",
        },
      },
    });
    const result = run(file);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /networkBridge is missing/);
  });

  it("rejects missing all-theme coverage", () => {
    const result = run(writeFixture({ themesCovered: ["fresh-market", "farm-kitchen"] }));
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /themesCovered missing night-market/);
  });
});
