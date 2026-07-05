import assert from "node:assert/strict";
import test from "node:test";
import {
  assertClasses,
  assertDispatches,
  assertMessageKeys,
  assertModernTypography,
  assertPlayStage,
  read,
} from "./frontend_structure_helpers.mjs";

const APPS = [
  { slug: "trustanchor-admin", name: "TrustAnchor Admin" },
  { slug: "profitanchor-admin", name: "ProfitAnchor Admin" },
];

test("Anchor admin miniapps render the v2 operator routing workspace", () => {
  for (const app of APPS) {
    const playArea = read(`apps/${app.slug}/src/PlayArea.tsx`);
    const styles = read(`apps/${app.slug}/src/PlayArea.scss`);
    const messages = read(`apps/${app.slug}/src/messages.ts`);

    assertPlayStage(playArea, "defi", app.name);
    assertClasses(playArea, [
      "anchor-admin-play-area",
      "admin-scene",
      "admin-workspace",
      "admin-command",
      "admin-mode",
      "admin-route-board",
      "admin-operation-ticket",
      "admin-ledger",
      "admin-agent-grid",
      "admin-policy",
      "admin-drawer",
    ], app.name);
    assertDispatches(playArea, ["transferAgentNeo", "setAgentCandidate", "voteAgent"], app.name);
    assertMessageKeys(messages, [
      "adminHeroTitle",
      "adminHeroSubtitle",
      "routeMapTitle",
      "moveNeo",
      "setCandidate",
      "syncVote",
      "agentDirectoryTitle",
      "operatorRule",
    ], app.name);

    // NEO must remain whole-unit only.
    assert.match(playArea, /function normalizeWholeNeoAmount/);
    assert.match(playArea, /Number\(normalizeWholeNeoAmount\(amount\)\)/);
    assert.match(styles, /\.admin-workspace\s*\{[\s\S]*grid-template-columns:/);
    assert.match(styles, /@media \(max-width:/);
    assertModernTypography(styles, app.name);
  }
});
