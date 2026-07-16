import { beforeEach, describe, expect, it, vi } from "vitest";

import { useGraveyard } from "../../graveyard/src/composables/useGraveyard";
import type { ChainService } from "../services/ChainService";
import { createMiniAppFramework } from "../react";
import { createObservable } from "../react/context";
import { sha256Hex } from "../utils/hash";
import { DepositConfirmedActionFailedError } from "../composables/useContractInteraction";

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
    invalidMemoryType: "Choose one of the five memory types.",
    burialConfirmationRequired: "Review before signing.",
    burialReviewChanged: "Review changed.",
    burialUnverified: "MemoryBuried is not verified yet.",
    forgetUnverified: "MemoryForgotten is not verified yet.",
    forgetConfirmationRequired: "Review the forgetting fee.",
    forgetReviewChanged: "Forgetting fee changed.",
    epitaphUnverified: "EpitaphAdded is not verified yet.",
    epitaphPendingResolution: "Epitaph transaction is awaiting readback.",
    epitaphStillPending: "Epitaph is still pending.",
    epitaphRecoveryMissing: "No epitaph recovery is available.",
    recoveryStorageUnavailable: "Recovery storage is unavailable.",
    liveFeeUnavailable: "Live contract fees are unavailable.",
    contractPausedAction: "Memory Garden is paused. No GAS was requested.",
    prepaidBurialRecovery: "Burial recovery saved.",
    prepaidBurialRetryFailed: "Burial recovery is still unresolved.",
    prepaidForgetRecovery: "Forgetting recovery saved.",
    prepaidForgetRetryFailed: "Forgetting recovery is still unresolved.",
    burialPendingResolution: "Burial is awaiting readback.",
    forgetPendingResolution: "Forgetting is awaiting readback.",
    memoryRecordMissing: "Memory record is unavailable.",
    memoryAlreadyForgotten: "Memory already forgotten.",
    hashingInProgress: "Wait for hashing.",
    fileRequired: "Choose a local file first.",
    fileEmpty: "The file is empty.",
    fileTooLarge: "Choose a file no larger than 25 MB.",
    fileHashFailed: "File hash failed.",
    localFile: "Local file",
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
  const reads = {
    getPlatformStats: { buryFee: "10000000", forgetFee: "100000000" },
    isPaused: false,
    ...(opts.reads ?? {}),
  };
  const readFailures = opts.readFailures ?? {};
  const read = vi.fn(async (op: string) => {
    if (op in readFailures) {
      const failure = readFailures[op];
      throw failure instanceof Error ? failure : new Error(String(failure));
    }
    return reads[op] ?? null;
  });
  const invoke = vi.fn(async (
    op: string,
    args: Array<{ value?: unknown }> = [],
    options?: { onTransactionSent?: (txid: string) => void },
  ) => {
    options?.onTransactionSent?.("0xtx");
    const event = op === "buryMemory"
      ? {
          state: [
            { value: "5" },
            { value: OWNER_HASH },
            { value: btoa(String(args[1]?.value ?? "")) },
            { value: String(args[2]?.value ?? "1") },
          ],
        }
      : op === "forgetMemory"
        ? {
            state: [
              { value: String(args[1]?.value ?? "0") },
              { value: OWNER_HASH },
              { value: "1780872373981" },
            ],
          }
        : {
            state: [
              { value: String(args[0]?.value ?? "1") },
              { value: String(args[1]?.value ?? "") },
            ],
          };
    return { txid: "0xtx", event, success: true, verified: true };
  });
  const invokeWithPayment = vi.fn(async (
    _amount: string,
    _memo: string,
    op: string,
    args: Array<{ value?: unknown }> = [],
    options?: {
      onPaymentSent?: (txid: string) => void;
      onTransactionSent?: (txid: string) => void;
    },
  ) => {
    options?.onPaymentSent?.("0xdeposit");
    options?.onTransactionSent?.("0xtx");
    return {
      txid: "0xtx",
      event: op === "forgetMemory"
        ? {
            state: [
              { value: String(args[1]?.value ?? "0") },
              { value: OWNER_HASH },
              { value: "1780872373981" },
            ],
          }
        : {
            state: [
              { value: "5" },
              { value: OWNER_HASH },
              { value: btoa(String(args[1]?.value ?? "")) },
              { value: String(args[2]?.value ?? "1") },
            ],
          },
      success: true,
      verified: true,
    };
  });
  const listEvents = vi.fn(async () => opts.events ?? []);
  const ensureWallet = vi.fn(async () => OWNER);
  const address = createObservable<string | null>(OWNER);

  const mock: ChainMock = { read, invoke, invokeWithPayment, listEvents, ensureWallet, address };
  return { chain: mock as unknown as ChainService, mock };
}

function app(chainOpts: Parameters<typeof chainMock>[0] = {}) {
  const { chain, mock } = chainMock(chainOpts);
  // The composable now consumes the MiniApp framework; its arg builders and raw
  // passthroughs are behavior-preserving, so every recorded chain call matches.
  const framework = createMiniAppFramework(
    { services: { chain }, t } as never,
    { appId: "miniapp-graveyard" },
  );
  const graveyard = useGraveyard({ app: framework, t });
  return { graveyard, mock, framework };
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

  it("hash mode normalises a supplied SHA-256 instead of hashing it again", async () => {
    const { graveyard } = app();
    const pastedHash = `0x${"AB".repeat(32)}`;

    graveyard.setComposeMode("hash");
    await graveyard.setMemoryText(pastedHash, "hash");

    expect(graveyard.memoryText.get()).toBe(pastedHash);
    expect(graveyard.assetHash.get()).toBe("ab".repeat(32));
  });

  it("hashes a local file without retaining its bytes or filename on-chain", async () => {
    const { graveyard, mock } = app({ reads: { getUserMemoryCount: "0" } });
    const file = new File(["local memorial"], "memory.txt", { type: "text/plain" });
    const expected = await sha256Hex("local memorial");

    await graveyard.hashMemoryFile(file);

    expect(graveyard.composeMode.get()).toBe("file");
    expect(graveyard.fileName.get()).toBe("memory.txt");
    expect(graveyard.fileSize.get()).toBe(file.size);
    expect(graveyard.assetHash.get()).toBe(expected);
    expect(graveyard.memoryText.get()).toBe("");

    graveyard.memoryType.set(2);
    await graveyard.loadStats();
    graveyard.initiateDestroy();
    await graveyard.executeDestroy();
    expect(mock.invokeWithPayment).toHaveBeenCalledWith(
      expect.any(String),
      "miniapp-graveyard:memory",
      "buryMemory",
      expect.arrayContaining([
        { type: "String", value: expected },
        { type: "Integer", value: "2" },
      ]),
      expect.objectContaining({ waitForEvent: "MemoryBuried" }),
    );
    expect(JSON.stringify(mock.invokeWithPayment.mock.calls)).not.toContain("local memorial");
    expect(JSON.stringify(mock.invokeWithPayment.mock.calls)).not.toContain("memory.txt");
    expect(graveyard.history.get()).toEqual([
      expect.objectContaining({ id: "5", hash: expected, memoryType: 2 }),
    ]);
  });

  it("clears a previous file digest when a replacement file is invalid", async () => {
    const { graveyard } = app();
    await graveyard.hashMemoryFile(new File(["valid"], "valid.txt"));
    expect(graveyard.assetHash.get()).toHaveLength(64);

    await expect(graveyard.hashMemoryFile(new File([], "empty.txt"))).rejects.toThrow("The file is empty.");
    expect(graveyard.assetHash.get()).toBe("");
    expect(graveyard.sourceError.get()).toBe("The file is empty.");
  });

  it("requires a complete SHA-256 before opening the paid confirmation", async () => {
    const { graveyard, mock } = app();
    graveyard.setComposeMode("hash");
    await graveyard.setMemoryText("deadbeef", "hash");

    expect(() => graveyard.initiateDestroy()).toThrow("Enter a valid content hash.");
    expect(graveyard.showConfirm.get()).toBe(false);
    expect(mock.invokeWithPayment).not.toHaveBeenCalled();

    await graveyard.setMemoryText("ab".repeat(32), "hash");
    await graveyard.loadStats();
    graveyard.initiateDestroy();
    expect(graveyard.showConfirm.get()).toBe(true);
    expect(mock.invokeWithPayment).not.toHaveBeenCalled();
  });

  it("enforces the review boundary before spending and uses the reviewed state", async () => {
    const { graveyard, mock } = app({ reads: { getUserMemoryCount: "0" } });
    const expectedHash = await sha256Hex("fresh payload");

    await graveyard.setMemoryText("fresh payload");
    graveyard.memoryType.set(4);
    await graveyard.loadStats();
    await expect(graveyard.executeDestroy()).rejects.toThrow("Review before signing.");
    expect(mock.invokeWithPayment).not.toHaveBeenCalled();

    graveyard.initiateDestroy();
    await graveyard.executeDestroy();

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
    expect(JSON.stringify(mock.invokeWithPayment.mock.calls)).not.toContain("fresh payload");
  });

  it("rejects invalid memory types before opening a paid confirmation", async () => {
    const { graveyard, mock } = app();
    await graveyard.setMemoryText("typed memory");
    graveyard.memoryType.set(6);

    expect(() => graveyard.initiateDestroy()).toThrow("Choose one of the five memory types.");
    expect(mock.invokeWithPayment).not.toHaveBeenCalled();
  });

  it("does not clear the private source or report success when MemoryBuried is unverified", async () => {
    const { graveyard, mock } = app();
    await graveyard.setMemoryText("keep this until verified");
    const preparedHash = graveyard.assetHash.get();
    await graveyard.loadStats();
    graveyard.initiateDestroy();
    mock.invokeWithPayment.mockResolvedValueOnce({
      txid: "0xpending",
      event: null,
      success: true,
      verified: false,
    });

    await expect(graveyard.executeDestroy()).rejects.toThrow("MemoryBuried is not verified yet.");
    expect(graveyard.assetHash.get()).toBe(preparedHash);
    expect(graveyard.memoryText.get()).toBe("keep this until verified");
    expect(graveyard.history.get()).toEqual([]);
    expect(graveyard.showConfirm.get()).toBe(false);
  });

  it("journals a broadcast target and blocks duplicate burial payment until readback", async () => {
    const { graveyard, mock } = app();
    await graveyard.setMemoryText("wait for the exact target event");
    await graveyard.loadStats();
    graveyard.initiateDestroy();
    mock.invokeWithPayment.mockImplementationOnce(async (...call: unknown[]) => {
      const options = call[4] as {
        onPaymentSent?: (txid: string) => void;
        onTransactionSent?: (txid: string) => void;
      };
      options.onPaymentSent?.("0xdeposit");
      options.onTransactionSent?.("0xtarget");
      return {
        txid: "0xtarget",
        event: null,
        success: true,
        verified: false,
      };
    });

    await expect(graveyard.executeDestroy()).rejects.toThrow("MemoryBuried is not verified yet.");
    expect(graveyard.burialRecoveryPhase.get()).toBe("target-broadcast");
    expect(() => graveyard.initiateDestroy()).toThrow("Burial is awaiting readback.");
    expect(mock.invokeWithPayment).toHaveBeenCalledTimes(1);
    expect(mock.invoke).not.toHaveBeenCalledWith("buryMemory", expect.anything(), expect.anything());
  });

  it("rejects a verified-looking MemoryBuried event whose owner/hash/type do not match", async () => {
    const { graveyard, mock } = app();
    await graveyard.setMemoryText("identity-bound memory");
    const preparedHash = graveyard.assetHash.get();
    graveyard.memoryType.set(3);
    await graveyard.loadStats();
    graveyard.initiateDestroy();
    mock.invokeWithPayment.mockResolvedValueOnce({
      txid: "0xwrong-event",
      event: {
        state: [
          { value: "11" },
          { value: "0x0000000000000000000000000000000000000000" },
          { value: btoa("cd".repeat(32)) },
          { value: "4" },
        ],
      },
      success: true,
      verified: true,
    });

    await expect(graveyard.executeDestroy()).rejects.toThrow("MemoryBuried is not verified yet.");
    expect(graveyard.assetHash.get()).toBe(preparedHash);
    expect(graveyard.history.get()).toEqual([]);
  });

  it("persists a broadcast prepaid deposit and retries the burial without charging again", async () => {
    const first = app();
    await first.graveyard.setMemoryText("recoverable prepaid burial");
    await first.graveyard.loadStats();
    first.graveyard.initiateDestroy();
    first.mock.invokeWithPayment.mockRejectedValueOnce(
      new DepositConfirmedActionFailedError(
        "buryMemory",
        "0xdeposit-only",
        new Error("contract temporarily unavailable"),
      ),
    );

    await expect(first.graveyard.executeDestroy()).rejects.toThrow(
      "Burial recovery saved.",
    );
    expect(first.graveyard.burialRecoveryPhase.get()).toBe("deposit-broadcast");

    // A fresh composable restores the device-local journal. The next confirmed
    // attempt calls buryMemory directly and never emits a second GAS transfer.
    const restored = app({ reads: { getUserMemoryCount: "0" } });
    expect(restored.graveyard.composeMode.get()).toBe("hash");
    expect(restored.graveyard.assetHash.get()).toBe(
      await sha256Hex("recoverable prepaid burial"),
    );
    await restored.graveyard.loadStats();
    restored.graveyard.initiateDestroy();
    await restored.graveyard.executeDestroy();

    expect(restored.mock.invokeWithPayment).not.toHaveBeenCalled();
    expect(restored.mock.invoke).toHaveBeenCalledWith(
      "buryMemory",
      expect.any(Array),
      expect.objectContaining({ waitForEvent: "MemoryBuried" }),
    );
    expect(restored.graveyard.burialRecoveryPhase.get()).toBe("");
  });

  it("requires a second confirmation when the live burial fee changes", async () => {
    const { graveyard, mock } = app();
    await graveyard.setMemoryText("fee-race protection");
    await graveyard.loadStats();
    graveyard.initiateDestroy();
    mock.read.mockImplementation(async (op: string) => {
      if (op === "getPlatformStats") {
        return { buryFee: "20000000", forgetFee: "100000000" };
      }
      if (op === "isPaused") return false;
      return null;
    });

    await expect(graveyard.executeDestroy()).rejects.toThrow("Review changed.");
    expect(graveyard.burialFeeDisplay.get()).toBe("0.2 GAS");
    expect(graveyard.showConfirm.get()).toBe(true);
    expect(mock.invokeWithPayment).not.toHaveBeenCalled();

    await graveyard.executeDestroy();
    expect(mock.invokeWithPayment).toHaveBeenCalledWith(
      "20000000",
      expect.any(String),
      "buryMemory",
      expect.any(Array),
      expect.any(Object),
    );
  });
});

describe("useGraveyard — forget confirmation", () => {
  const item = { id: "3", hash: "abcd1234abcd", time: "", forgotten: false, memoryType: 1 };

  it("requires the explicit requestForget boundary and never resolves as false success", async () => {
    const { graveyard, mock } = app();
    await graveyard.loadStats();
    await expect(graveyard.forgetMemory(item)).rejects.toThrow("Review the forgetting fee.");
    expect(graveyard.forgetConfirmId.get()).toBeNull();
    graveyard.requestForget(item);
    expect(graveyard.forgetConfirmId.get()).toBe("3");
    expect(mock.invokeWithPayment).not.toHaveBeenCalled();
  });

  it("rejects stale or malformed forget rows instead of resolving into a success toast", async () => {
    const { graveyard, mock } = app();
    await expect(graveyard.forgetMemory({ ...item, id: "" })).rejects.toThrow(
      "Memory record is unavailable.",
    );
    await expect(graveyard.forgetMemory({ ...item, forgotten: true })).rejects.toThrow(
      "Memory already forgotten.",
    );
    expect(mock.invokeWithPayment).not.toHaveBeenCalled();
  });

  it("only pays the forget fee once the SAME row is confirmed", async () => {
    const { graveyard, mock } = app({ reads: { getUserMemoryCount: "0" } });
    await graveyard.loadStats();
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

  it("exposes the live forget fee for the confirmation surface", async () => {
    const { graveyard } = app();
    expect(graveyard.feesReady.get()).toBe(false);
    await graveyard.loadStats();
    expect(graveyard.feesReady.get()).toBe(true);
    expect(graveyard.forgetFeeDisplay.get()).toBe("1 GAS");
  });

  it("does not mark a memory forgotten without a verified MemoryForgotten event", async () => {
    const { graveyard, mock } = app();
    graveyard.history.set([item]);
    await graveyard.loadStats();
    graveyard.requestForget(item);
    mock.invokeWithPayment.mockResolvedValueOnce({
      txid: "0xpending",
      event: null,
      success: true,
      verified: false,
    });

    await expect(graveyard.forgetMemory(item)).rejects.toThrow("MemoryForgotten is not verified yet.");
    expect(graveyard.history.get()[0]?.forgotten).toBe(false);
  });

  it("does not accept another owner's MemoryForgotten event", async () => {
    const { graveyard, mock } = app();
    graveyard.history.set([item]);
    await graveyard.loadStats();
    graveyard.requestForget(item);
    mock.invokeWithPayment.mockResolvedValueOnce({
      txid: "0xwrong-owner",
      event: {
        state: [
          { value: "3" },
          { value: "0x0000000000000000000000000000000000000000" },
          { value: "1780872373981" },
        ],
      },
      success: true,
      verified: true,
    });

    await expect(graveyard.forgetMemory(item)).rejects.toThrow("MemoryForgotten is not verified yet.");
    expect(graveyard.history.get()[0]?.forgotten).toBe(false);
  });

  it("requires a second confirmation when the live forgetting fee changes", async () => {
    const { graveyard, mock } = app();
    graveyard.history.set([item]);
    await graveyard.loadStats();
    graveyard.requestForget(item);
    mock.read.mockImplementation(async (op: string) => {
      if (op === "getPlatformStats") {
        return { buryFee: "10000000", forgetFee: "200000000" };
      }
      if (op === "isPaused") return false;
      return null;
    });

    await expect(graveyard.forgetMemory(item)).rejects.toThrow("Forgetting fee changed.");
    expect(graveyard.forgetFeeDisplay.get()).toBe("2 GAS");
    expect(graveyard.forgetConfirmId.get()).toBe("3");
    expect(mock.invokeWithPayment).not.toHaveBeenCalled();

    await graveyard.forgetMemory(item);
    expect(mock.invokeWithPayment).toHaveBeenCalledWith(
      "200000000",
      expect.any(String),
      "forgetMemory",
      expect.any(Array),
      expect.any(Object),
    );
  });
});

describe("useGraveyard — epitaph (no app deposit)", () => {
  const item = { id: "7", hash: "deadbeefdead", time: "", forgotten: false, memoryType: 2 };

  it("saves an epitaph without the Graveyard prepaid-GAS deposit lane", async () => {
    const { graveyard, mock } = app({
      reads: {
        getUserMemoryCount: "0",
        getMemoryDetails: { epitaph: "Rest easy" },
      },
    });
    graveyard.startEpitaph(item);
    graveyard.epitaphText.set("Rest easy");

    await graveyard.saveEpitaph(item);

    expect(mock.invoke).toHaveBeenCalledWith(
      "addEpitaph",
      [
        { type: "Integer", value: "7" },
        { type: "String", value: "Rest easy" },
      ],
      expect.objectContaining({
        waitForEvent: "EpitaphAdded",
        onTransactionSent: expect.any(Function),
      }),
    );
    // A normal Neo network fee may still be quoted by the wallet; the app does
    // not add its own prepaid-GAS deposit for addEpitaph.
    expect(mock.invokeWithPayment).not.toHaveBeenCalled();
    expect(graveyard.history.get()).toEqual([
      expect.objectContaining({ id: "7", epitaph: "Rest easy" }),
    ]);
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

  it("does not save an epitaph locally without a verified EpitaphAdded event", async () => {
    const { graveyard, mock } = app();
    graveyard.history.set([item]);
    graveyard.startEpitaph(item);
    graveyard.epitaphText.set("Pending words");
    mock.invoke.mockImplementationOnce(async (_op, _args, options) => {
      options?.onTransactionSent?.("0xpending");
      return {
        txid: "0xpending",
        event: null,
        success: true,
        verified: false,
      };
    });

    await expect(graveyard.saveEpitaph(item)).rejects.toThrow("EpitaphAdded is not verified yet.");
    expect(graveyard.history.get()[0]?.epitaph).toBeUndefined();
    expect(graveyard.epitaphDraftId.get()).toBe("7");
    expect(graveyard.epitaphRecoveryPhase.get()).toBe("target-broadcast");
    expect(graveyard.epitaphRecoveryMemoryId.get()).toBe("7");
    expect(graveyard.epitaphRecoveryTxid.get()).toBe("0xpending");

    await expect(graveyard.saveEpitaph(item)).rejects.toThrow(
      "Epitaph transaction is awaiting readback.",
    );
    expect(mock.invoke).toHaveBeenCalledTimes(1);
  });

  it("requires EpitaphAdded to match both the memory id and exact text", async () => {
    const { graveyard, mock } = app();
    graveyard.history.set([item]);
    graveyard.startEpitaph(item);
    graveyard.epitaphText.set("These exact words");
    mock.invoke.mockResolvedValueOnce({
      txid: "0xwrong-epitaph",
      event: {
        state: [
          { value: "8" },
          { value: "Different words" },
        ],
      },
      success: true,
      verified: true,
    });

    await expect(graveyard.saveEpitaph(item)).rejects.toThrow("EpitaphAdded is not verified yet.");
    expect(graveyard.history.get()[0]?.epitaph).toBeUndefined();
    expect(graveyard.epitaphDraftId.get()).toBe("7");
  });

  it("clears an epitaph recovery only after exact contract readback", async () => {
    const { graveyard, mock } = app();
    graveyard.history.set([item]);
    graveyard.startEpitaph(item);
    graveyard.epitaphText.set("Words that remain");
    mock.invoke.mockImplementationOnce(async (_op, _args, options) => {
      options?.onTransactionSent?.("0xepitaph");
      return { txid: "0xepitaph", event: null, success: true, verified: false };
    });

    await expect(graveyard.saveEpitaph(item)).rejects.toThrow("EpitaphAdded is not verified yet.");
    mock.read.mockResolvedValueOnce({ epitaph: "Different words" });
    await expect(graveyard.recoverEpitaph()).rejects.toThrow("Epitaph is still pending.");
    expect(graveyard.epitaphRecoveryPhase.get()).toBe("target-broadcast");

    mock.read.mockResolvedValueOnce({ epitaph: "Words that remain" });
    await graveyard.recoverEpitaph();

    expect(graveyard.epitaphRecoveryPhase.get()).toBe("");
    expect(graveyard.history.get()[0]?.epitaph).toBe("Words that remain");
    expect(graveyard.epitaphDraftId.get()).toBeNull();
  });

  it("blocks a wallet write when the recovery journal cannot round-trip", async () => {
    const { graveyard, mock, framework } = app();
    graveyard.history.set([item]);
    graveyard.startEpitaph(item);
    graveyard.epitaphText.set("Keep this safe");
    vi.spyOn(framework.storage.local, "set").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    await expect(graveyard.saveEpitaph(item)).rejects.toThrow(
      "Recovery storage is unavailable.",
    );
    expect(graveyard.storageHealthy.get()).toBe(false);
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

  it("clears the previous wallet's records before a replacement wallet read can fail", async () => {
    const events = [{
      state: [
        { value: "1" },
        { value: OWNER_HASH },
        { value: btoa("ab".repeat(32)) },
        { value: "1" },
      ],
    }];
    const { graveyard, mock } = app({ reads: { getUserMemoryCount: "1" }, events });
    await graveyard.loadHistory();
    expect(graveyard.history.get()).toHaveLength(1);

    mock.address.set("NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs");
    mock.read.mockRejectedValue(new Error("RPC unavailable"));
    mock.listEvents.mockRejectedValue(new Error("indexer unavailable"));
    await graveyard.loadHistory();

    expect(graveyard.history.get()).toEqual([]);
    // Intent unchanged: the previous wallet's count must NOT survive into the
    // replacement wallet's failed read. It previously asserted `0` because that
    // was the only "cleared" value available — but `0` is itself a claim, and
    // after a failed read it would tell the new wallet it has destroyed
    // nothing. The count is now `undefined` (unknown) in exactly that case, so
    // this asserts both halves of the intent: the stale `1` is gone, and no
    // fabricated zero took its place.
    expect(graveyard.totalDestroyed.get()).toBeUndefined();
    expect(graveyard.historyStatus.get()).toBe("error");
  });
});

describe("useGraveyard — local preview read failures", () => {
  it("keeps expected missing-contract reads quiet but still warns on unexpected read failures", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    warn.mockClear();
    try {
      const missingContract = app({
        readFailures: {
          getPlatformStats: new Error("Contract address not configured"),
          getUserMemoryCount: new Error("MiniApp contract address unavailable"),
        },
      });
      await missingContract.graveyard.loadAll();
      expect(warn).not.toHaveBeenCalled();
      expect(missingContract.graveyard.feesReady.get()).toBe(false);

      const unexpected = app({
        readFailures: {
          getPlatformStats: new Error("RPC node unavailable"),
        },
      });
      await unexpected.graveyard.loadStats();
      expect(warn).toHaveBeenCalledWith(
        "[useGraveyard] contract readiness failed:",
        "RPC node unavailable",
      );
    } finally {
      warn.mockRestore();
    }
  });

  it("keeps paid actions fail-closed when live contract fees cannot be verified", async () => {
    const { graveyard, mock } = app({
      readFailures: { getPlatformStats: new Error("Contract address not configured") },
    });
    await graveyard.setMemoryText("do not spend from a fallback fee");
    await graveyard.loadStats();

    expect(() => graveyard.initiateDestroy()).toThrow("Live contract fees are unavailable.");
    expect(() => graveyard.requestForget({
      id: "9",
      hash: "ab".repeat(32),
      time: "",
      forgotten: false,
    })).toThrow("Live contract fees are unavailable.");
    expect(mock.invokeWithPayment).not.toHaveBeenCalled();
  });

  it("reads the deployed pause flag and blocks payment before any GAS transfer", async () => {
    const { graveyard, mock } = app({ reads: { isPaused: true } });
    await graveyard.setMemoryText("paused garden");
    await graveyard.loadStats();

    expect(graveyard.contractStateReady.get()).toBe(true);
    expect(graveyard.contractPaused.get()).toBe(true);
    expect(graveyard.feesReady.get()).toBe(false);
    expect(() => graveyard.initiateDestroy()).toThrow(
      "Memory Garden is paused. No GAS was requested.",
    );
    expect(mock.invokeWithPayment).not.toHaveBeenCalled();
  });
});
