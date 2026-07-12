import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { syncStagedDist } from "./sync-staged-dist.mjs";

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "zhuada-stage-dist-"));
  fs.mkdirSync(path.join(root, "dist", "assets"), { recursive: true });
  fs.writeFileSync(path.join(root, "dist", "index.html"), "<div id=\"root\"></div>");
  fs.writeFileSync(path.join(root, "dist", "assets", "index-new.js"), "console.log('new');");
  const staged = path.resolve(root, "..", "..", "platform", "host-app", "public", "miniapps", "zhuada-e");
  fs.mkdirSync(path.join(staged, "assets"), { recursive: true });
  fs.writeFileSync(path.join(staged, "assets", "index-old.js"), "console.log('old');");
  return { root, staged };
}

describe("staged dist sync", () => {
  it("replaces stale host files with the exact current dist tree", () => {
    const { root, staged } = fixtureRoot();

    const result = syncStagedDist({ root });

    assert.equal(result.files, 2);
    assert.equal(fs.existsSync(path.join(staged, "assets", "index-old.js")), false);
    assert.equal(fs.readFileSync(path.join(staged, "assets", "index-new.js"), "utf8"), "console.log('new');");
    assert.equal(fs.readFileSync(path.join(staged, "index.html"), "utf8"), "<div id=\"root\"></div>");
  });

  it("refuses to stage without a built dist directory", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "zhuada-stage-missing-"));

    assert.throws(
      () => syncStagedDist({ root }),
      /dist\/ does not exist; run npm run build before staging/,
    );
  });
});
