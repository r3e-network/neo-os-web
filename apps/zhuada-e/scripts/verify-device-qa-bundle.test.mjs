import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { requiredProductionFiles } from "./verify-production-bundle.mjs";
import { verifyDeviceQaBundle } from "./verify-device-qa-bundle.mjs";

const requiredRuntimeText = [
  "Device QA",
  "zhuada-e-device-qa-v1",
  "zhuada-e:device-qa-render",
  "zhuada-e:device-qa-frame",
  "zhuada-e:device-qa-shake",
  "fresh-market",
  "farm-kitchen",
  "night-market",
].join("\n");

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zhuada-device-qa-bundle-"));
  for (const file of requiredProductionFiles) {
    fs.mkdirSync(path.dirname(path.join(root, "dist-device-qa", file)), { recursive: true });
    fs.writeFileSync(path.join(root, "dist-device-qa", file), file.endsWith(".json") ? "{\"name\":\"goose\"}" : "asset");
  }
  fs.mkdirSync(path.join(root, "dist-device-qa", "assets"), { recursive: true });
  fs.writeFileSync(path.join(root, "dist-device-qa", "assets", "index-a.js"), requiredRuntimeText);
  fs.writeFileSync(path.join(root, "dist-device-qa", "assets", "ZhuaDaScene-a.js"), "scene");
  fs.writeFileSync(path.join(root, "dist-device-qa", "assets", "three-render-a.js"), "three");
  fs.writeFileSync(path.join(root, "dist-device-qa", "assets", "physics-engine-a.js"), "physics");
  fs.writeFileSync(path.join(root, "dist-device-qa", "assets", "DeviceQaPanel-a.js"), "panel");
  return root;
}

describe("Device QA bundle verifier", () => {
  it("accepts a QA bundle with instrumentation and complete production assets", () => {
    const root = fixtureRoot();
    const result = verifyDeviceQaBundle({ root });
    assert.equal(result.requiredFiles, requiredProductionFiles.length);
    assert.equal(result.panel, "DeviceQaPanel-a.js");
  });

  it("rejects a QA bundle missing any required art, audio, manifest, or notice file", () => {
    const root = fixtureRoot();
    fs.rmSync(path.join(root, "dist-device-qa", "art", "container-night-market.webp"));

    assert.throws(
      () => verifyDeviceQaBundle({ root }),
      /Device QA bundle missing required asset: art\/container-night-market\.webp/,
    );
  });
});
