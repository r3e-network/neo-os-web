import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { BLOCKCHAIN_CONSTANTS } from "../constants";
import { useProfitAnchor } from "../../profitanchor/src/hooks/useProfitAnchor";
import { useTrustAnchor } from "../../trustanchor/src/hooks/useTrustAnchor";

function fakeAnchorDeps() {
  const invoke = vi.fn(async () => ({ txid: "0xanchor", success: true }));
  const read = vi.fn(async () => 0);
  const chain = {
    address: createObservable("NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX"),
    contractAddress: createObservable("0xab079b4f9a0a2471d136392e25eb8e99898dcad0"),
    ensureWallet: vi.fn(async () => "NTmHjwiadq4g3VHpJ5FQigQcD4fF5m8TyX"),
    invoke,
    read,
  };
  const eventBus = { emit: vi.fn() };
  const t = (key: string) => key;
  return { chain, eventBus, t, invoke };
}

describe("Anchor stake memo alignment", () => {
  it("uses the PlatformAnchor auto-stake memo for ProfitAnchor and TrustAnchor user stake actions", async () => {
    const profit = fakeAnchorDeps();
    await useProfitAnchor(profit as never).stakeNeo(3);
    expect(profit.invoke).toHaveBeenCalledWith(
      "transfer",
      expect.arrayContaining([
        { type: "Integer", value: 3 },
        { type: "String", value: "stake:miniapp-profitanchor" },
      ]),
      expect.objectContaining({ scriptHash: BLOCKCHAIN_CONSTANTS.NEO_HASH }),
    );

    const trust = fakeAnchorDeps();
    await useTrustAnchor(trust as never).stakeNeo(2);
    expect(trust.invoke).toHaveBeenCalledWith(
      "transfer",
      expect.arrayContaining([
        { type: "Integer", value: 2 },
        { type: "String", value: "stake:miniapp-trustanchor" },
      ]),
      expect.objectContaining({ scriptHash: BLOCKCHAIN_CONSTANTS.NEO_HASH }),
    );
  });

  it("keeps Custom Anchor and host stake flows aligned with PlatformAnchor OnNEP17Payment", () => {
    const repoRoot = resolve(process.cwd(), "..", "..");
    const customMain = readFileSync(
      resolve(repoRoot, "apps/custom-anchor/src/main.tsx"),
      "utf8",
    );
    const hostInvoke = readFileSync(
      resolve(repoRoot, "platform/host-app/hooks/useMiniAppDetailInvoke.ts"),
      "utf8",
    );

    expect(customMain).toContain("`stake:${target}`");
    expect(hostInvoke).toContain("`stake:${anchorOperationAppId}`");
  });
});
