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

const APPS = [
  { slug: "trustanchor", name: "TrustAnchor" },
  { slug: "profitanchor", name: "ProfitAnchor" },
];

test("Anchor staking miniapps render a complete wallet-style routing workspace", () => {
  for (const app of APPS) {
    const playArea = read(`apps/${app.slug}/src/PlayArea.tsx`);
    const styles = read(`apps/${app.slug}/src/PlayArea.scss`);

    assert.match(playArea, /className="anchor-workspace"/, app.name);
    assert.match(playArea, /className="anchor-status-card"/, app.name);
    assert.match(playArea, /className="anchor-flow"/, app.name);
    assert.match(playArea, /className="anchor-flow__number"/, app.name);
    assert.match(playArea, /className="anchor-guidance-grid"/, app.name);
    assert.match(playArea, /className="anchor-route-card"/, app.name);
    assert.match(playArea, /details className="neo-card anchor-routing-model" open/, app.name);
    assert.match(playArea, /selectedAgent/, app.name);
    assert.match(playArea, /agentCount \|\| agentAccounts\.length \|\| 21/, app.name);

    assert.match(styles, /\.anchor-workspace\s*\{/);
    assert.match(
      styles,
      /\.anchor-workspace\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.05fr\)\s+minmax\(300px,\s*0\.95fr\)/s,
    );
    assert.match(
      styles,
      /\.anchor-flow\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s,
    );
    assert.match(
      styles,
      /\.standalone-dapp-root \.anchor-flow span\.anchor-flow__number\s*\{[^}]*color:\s*#fff\s*!important/s,
    );
    assert.match(styles, /\.anchor-route-card\s*\{[^}]*linear-gradient/s);
    assert.match(styles, /\.anchor-status-card\s*\{[^}]*min-height:\s*100%/s);
    assert.match(
      styles,
      /@media \(max-width: 860px\)[\s\S]*\.anchor-workspace\s*\{[^}]*grid-template-columns:\s*1fr/s,
    );
  }
});
