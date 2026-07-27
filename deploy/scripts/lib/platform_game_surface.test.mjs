import test from "node:test";
import assert from "node:assert/strict";

import { buildPlatformGameSurfaceLedger } from "../audit_platform_game_surface.mjs";

test("the platform game reward surface is intact", () => {
  const ledger = buildPlatformGameSurfaceLedger();

  assert.equal(ledger.reward_chain_available, true);
  assert.equal(ledger.shared_entries_require_prepay, true);
  assert.equal(ledger.settlement_event_withheld_until_settled, true);
  assert.equal(ledger.config_read_from_manifest, true);
});
