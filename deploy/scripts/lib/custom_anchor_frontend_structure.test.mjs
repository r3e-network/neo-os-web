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

test("Custom Anchor renders a complete wallet-style anchor workspace", () => {
  const playArea = read("apps/custom-anchor/src/PlayArea.tsx");
  const styles = read("apps/custom-anchor/src/PlayArea.scss");
  const messages = read("apps/custom-anchor/src/locale/messages.ts");

  assert.match(playArea, /className="custom-anchor-workspace"/);
  assert.match(playArea, /className="custom-anchor-flow"/);
  assert.match(playArea, /className="custom-anchor-id-card"/);
  assert.match(playArea, /className="custom-anchor-status-card"/);
  assert.match(playArea, /className="custom-anchor-guidance-grid"/);
  assert.match(playArea, /className="custom-anchor-flow__number"/);
  assert.match(playArea, /lastTxid/);

  assert.match(styles, /\.custom-anchor-workspace\s*\{/);
  assert.match(styles, /\.custom-anchor-workspace\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.05fr\)\s+minmax\(300px,\s*0\.95fr\)/s);
  assert.match(styles, /\.custom-anchor-flow\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(styles, /\.standalone-dapp-root \.custom-anchor-flow span\.custom-anchor-flow__number\s*\{[^}]*color:\s*#fff\s*!important/s);
  assert.match(styles, /\.custom-anchor-id-card\s*\{[^}]*linear-gradient/s);
  assert.match(styles, /\.custom-anchor-status-card\s*\{[^}]*min-height:\s*100%/s);
  assert.match(styles, /@media \(max-width: 860px\)[\s\S]*\.custom-anchor-workspace\s*\{[^}]*grid-template-columns:\s*1fr/s);

  assert.match(messages, /anchorFlowOpen/);
  assert.match(messages, /anchorFlowAction/);
  assert.match(messages, /anchorFlowSign/);
  assert.match(messages, /launchSource/);
  assert.match(messages, /lastTxid/);
});
