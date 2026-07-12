import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { digestDist } from "./digest-dist.mjs";

describe("dist digest", () => {
  it("hashes the sorted relative file manifest", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "zhuada-dist-digest-"));
    fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), "<html></html>");
    fs.writeFileSync(path.join(dir, "assets", "app.js"), "console.log('goose');");
    const first = digestDist(dir);
    const second = digestDist(dir);
    assert.equal(first.files, 2);
    assert.equal(first.digest, second.digest);
    assert.match(first.manifest, /assets\/app\.js/);
    assert.match(first.manifest, /index\.html/);

    fs.writeFileSync(path.join(dir, "assets", "app.js"), "console.log('goose-v2');");
    assert.notEqual(digestDist(dir).digest, first.digest);
  });
});
