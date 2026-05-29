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

function assertOnlyZeroLetterSpacing(styles, appName) {
  const values = [...styles.matchAll(/letter-spacing:\s*([^;]+);/g)].map(
    (match) => match[1].trim(),
  );
  assert.ok(values.length > 0, `${appName} should declare letter spacing`);
  assert.deepEqual(values, values.map(() => "0"), appName);
}

const APPS = [
  { slug: "trustanchor-admin", name: "TrustAnchor Admin" },
  { slug: "profitanchor-admin", name: "ProfitAnchor Admin" },
];

test("Anchor admin miniapps render a complete wallet-style operator console", () => {
  for (const app of APPS) {
    const playArea = read(`apps/${app.slug}/src/PlayArea.tsx`);
    const styles = read(`apps/${app.slug}/src/PlayArea.scss`);
    const messages = read(`apps/${app.slug}/src/messages.ts`);

    for (const className of [
      "anchor-admin-shell",
      "anchor-admin-command-grid",
      "anchor-admin-route-map",
      "anchor-admin-workflow-card",
      "anchor-admin-agent-strip",
      "anchor-admin-safety-card",
    ]) {
      assert.match(
        playArea,
        new RegExp(`className="[^"]*${className}`),
        `${app.name} missing ${className}`,
      );
    }

    assert.match(playArea, /dispatch\("transferAgentNeo"/, app.name);
    assert.match(playArea, /dispatch\("setAgentCandidate"/, app.name);
    assert.match(playArea, /dispatch\("voteAgent"/, app.name);
    assert.match(playArea, /NeoInput/, `${app.name} should expose form fields`);
    assert.match(playArea, /NeoButton/, `${app.name} should expose actions`);
    assert.match(playArea, /agentAccounts\.slice\(0,\s*21\)/, app.name);

    for (const key of [
      "adminHeroTitle",
      "adminHeroSubtitle",
      "routeMapTitle",
      "moveNeo",
      "setCandidate",
      "syncVote",
      "agentDirectoryTitle",
      "operatorRule",
    ]) {
      assert.match(messages, new RegExp(`${key}:`), `${app.name} ${key}`);
    }

    assert.match(styles, /\.anchor-admin-shell\s*\{/);
    assert.match(
      styles,
      /\.anchor-admin-shell\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*0\.78fr\)\s+minmax\(320px,\s*0\.42fr\)/s,
      app.name,
    );
    assert.match(
      styles,
      /\.anchor-admin-command-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s,
      app.name,
    );
    assert.match(
      styles,
      /\.anchor-admin-agent-strip\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s,
      app.name,
    );
    assert.match(
      styles,
      /@media \(max-width: 880px\)[\s\S]*\.anchor-admin-shell\s*\{[^}]*grid-template-columns:\s*1fr/s,
      app.name,
    );
    assert.match(
      styles,
      /@media \(max-width: 640px\)[\s\S]*\.anchor-admin-command-grid\s*\{[^}]*grid-template-columns:\s*1fr/s,
      app.name,
    );

    assertOnlyZeroLetterSpacing(styles, app.name);
    assert.doesNotMatch(styles, /text-transform:\s*uppercase/, app.name);
    assert.doesNotMatch(styles, /font-size:\s*clamp\(/, app.name);
    assert.doesNotMatch(styles, /radial-gradient/i, app.name);
    assert.doesNotMatch(styles, /border-radius:\s*(?:2[0-9]|[3-9][0-9])px/, app.name);
  }
});
