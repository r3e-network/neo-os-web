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

test("AA Session Key Lab exposes a wallet-style session workspace with guarded configure flow", () => {
  const playArea = read("apps/aa-session-key-lab/src/PlayArea.tsx");
  const styles = read("apps/aa-session-key-lab/src/PlayArea.scss");
  const composable = read(
    "apps/aa-session-key-lab/src/composables/useAASessionKeyLab.ts",
  );
  const messages = read("apps/aa-session-key-lab/src/locale/messages.ts");

  assert.match(playArea, /className="session-hero"/);
  assert.match(playArea, /className="session-hero__metrics"/);
  // Neo Soft redesign: the two-step setup workspace is the `session-flow-stack`
  // container (was `session-workspace`), holding step 1 (command) + step 2
  // (configure) cards.
  assert.match(playArea, /className="session-flow-stack"/);
  // The primary configure flow lives in the `session-config-card` (was the
  // `session-flow` region) — it wraps the scope form + the guarded submit CTA.
  assert.match(playArea, /className="session-config-card"/);
  assert.match(playArea, /const canConfigure =/);
  assert.match(playArea, /disabled=\{!canConfigure/);
  assert.match(playArea, /className="session-action-grid"/);
  assert.match(styles, /\.session-play-area button:disabled/);
  assert.doesNotMatch(styles, /filter:\s*saturate/);
  assert.doesNotMatch(styles, /opacity:\s*0\.55/);
  assert.match(styles, /\.session-hint\s*\{[^}]*padding:\s*12px 14px/s);
  assert.match(styles, /\.session-hint\s*\{[^}]*border:\s*1px solid/s);
  // Neo Soft redesign: the pre-input hint reads as neutral muted guidance (not
  // an amber warning tint) — its surface is the shared --ns-surface-subtle token.
  assert.match(
    styles,
    /\.session-hint\s*\{[^}]*background:\s*var\(--ns-surface-subtle/s,
  );
  assert.match(composable, /aa\.isCheckingSponsorship\.get\(\)/);
  assert.doesNotMatch(
    composable,
    /get:\s*\(\)\s*=>\s*aa\.isCheckingSponsorship,/,
  );
  assert.match(messages, /sessionHeroTitle/);
  assert.match(messages, /sessionMetricScope/);
  assert.match(messages, /configureSessionBlocked/);
  assert.match(messages, /sessionFlowSponsor/);

  // Neo Soft design language (intentionally adopted in the 05ef54aab redesign):
  // the hero leads with an uppercase eyebrow label rendered above the title.
  assert.match(playArea, /className="session-hero__eyebrow"/);
  assert.match(
    styles,
    /\.session-hero__eyebrow\s*\{[^}]*text-transform:\s*uppercase/s,
  );
  // Eyebrows/labels carry the signature 0.12em tracking of the design system.
  assert.match(
    styles,
    /\.session-hero__eyebrow\s*\{[^}]*letter-spacing:\s*0\.12em/s,
  );
});
