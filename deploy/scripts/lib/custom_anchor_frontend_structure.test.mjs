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

  // Structural regions of the stacked anchor workspace: hero with inline anchor
  // facts + AA orbit, the wallet action panel/grid, status strip, and the carded
  // staking metrics. (Neo Soft redesign replaced the legacy two-column
  // workspace/flow/id-card/status-card/guidance-grid layout.)
  for (const className of [
    "custom-anchor-playarea",
    "custom-anchor-hero",
    "custom-anchor-hero__facts",
    "custom-anchor-orbit",
    "custom-anchor-action-panel",
    "custom-anchor-action-grid",
    "custom-anchor-status-strip",
    "custom-anchor-metrics-card",
    "custom-anchor-metrics",
  ]) {
    // Accept both static string and template-literal className forms
    // (e.g. the status strip toggles an " error" modifier via a backtick).
    assert.match(playArea, new RegExp(`className=[{]?["\`][^"\`]*${className}`));
  }

  // State + dispatch wiring: the four wallet actions route through dispatch and
  // the agent count comes from the on-chain anchor state (never masked when 0).
  assert.match(playArea, /useStateBindings/);
  assert.match(playArea, /lastTxid/);
  assert.match(playArea, /agentCount/);
  assert.match(playArea, /displayedAgentCount = anchorAppId \? String\(agentCount\)/);
  assert.match(playArea, /"stake" \| "withdraw" \| "claimRewards" \| "refreshAnchor"/);
  assert.match(playArea, /await dispatch\(action, payload\)/);

  // Root + key region selectors exist in the stylesheet.
  assert.match(styles, /\.custom-anchor-playarea\s*\{/);
  // Anchor-id/amount form is the two-column grid (wide id field + narrow amount).
  assert.match(
    styles,
    /\.custom-anchor-form\s*\{[^}]*grid-template-columns:\s*minmax\(220px,\s*1\.4fr\)\s+minmax\(120px,\s*0\.6fr\)/s,
  );
  // The four wallet actions sit in a four-up grid.
  assert.match(
    styles,
    /\.custom-anchor-action-grid\s*\{[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/s,
  );
  // Hero uses the soft mint linear-gradient wash (replaces legacy id-card gradient).
  assert.match(styles, /\.custom-anchor-hero\s*\{[^}]*linear-gradient/s);
  // Neo Soft light hero heading uses the ink token (not the legacy dark #fff wash).
  assert.match(styles, /\.custom-anchor-hero h2\s*\{[^}]*color:\s*var\(--ns-ink/s);
  // Circular AA orbit is the signature hero badge (replaces the legacy flow number).
  assert.match(styles, /\.custom-anchor-orbit\s*\{[^}]*border-radius:\s*50%/s);
  // Responsive collapse on tablet: form to single column, metrics to two-up.
  assert.match(
    styles,
    /@media \(max-width: 860px\)[\s\S]*\.custom-anchor-form\s*\{[^}]*grid-template-columns:\s*1fr/s,
  );

  // Neo Soft design language: uppercase eyebrow labels with 0.12em tracking are
  // intentional; the accent stays a flat token/linear-gradient, never a radial
  // wash; type stays at fixed sizes (no clamp); radii stay within the token scale.
  assert.match(styles, /\.custom-anchor-kicker\s*\{[^}]*text-transform:\s*uppercase/s);
  assert.match(styles, /letter-spacing:\s*0\.12em/);
  assert.doesNotMatch(styles, /font-size:\s*clamp\(/);
  assert.doesNotMatch(styles, /radial-gradient/i);
  assert.doesNotMatch(styles, /border-radius:\s*(?:2[0-9]|[3-9][0-9])px/);

  // Locale keys that drive the anchor flow + facts still exist.
  assert.match(messages, /anchorFlowOpen/);
  assert.match(messages, /anchorFlowAction/);
  assert.match(messages, /anchorFlowSign/);
  assert.match(messages, /launchSource/);
  assert.match(messages, /lastTxid/);
});
