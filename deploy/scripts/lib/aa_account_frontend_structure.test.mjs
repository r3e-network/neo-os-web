import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
);

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), "utf8");
}

test("AA Account Lab exposes a guarded wallet-style account registration workspace", () => {
  const playArea = read("apps/aa-account-lab/src/PlayArea.tsx");
  const styles = read("apps/aa-account-lab/src/PlayArea.scss");
  const messages = read("apps/aa-account-lab/src/locale/messages.ts");

  assert.match(playArea, /className="account-hero"/);
  assert.match(playArea, /className="account-hero__metrics"/);
  assert.match(playArea, /className="account-flow"/);
  assert.match(playArea, /className="account-workspace"/);
  assert.match(playArea, /const canInspect =/);
  assert.match(playArea, /const canRegister =/);
  assert.match(playArea, /disabled=\{!canInspect/);
  assert.match(playArea, /disabled=\{!canRegister/);
  assert.match(styles, /\.aa-account-play-area button:disabled/);
  assert.match(messages, /accountHeroTitle/);
  assert.match(messages, /accountFlowRegister/);
  assert.match(messages, /inspectBlocked/);
  assert.match(messages, /registerBlocked/);
});
