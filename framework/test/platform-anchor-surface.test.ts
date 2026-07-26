import { describe, expect, it, vi } from "vitest";
import {
  createMiniAppFramework,
  FrameworkCapabilityError,
  FrameworkPermissionError,
} from "../index";
import type { MiniAppFrameworkContext, MiniAppFrameworkOptions } from "../index";
import { createObservable } from "../reactive";
import { addressToScriptHash } from "../utils/neo";

const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const ACCOUNT = addressToScriptHash(ADDRESS);
const ANCHOR_HASH = `0x${"ab".repeat(20)}`;
const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const APP_ID = "platform-anchor-test";

function makeApp(
  options: Omit<MiniAppFrameworkOptions, "appId"> = {},
  launchContext: Record<string, unknown> = { appId: APP_ID },
) {
  const chain = {
    address: createObservable<string | null>(ADDRESS),
    contractAddress: createObservable<string | null>(ANCHOR_HASH),
    ensureWallet: vi.fn(async () => ADDRESS),
    read: vi.fn(async (_operation: string, _args?: unknown[], _options?: unknown): Promise<unknown> => "1"),
    invoke: vi.fn(async (_operation: string, _args: unknown[], _options?: unknown) => ({ txid: "0xtx", success: true })),
  };
  const ctx = {
    services: { chain },
    t: (key: string) => key,
    launchContext,
  } as unknown as MiniAppFrameworkContext;
  const app = createMiniAppFramework(ctx, {
    appId: APP_ID,
    platformAnchor: { anchorHash: ANCHOR_HASH },
    ...options,
  });
  return { app, chain };
}

describe("app.platformAnchor", () => {
  it("fails closed without a valid config", async () => {
    const missing = makeApp({ platformAnchor: undefined });
    expect(missing.app.platformAnchor.available).toBe(false);
    await expect(missing.app.platformAnchor.stats()).rejects.toSatisfy(
      (error: unknown) => error instanceof FrameworkCapabilityError && error.capability === "platformAnchor",
    );
    expect(missing.chain.read).not.toHaveBeenCalled();
  });

  it("auto-threads appId, wallet and contract targets", async () => {
    const { app, chain } = makeApp();
    await app.platformAnchor.userStake();
    expect(chain.read).toHaveBeenLastCalledWith("getUserStake", [
      { type: "String", value: APP_ID },
      { type: "Hash160", value: ACCOUNT },
    ], { scriptHash: ANCHOR_HASH });

    await app.platformAnchor.stakeNeo(3, undefined, {
      waitForEvent: "AnchorStakeChanged",
      onTransactionSent: vi.fn(),
    });
    expect(chain.invoke).toHaveBeenLastCalledWith("transfer", [
      { type: "Hash160", value: ACCOUNT },
      { type: "Hash160", value: ANCHOR_HASH },
      { type: "Integer", value: "3" },
      { type: "String", value: `appstake:${APP_ID}` },
    ], expect.objectContaining({
      scriptHash: NEO_HASH,
      waitForEvent: "AnchorStakeChanged",
    }));
  });

  it("preserves anchor write ABI ordering", async () => {
    const { app, chain } = makeApp();
    await app.platformAnchor.withdraw(2);
    await app.platformAnchor.claimRewards();
    await app.platformAnchor.withdrawCredit("NEO", 1);
    await app.platformAnchor.transferAgentNeo(1, 2, 3);

    expect(chain.invoke.mock.calls.map((call) => call[0])).toEqual([
      "withdraw",
      "claimRewards",
      "withdrawAppCredit",
      "transferAgentNeo",
    ]);
    expect(chain.invoke.mock.calls[0]?.[1]).toEqual([
      { type: "String", value: APP_ID },
      { type: "Hash160", value: ACCOUNT },
      { type: "Integer", value: "2" },
    ]);
  });

  it("uses app-scoped credit reads and preserves the legacy compatibility lane", async () => {
    const { app, chain } = makeApp();
    await app.platformAnchor.credit("GAS");
    await app.platformAnchor.totalNeoCredit();
    await app.platformAnchor.totalGasCredit();
    await app.platformAnchor.legacyCredit("GAS");
    await app.platformAnchor.legacyTotalGasCredit();

    expect(chain.read.mock.calls.map((call) => call[0])).toEqual([
      "getAppCredit",
      "getAppTotalNeoCredit",
      "getAppTotalGasCredit",
      "getCredit",
      "getTotalGasCredit",
    ]);
    expect(chain.read.mock.calls[0]?.[1]).toEqual([
      { type: "String", value: APP_ID },
      { type: "Hash160", value: ACCOUNT },
      { type: "String", value: "GAS" },
    ]);
  });

  it("runs guest then permission guards before writes", async () => {
    const guest = makeApp();
    guest.app.mode.set("guest");
    await expect(guest.app.platformAnchor.claimRewards()).rejects.toThrow(/guest-mode/);
    expect(guest.chain.invoke).not.toHaveBeenCalled();

    const denied = makeApp({}, { appId: APP_ID, permissions: { "invoke:primary": true } });
    await expect(denied.app.platformAnchor.withdraw(1)).rejects.toSatisfy(
      (error: unknown) => error instanceof FrameworkPermissionError && error.permission === "invoke:platform-anchor",
    );
    expect(denied.chain.invoke).not.toHaveBeenCalled();

    const allowed = makeApp({}, { appId: APP_ID, permissions: { "invoke:platform-anchor": true } });
    await expect(allowed.app.platformAnchor.withdraw(1)).resolves.toMatchObject({ txid: "0xtx" });
  });

  it("rejects invalid amounts and agent material before invoking", async () => {
    const { app, chain } = makeApp();
    await expect(app.platformAnchor.withdraw(0)).rejects.toThrow(/positive integer/);
    await expect(app.platformAnchor.setAgentCandidate(1, "bad")).rejects.toThrow(/compressed public key/);
    await expect(app.platformAnchor.registerAgent(ADDRESS, `02${"11".repeat(32)}`, "abc"))
      .rejects.toThrow(/even-length hex/);
    expect(chain.invoke).not.toHaveBeenCalled();
  });
});
