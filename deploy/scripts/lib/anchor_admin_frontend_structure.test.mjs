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

// Neo Soft redesign adopted uppercase eyebrow labels with positive
// letter-spacing tracking as the intentional design language, so the old
// "every letter-spacing must be 0" guard is obsolete. Instead we positively
// assert the eyebrow tracking exists and is applied as a deliberate value.
function assertNeoSoftEyebrowTracking(styles, appName) {
  const values = [...styles.matchAll(/letter-spacing:\s*([^;]+);/g)].map(
    (match) => match[1].trim(),
  );
  assert.ok(values.length > 0, `${appName} should declare letter spacing`);
  assert.ok(
    values.includes("0.12em"),
    `${appName} should keep the Neo Soft eyebrow tracking (0.12em)`,
  );
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
      // Neo Soft redesign folded the live route map into the hero stat grid:
      // the routeItems (selected route / agents / tracked NEO / reserve) now
      // render as anchor-admin-hero-stats instead of a standalone route map.
      "anchor-admin-hero-stats",
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

    // Both consoles wire the three fund-moving actions to platform dispatch.
    // TrustAnchor calls dispatch() directly inside its submit callbacks, while
    // ProfitAnchor routes through a runDispatch() in-flight guard that forwards
    // to dispatch(name, ...args); accept either real dispatch-family call.
    assert.match(playArea, /\b(?:run)?[Dd]ispatch\("transferAgentNeo"/, app.name);
    assert.match(playArea, /\b(?:run)?[Dd]ispatch\("setAgentCandidate"/, app.name);
    assert.match(playArea, /\b(?:run)?[Dd]ispatch\("voteAgent"/, app.name);
    // Whichever path is used, it must ultimately reach the platform dispatch.
    assert.match(
      playArea,
      /\bawait dispatch\(/,
      `${app.name} should forward operator actions to platform dispatch`,
    );
    assert.match(playArea, /NeoInput/, `${app.name} should expose form fields`);
    assert.match(playArea, /NeoButton/, `${app.name} should expose actions`);
    assert.match(playArea, /agentAccounts\.slice\(0,\s*21\)/, app.name);
    // The live route map data still renders, now via the routeItems array that
    // feeds the hero stat grid (selected route / agents / tracked NEO / reserve).
    assert.match(
      playArea,
      /const routeItems = \[/,
      `${app.name} should build the live route map items`,
    );
    assert.match(
      playArea,
      /label:\s*t\("selectedRoute"\)/,
      `${app.name} route map should surface the selected route`,
    );
    assert.match(
      playArea,
      /className="[^"]*anchor-admin-hero-stat"/,
      `${app.name} should render route items as hero stats`,
    );

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
    // The hero stat grid now hosts the live route map (4 route items).
    assert.match(
      styles,
      /\.anchor-admin-hero-stats\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s,
      app.name,
    );
    // The agent directory renders its agent rows in a multi-column grid; the
    // Neo Soft redesign moved that grid onto anchor-admin-agent-list (2 cols)
    // rather than the agent-strip container itself.
    assert.match(
      styles,
      /\.anchor-admin-agent-list\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/s,
      app.name,
    );
    assert.match(
      styles,
      /@media \(max-width: 880px\)[\s\S]*\.anchor-admin-shell\s*\{[^}]*grid-template-columns:\s*1fr/s,
      app.name,
    );
    // Command grid collapses to a single column on narrow viewports. The Neo
    // Soft layout drops it to 1fr at the 1060px breakpoint (standalone rule).
    assert.match(
      styles,
      /@media \(max-width: 1060px\)[\s\S]*\.anchor-admin-command-grid\s*\{[^}]*grid-template-columns:\s*1fr/s,
      app.name,
    );

    // Neo Soft intentionally uses uppercase eyebrow labels with 0.12em
    // tracking, so the old zero-letter-spacing / no-uppercase guards are
    // replaced with positive guards that lock in that design language.
    assertNeoSoftEyebrowTracking(styles, app.name);
    assert.match(
      styles,
      /\.anchor-admin-kicker\s*\{[^}]*letter-spacing:\s*0\.12em;[^}]*text-transform:\s*uppercase/s,
      `${app.name} should keep the uppercase eyebrow kicker`,
    );
    assert.doesNotMatch(styles, /font-size:\s*clamp\(/, app.name);
    assert.doesNotMatch(styles, /radial-gradient/i, app.name);
    assert.doesNotMatch(styles, /border-radius:\s*(?:2[0-9]|[3-9][0-9])px/, app.name);
  }
});
