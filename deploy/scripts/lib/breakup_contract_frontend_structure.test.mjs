import assert from "node:assert/strict";
import test from "node:test";
import {
  assertAssets,
  assertClasses,
  assertDispatches,
  assertMessageKeys,
  assertModernTypography,
  assertPlayStage,
  read,
} from "./frontend_structure_helpers.mjs";

test("Breakup Contract renders one clear pact action with durable recovery", () => {
  const playArea = read("apps/breakup-contract/src/PlayArea.tsx");
  const styles = read("apps/breakup-contract/src/PlayArea.scss");
  const hook = read("apps/breakup-contract/src/composables/useBreakup.ts");
  const safety = read("apps/breakup-contract/src/composables/breakupSafety.ts");
  const messages = read("apps/breakup-contract/src/locale/messages.ts");

  assertPlayStage(playArea, "social", "Breakup Contract");
  assertClasses(playArea, [
    "breakup-contract-play-area",
    "breakup-scene",
    "breakup-preview",
    "breakup-desk",
    "breakup-pact-console",
    "breakup-drawer",
    "breakup-contracts",
  ], "Breakup Contract");
  assertDispatches(playArea, [
    "createContract",
    "refreshContracts",
    "withdrawCredit",
    "signContract",
    "cancelContract",
    "settleContract",
    "breakContract",
  ], "Breakup Contract");
  assertAssets(["apps/breakup-contract/public/pact-table.webp"]);
  assert.match(playArea, /components-react\/v2\/OpenUiLite/);
  assert.match(playArea, /components-react\/v2\/PlayStage/);
  assert.doesNotMatch(playArea, /from "@shared\/components-react\/v2"/);
  assert.doesNotMatch(playArea, /actionPreview|useTransientFlag|setTimeout\(/);
  assert.doesNotMatch(playArea, /secondary:\s*\[/);

  assert.match(safety, /method: "getapplicationlog"/);
  assert.match(safety, /version: 2/);
  assert.match(hook, /onTransactionSent: persist/);
  assert.match(hook, /classifyBreakupConfirmation/);
  assert.match(hook, /lastPactIdUnavailable/);
  assert.doesNotMatch(hook, /PENDING_STALE_MS|pendingClearedForRetry|verified === true/);
  assertMessageKeys(messages, [
    "awaitingChain",
    "transactionFaulted",
    "pendingBlocksWrites",
    "checkPendingAction",
    "checkPendingHint",
    "chainContextMismatch",
    "lastPactIdUnavailable",
  ], "Breakup Contract");
  assert.match(styles, /\.breakup-scene\s*\{/);
  assert.match(styles, /@media \(max-width:/);
  assertModernTypography(styles, "Breakup Contract");
});
