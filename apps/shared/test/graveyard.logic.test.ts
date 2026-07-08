import { beforeEach, describe, expect, it, vi } from "vitest";

import { useGraveyard } from "../../graveyard/src/composables/useGraveyard";
import type { ChainService } from "../services/ChainService";
import { createMiniAppFramework } from "../react";
import { createObservable } from "../react/context";
import { sha256Hex } from "../utils/hash";

beforeEach(() => {
  try {
    globalThis.localStorage?.clear();
  } catch {
    /* memory storage stub may be absent — ignore */
  }
});

const OWNER = "NgaiKFjurmNmiRzDRQGs44yzByXuSkdGPF";
// The MemoryBuried event's owner slot arrives as the display-order 0x script
// hash (what ownerMatchesAddress matches against the connected N-address).
const OWNER_HASH = "0x86df72a6b4ab5335d506294f9ce993722253b6e2";

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    actionBusy: "Another action is still in progress.",
    connectWallet: "Please connect your wallet",
    enterAssetHash: "Please enter content hash",
    invalidHash: "Enter a valid content hash.",
    memoryBuried: "Memory has been buried on-chain",
    forgetSuccess: "Memory forgotten successfully",
    epitaphRequired: "Enter an epitaph before saving.",
    epitaphTooLong: "Epitaph must be 120 characters or less.",
    epitaphSaved: "Epitaph saved on-chain",
    error: "Something went wrong",
    tokenGas: "GAS",
    memoryTypeSecret: "Secret",
    memoryTypeRegret: "Regret",
    memoryTypeWish: "Wish",
    memoryTypeConfession: "Confession",
    memoryTypeOther: "Other",
  };
  const base = messages[key] ?? key;
  return params ? `${base}` : base;
}

interface ChainMock {
  read: ReturnType<typeof vi.fn>;
  invoke: ReturnType<typeof vi.fn>;
  invokeWithPayment: ReturnType<typeof vi.fn>;
  listEvents: ReturnType<typeof vi.fn>;
  ensureWallet: ReturnType<typeof vi.fn>;
  address: ReturnType<typeof createObservable<string | null>>;
}

function chainMock(opts: {
  reads?: Record<string, unknown>;
  readFailures?: Record<string, unknown>;
  events?: unknown[];
} = {}): { chain: ChainService; mock: ChainMock } {
  const reads = opts.reads ?? {};
  const readFailures = opts.readFailures ?? {};
  const read = vi.fn(async (op: string) => {
    if (op in readFailures) {
      const failure = readFailures[op];
      throw failure instanceof Error ? failure : new Error(String(failure));
    }
    return reads[op] ?? null;
  });
  const invoke = vi.fn(async () => ({ txid: "0xtx", event: undefined, success: true }));
  const invokeWithPayment = vi.fn(async () => ({
    txid: "0xtx",
    event: { state: [{ value: "5" }] },
    success: true,
  }));
  const listEvents = vi.fn(async () => opts.events ?? []);
  const ensureWallet = vi.fn(async () => OWNER);
  const address = createObservable<string | null>(OWNER);

  const mock: ChainMock = { read, invoke, invokeWithPayment, listEvents, ensureWallet, address };
  return { chain: mock as unknown as ChainService, mock };
}

function app(chainOpts: Parameters<typeof chainMock>[0] = {}) {
  const { chain, mock } = chainMock(chainOpts);
  const eventBus = { emit: vi.fn() };
  // The composable now consumes the MiniApp framework; its arg builders and raw
  // passthroughs are behavior-preserving, so every recorded chain call matches.
  const framework = createMiniAppFramework(
    { services: { chain }, t } as never,
    { appId: "miniapp-graveyard" },
  );
  const graveyard = useGraveyard({ app: framework, eventBus, t });
  return { graveyard, mock, eventBus };
}

describe("useGraveyard — local-hash compose mode", () => {
  it("defaults to write mode and sha256-hashes the typed memory into the burial target", async () => {
    const { graveyard } = app();
    expect(graveyard.composeMode.get()).toBe("write");

    await graveyard.setMemoryText("a secret memory");
    const expected = await sha256Hex("a secret memory");

    // The burial target is the LOCAL hash — the raw text is never the target.
    expect(graveyard.assetHash.get()).toBe(expected);
    expect(graveyard.assetHash.get()).toHaveLength(64);
    expect(graveyard.memoryText.get()).toBe("a secret memory");
  });

  it("clears the target when the memory text is emptied", async () => {
    const { graveyard } = app();
    await graveyard.setMemoryText("something");
    expect(graveyard.assetHash.get()).not.toBe("");
    await graveyard.setMemoryText("   ");
    expect(graveyard.assetHash.get()).toBe("");
  });

  it("switching compose mode clears the other mode's input", async () => {
    const { graveyard } = app();
    await graveyard.setMemoryText("draft");
    graveyard.setComposeMode("hash");
    expect(graveyard.composeMode.get()).toBe("hash");
    expect(graveyard.memoryText.get()).toBe("");
    expect(graveyard.assetHash.get()).toBe("");
  });

  it("hash mode uses the pasted target directly instead of hashing it again", async () => {
    const { graveyard } = app();
    const pastedHash = "abc123def4567890";

    graveyard.setComposeMode("hash");
    await graveyard.setMemoryText(pastedHash, "hash");

    expect(graveyard.memoryText.get()).toBe(pastedHash);
    expect(graveyard.assetHash.get()).toBe(pastedHash);
  });

  it("executeDestroy applies the latest UI payload before spending the burial fee", async () => {
    const { graveyard, mock } = app({ reads: { getUserMemoryCount: "0" } });
    const expectedHash = await sha256Hex("fresh payload");

    await graveyard.executeDestroy({
      composeMode: "write",
      memoryText: "fresh payload",
      memoryType: 4,
    });

    expect(mock.invokeWithPayment).toHaveBeenCalledWith(
      expect.any(String),
      "miniapp-graveyard:memory",
      "buryMemory",
      expect.arrayContaining([
        expect.objectContaining({ type: "Hash160" }),
        { type: "String", value: expectedHash },
        { type: "Integer", value: "4" },
      ]),
      expect.objectContaining({ waitForEvent: "MemoryBuried" }),
    );
  });
});

describe("useGraveyard — forget confirmation", () => {
  const item = { id: "3", hash: "abcd1234abcd", time: "", forgotten: false, memoryType: 1 };

  it("the first forget call ARMS the confirmation and does NOT pay", async () => {
    const { graveyard, mock } = app();
    await graveyard.forgetMemory(item);
    expect(graveyard.forgetConfirmId.get()).toBe("3");
    expect(mock.invokeWithPayment).not.toHaveBeenCalled();
  });

  it("only pays the forget fee once the SAME row is confirmed", async () => {
    const { graveyard, mock } = app({ reads: { getUserMemoryCount: "0" } });
    graveyard.requestForget(item);
    await graveyard.forgetMemory(item);

    expect(mock.invokeWithPayment).toHaveBeenCalledWith(
      expect.any(String),
      "miniapp-graveyard:memory",
      "forgetMemory",
      expect.arrayContaining([
        expect.objectContaining({ type: "Hash160" }),
        { type: "Integer", value: "3" },
      ]),
      expect.objectContaining({ waitForEvent: "MemoryForgotten" }),
    );
    expect(graveyard.forgetConfirmId.get()).toBeNull();
  });

  it("exposes the live forget fee for the confirmation surface", () => {
    const { graveyard } = app();
    // Seeded default forgetFee = 1 GAS.
    expect(graveyard.forgetFeeDisplay.get()).toBe("1 GAS");
  });
});

describe("useGraveyard — epitaph (free, non-deposit)", () => {
  const item = { id: "7", hash: "deadbeefdead", time: "", forgotten: false, memoryType: 2 };

  it("saves an epitaph via a free addEpitaph call (no invokeWithPayment)", async () => {
    const { graveyard, mock } = app({ reads: { getUserMemoryCount: "0" } });
    graveyard.startEpitaph(item);
    graveyard.epitaphText.set("Rest easy");

    await graveyard.saveEpitaph(item);

    expect(mock.invoke).toHaveBeenCalledWith(
      "addEpitaph",
      [
        { type: "Integer", value: "7" },
        { type: "String", value: "Rest easy" },
      ],
      expect.objectContaining({ waitForEvent: "EpitaphAdded" }),
    );
    // Epitaph is FREE: it must not go through the paid prepaid-GAS lane.
    expect(mock.invokeWithPayment).not.toHaveBeenCalled();
  });

  it("rejects an empty or over-long epitaph before any chain call", async () => {
    const { graveyard, mock } = app();
    graveyard.startEpitaph(item);
    graveyard.epitaphText.set("   ");
    await expect(graveyard.saveEpitaph(item)).rejects.toThrow("Enter an epitaph before saving.");

    graveyard.epitaphText.set("x".repeat(121));
    await expect(graveyard.saveEpitaph(item)).rejects.toThrow("Epitaph must be 120 characters or less.");

    expect(mock.invoke).not.toHaveBeenCalled();
  });
});

describe("useGraveyard — history pagination", () => {
  it("reports truncation when on-chain count exceeds the shown rows and Show all reloads", async () => {
    // 25 of this owner's MemoryBuried events; the default window shows 20.
    const events = Array.from({ length: 25 }, (_v, i) => ({
      state: [
        { value: String(i + 1) },
        { value: OWNER_HASH },
        { value: btoa("hash" + i) },
        { value: "1" },
      ],
    }));
    const { graveyard } = app({ reads: { getUserMemoryCount: "25" }, events });

    await graveyard.loadHistory();
    expect(graveyard.history.get().length).toBe(20);
    expect(graveyard.totalDestroyed.get()).toBe(25);
    expect(graveyard.historyTruncated.get()).toBe(true);

    await graveyard.setShowAllHistory(true);
    expect(graveyard.history.get().length).toBe(25);
    expect(graveyard.historyTruncated.get()).toBe(false);
  });
});

describe("useGraveyard — local preview read failures", () => {
  it("keeps expected missing-contract reads quiet but still warns on unexpected read failures", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const missingContract = app({
        readFailures: {
          getPlatformStats: new Error("Contract address not configured"),
          getUserMemoryCount: new Error("MiniApp contract address unavailable"),
        },
      });
      await missingContract.graveyard.loadAll();
      expect(warn).not.toHaveBeenCalled();

      const unexpected = app({
        readFailures: {
          getPlatformStats: new Error("RPC node unavailable"),
        },
      });
      await unexpected.graveyard.loadStats();
      expect(warn).toHaveBeenCalledWith(
        "[useGraveyard] getPlatformStats failed:",
        "RPC node unavailable",
      );
    } finally {
      warn.mockRestore();
    }
  });
});
