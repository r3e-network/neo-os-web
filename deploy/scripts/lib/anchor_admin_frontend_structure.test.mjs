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
  const workspace = read(
    "apps/shared/components-react/v2/anchor-admin/AnchorAdminWorkspace.tsx",
  );
  const model = read("apps/shared/components-react/v2/anchor-admin/model.ts");
  const workspaceStyles = read(
    "apps/shared/components-react/v2/anchor-admin/_workspace.scss",
  );

  for (const app of APPS) {
    const playArea = read(`apps/${app.slug}/src/PlayArea.tsx`);
    const styles = read(`apps/${app.slug}/src/PlayArea.scss`);
    const messages = read(`apps/${app.slug}/src/messages.ts`);
    const combinedStyles = `${workspaceStyles}\n${styles}`;

    assert.match(playArea, /AnchorAdminWorkspace/);
    assert.match(playArea, new RegExp(`flavor="${app.slug.startsWith("trust") ? "trust" : "profit"}"`));
    assertPlayStage(workspace, "defi", app.name);
    assertClasses(workspace, [
      "anchor-admin-play-area",
      "admin-scene",
      "admin-workspace",
      "admin-command",
      "admin-mode",
      "admin-route-board",
      "admin-operation-ticket",
      "admin-ledger",
      "admin-topology__network",
      "admin-drawer__policy",
      "admin-drawer",
    ], app.name);
    assertDispatches(workspace, ["transferAgentNeo", "setAgentCandidate", "voteAgent"], app.name);
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
    assert.match(model, /export function normalizeWholeNeoInput/);
    assert.match(workspace, /const normalizedAmount = normalizeWholeNeoInput\(amount\)/);
    assert.match(combinedStyles, /\.admin-workspace\s*\{[\s\S]*grid-template-columns:/);
    assert.match(combinedStyles, /@media \(max-width:/);
    assertModernTypography(combinedStyles, app.name);
  }
});
