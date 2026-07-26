import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  requiredProductionFiles,
  verifyProductionBundle,
} from "./verify-production-bundle.mjs";

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zhuada-production-bundle-"));
  fs.mkdirSync(path.join(root, "dist", "assets"), { recursive: true });
  for (const file of requiredProductionFiles) {
    fs.mkdirSync(path.dirname(path.join(root, "dist", file)), { recursive: true });
    fs.writeFileSync(path.join(root, "dist", file), file.endsWith(".json") ? "{\"name\":\"goose\"}" : "asset");
  }
  fs.writeFileSync(path.join(root, "dist", "assets", "index.js"), "console.log('goose basket');");
  return root;
}

describe("production bundle verifier", () => {
  it("requires all nine collection-goose portraits in a production bundle", () => {
    assert.deepEqual(
      requiredProductionFiles.filter((file) => file.startsWith("art/geese/")),
      Array.from(
        { length: 9 },
        (_, index) => `art/geese/goose-${String(index).padStart(2, "0")}.webp`,
      ),
    );
  });

  it("scans production CSS so Device QA panel styles cannot leak", () => {
    const root = fixtureRoot();
    fs.writeFileSync(path.join(root, "dist", "assets", "index.css"), ".device-qa{display:block}/* Device QA */");

    assert.throws(
      () => verifyProductionBundle({ root }),
      /production runtime leak in assets\/index\.css: Device QA/,
    );
  });

  it("accepts clean html, js, css and json runtime files", () => {
    const root = fixtureRoot();
    fs.writeFileSync(path.join(root, "dist", "assets", "index.css"), ".goose-stage{display:block}");
    fs.writeFileSync(path.join(root, "dist", "assets", "manifest.json"), "{\"name\":\"goose\"}");

    assert.deepEqual(verifyProductionBundle({ root }), {
      runtimeFiles: 5,
      requiredFiles: requiredProductionFiles.length,
    });
  });

  it("rejects a production dist missing any required art, audio, manifest, or notice file", () => {
    const root = fixtureRoot();
    fs.rmSync(path.join(root, "dist", "audio", "shake.wav"));

    assert.throws(
      () => verifyProductionBundle({ root }),
      /production bundle missing required asset: audio\/shake\.wav/,
    );
  });
});
