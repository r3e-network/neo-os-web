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

// Shared "Neo Soft" structure both anchor-staking surfaces still ship after the
// light redesign (commit 05ef54aab). The two apps deliberately diverged their
// layouts (TrustAnchor keeps a two-column workspace + route card; ProfitAnchor
// collapsed to a single status card with a preflight panel), so layout-specific
// guards live in the per-app blocks below.
test("Anchor staking miniapps share the Neo Soft staking surface", () => {
  for (const app of APPS) {
    const playArea = read(`apps/${app.slug}/src/PlayArea.tsx`);
    const styles = read(`apps/${app.slug}/src/PlayArea.scss`);

    // Core regions present in both apps.
    assert.match(playArea, /className="anchor-primary-card/, app.name);
    assert.match(playArea, /className="anchor-kicker"/, app.name);
    assert.match(playArea, /className="anchor-stat-grid"/, app.name);
    assert.match(playArea, /className="anchor-status-card"/, app.name);
    assert.match(playArea, /className="anchor-section-head"/, app.name);
    assert.match(
      playArea,
      /className="anchor-action-button anchor-action-button--primary"/,
      app.name,
    );

    // State/dispatch wiring: both surfaces drive the same four staking actions
    // through the platform dispatch bridge.
    assert.match(playArea, /useStateBindings\(state\)/, app.name);
    assert.match(
      playArea,
      /runAmountAction = async \(action: "stakeNeo" \| "withdrawNeo"\)/,
      app.name,
    );
    assert.match(
      playArea,
      /runSimpleAction = async \(action: "claimRewards" \| "refreshAnchor"\)/,
      app.name,
    );
    assert.match(playArea, /dispatch\(action, \{ amount: normalizedAmount \}\)/, app.name);
    assert.match(playArea, /void runAmountAction\("stakeNeo"\)/, app.name);
    assert.match(playArea, /void runAmountAction\("withdrawNeo"\)/, app.name);
    assert.match(playArea, /void runSimpleAction\("claimRewards"\)/, app.name);
    assert.match(playArea, /void runSimpleAction\("refreshAnchor"\)/, app.name);

    // Route selection derivation drives the routing copy in both apps.
    assert.match(playArea, /const selectedAgent = stats\?\.selectedAgentId/, app.name);

    // Locale keys consumed by the shared surface exist in each app's catalogue.
    const messages = read(`apps/${app.slug}/src/locale/messages.ts`);
    for (const key of [
      "appName",
      "heroTitle",
      "heroDescription",
      "actionPanelTitle",
      "neoAmount",
      "submitStake",
      "submitWithdraw",
      "submitClaim",
      "lastTxid",
      "actionHistory",
    ]) {
      assert.match(messages, new RegExp(`\\b${key}:`), `${app.name} locale: ${key}`);
    }

    // Neo Soft design language (positive guards replacing the retired
    // zero-letter-spacing / no-uppercase philosophy checks): uppercase eyebrows
    // with 0.12em tracking are now the intentional kicker/eyebrow treatment.
    assert.match(
      styles,
      /\.anchor-kicker\s*\{[^}]*letter-spacing:\s*0\.12em/s,
      `${app.name} kicker tracking`,
    );
    assert.match(
      styles,
      /\.anchor-kicker\s*\{[^}]*text-transform:\s*uppercase/s,
      `${app.name} kicker uppercase`,
    );
    assert.match(
      styles,
      /\.stat-label\s*\{[^}]*text-transform:\s*uppercase/s,
      `${app.name} stat-label uppercase`,
    );

    // Hero heading uses the Neo Soft ink token (dark washes were dropped).
    assert.match(
      styles,
      /h2\s*\{[^}]*color:\s*var\(--ns-ink/s,
      `${app.name} hero ink token`,
    );

    // Shared stat strip is a 3-up grid.
    assert.match(
      styles,
      /\.anchor-stat-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s,
      `${app.name} stat grid`,
    );

    // Design-system constraints that hold for both apps: no font-size clamp.
    assert.doesNotMatch(styles, /font-size:\s*clamp\(/, `${app.name} no clamp`);
    // Border radius literals stay bounded (<= 24px aside from pill radii).
    const radiusLiterals = [...styles.matchAll(/border-radius:\s*(\d+)px/g)].map(
      (m) => Number(m[1]),
    );
    for (const radius of radiusLiterals) {
      assert.ok(
        radius <= 24 || radius >= 999,
        `${app.name} bounded radius literal: ${radius}px`,
      );
    }
  }
});

// TrustAnchor keeps the full two-column routing workspace with a dedicated
// route card and a collapsible routing-model explainer.
test("TrustAnchor renders the two-column routing workspace", () => {
  const playArea = read("apps/trustanchor/src/PlayArea.tsx");
  const styles = read("apps/trustanchor/src/PlayArea.scss");

  assert.match(playArea, /className="anchor-workspace"/);
  assert.match(playArea, /className="anchor-route-card"/);
  // Placeholder class is applied conditionally via the ternary on the route value.
  assert.match(playArea, /"anchor-route-card__placeholder"/);
  assert.match(playArea, /details className="neo-card anchor-routing-model"/);
  assert.match(playArea, /className="anchor-routing-model__summary"/);
  assert.match(playArea, /className="anchor-flow-list"/);
  // Agent total derivation: live count, then registered-account fallback.
  assert.match(playArea, /agentCount \|\| agentAccounts\.length \|\| 0/);

  // Two-column workspace grid + responsive collapse.
  assert.match(styles, /\.anchor-workspace\s*\{/);
  assert.match(
    styles,
    /\.anchor-workspace\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1\.05fr\)\s+minmax\(300px,\s*0\.95fr\)/s,
  );
  assert.match(
    styles,
    /@media \(max-width: 860px\)[\s\S]*\.anchor-workspace\s*\{[^}]*grid-template-columns:\s*1fr/s,
  );
  // Route card keeps the soft brand gradient wash; status card stretches full height.
  assert.match(styles, /\.anchor-route-card\s*\{[^}]*linear-gradient/s);
  assert.match(styles, /\.anchor-status-card\s*\{[^}]*min-height:\s*100%/s);
});

// ProfitAnchor collapsed to a single status card with a wallet-effect preflight
// panel; it does not render the route card or the routing-model explainer.
test("ProfitAnchor renders the single-card preflight workspace", () => {
  const playArea = read("apps/profitanchor/src/PlayArea.tsx");
  const styles = read("apps/profitanchor/src/PlayArea.scss");

  assert.match(playArea, /className="anchor-preflight-panel"/);
  assert.match(playArea, /className="anchor-preflight-summary"/);
  // Preflight rows render in a map with a conditional is-ready modifier, so the
  // class name is built in a template literal rather than a static attribute.
  assert.match(playArea, /`anchor-preflight-row\$\{check\.done \? " is-ready" : ""\}`/);
  assert.match(playArea, /className="anchor-action-secondary"/);
  assert.match(playArea, /className="anchor-action-link"/);
  assert.match(playArea, /className="anchor-hero-facts"/);
  // Placeholder agent slots before stats load, real on-chain count afterwards.
  assert.match(playArea, /const agentTotal = stats \? agentCount : 21/);

  // ProfitAnchor renders a single status card, not the two-column workspace.
  assert.doesNotMatch(playArea, /className="anchor-workspace"/);
  assert.doesNotMatch(playArea, /className="anchor-route-card"/);

  // SCSS backs the preflight panel and the intentional radial brand wash on the
  // primary card (a deliberate Neo Soft accent, not a stale dark gradient).
  assert.match(styles, /\.anchor-preflight-panel\s*\{/);
  assert.match(styles, /\.anchor-action-secondary\s*\{/);
  assert.match(
    styles,
    /\.anchor-primary-card\s*\{[\s\S]*?radial-gradient\([^)]*var\(--ns-brand-soft/s,
  );
});
