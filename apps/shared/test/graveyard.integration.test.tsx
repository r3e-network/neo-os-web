import React from "react";
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../graveyard/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string) {
  const m: Record<string,string> = {
    addEpitaph: "Add epitaph",
    assetHash: "Content hash",
    assetHashHint: "Use an encrypted target.",
    assetHashPlaceholder: "Enter encrypted content hash...",
    burialFee: "Burial fee",
    burialReview: "Burial review",
    cancel: "Cancel",
    composeModeHash: "I have a hash",
    composeModeHashHint: "Use an existing encrypted target",
    composeModeWrite: "Write memory",
    composeModeWriteHint: "Hash locally from a private note",
    destroy: "Bury",
    destroyAsset: "Burial Chamber",
    destroying: "Burying...",
    destructionStats: "Burial Stats",
    docSubtitle: "Graveyard",
    editEpitaph: "Edit epitaph",
    epitaphPlaceholder: "A short note for this memory",
    epitaphSave: "Save epitaph",
    forgetAction: "Forget",
    forgetConfirmAction: "Confirm forget",
    forgetConfirmFee: "Forgetting costs {fee}.",
    gasReclaimedEstimate: "GAS spent on burials",
    hashMissing: "Hash required",
    hashPending: "Waiting for hash",
    hashPreview: "Target",
    hashReady: "Ready for review",
    hashReadyCopy: "The target is long enough for review.",
    historyGuidance: "Buried records remain inspectable here.",
    memoryConsole: "Memory console",
    memoryTextHint: "The text stays on this device.",
    memoryTextLabel: "Your memory",
    memoryTextPlaceholder: "Write the memory to bury.",
    memoryVaultStage: "Memory vault",
    noDestructions: "No burial records yet",
    noDestructionsHint: "Buried memories will appear here.",
    recentDestructions: "Burial Records",
    records: "records",
    refreshRecords: "Refresh Records",
    sealEmpty: "Awaiting memory",
    selectedType: "Selected type",
    showAllRecords: "Show all records",
    showFewerRecords: "Show fewer",
    sunkFeeNote: "This fee is spent, not refunded.",
    title: "Graveyard",
    totalDestroyed: "Total Buried",
  };
  return m[k] ?? k;
}
function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  const b: Record<string, unknown> = {
    totalDestroyed: 0,
    burialFeesPaid: "0",
    gasReclaimedDisplay: "0 GAS",
    burialFeeDisplay: "0.1 GAS",
    forgetFeeDisplay: "0.05 GAS",
    historyCount: 0,
    historyTruncated: false,
    history: [],
    isDestroying: false,
    isHashing: false,
    isLoading: false,
    showConfirm: false,
    showWarningShake: false,
    walletConnected: false,
    walletAddress: "",
    sourceError: "",
    fileName: "",
    fileSize: 0,
    feesReady: true,
    contractPaused: false,
    contractStateReady: true,
    burialRecoveryPhase: "",
    burialRecoveryTxid: "",
    forgetRecoveryPhase: "",
    forgetRecoveryMemoryId: "",
    epitaphRecoveryPhase: "",
    epitaphRecoveryMemoryId: "",
    epitaphRecoveryTxid: "",
    storageHealthy: true,
    showAllHistory: false,
    forgetConfirmId: "",
    forgettingId: "",
    epitaphDraftId: "",
    epitaphText: "",
    epitaphSavingId: "",
    assetHash: "",
    composeMode: "write",
    memoryText: "",
    memoryType: 1,
    memoryTypeOptions: [
      { value: 1, label: "Secret" },
      { value: 2, label: "Regret" },
    ],
    ...o,
  };
  return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, createObservable(v)]));
}
describe("graveyard integration: dispatch params", () => {
  it("prepares the latest note and opens review without spending", async () => {
    const d = vi.fn().mockResolvedValue(undefined);
    const hash = "ab".repeat(32);
    const { container } = render(<PlayArea t={t} state={state({ assetHash: hash, memoryText: "My memory" })} dispatch={d} />);
    await act(async () => {
      fireEvent.click(container.querySelector(".graveyard-review-button") as Element);
    });

    expect(d).toHaveBeenCalledWith("initiateDestroy");
    expect(d).toHaveBeenCalledWith("setMemoryText", expect.objectContaining({
      composeMode: "write",
      memoryText: "My memory",
    }));
    expect(d).not.toHaveBeenCalledWith("executeDestroy", expect.anything());
  });

  it("only dispatches the paid action from the explicit confirmation", () => {
    const d = vi.fn().mockResolvedValue(undefined);
    const hash = "cd".repeat(32);
    const { container } = render(
      <PlayArea t={t} state={state({ showConfirm: true, assetHash: hash, memoryText: "Ready", memoryType: 2 })} dispatch={d} />,
    );
    fireEvent.click(container.querySelector(".graveyard-confirm__actions button:last-child") as Element);
    // The final action uses the already-reviewed observable state. Raw private
    // text is not copied into the paid action payload or host action log.
    expect(d).toHaveBeenCalledWith("executeDestroy");
    expect(d.mock.calls.find(([name]) => name === "executeDestroy")).toEqual(["executeDestroy"]);
  });

  it("disables review until a complete SHA-256 exists", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    const btn = container.querySelector(".graveyard-review-button") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it("offers a real local-file source", () => {
    const d = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={d} />);
    fireEvent.click(container.querySelectorAll(".graveyard-source-tabs button")[1] as Element);
    expect(d).toHaveBeenCalledWith("setComposeMode", "file");
  });

  it("dispatches requestForget for a concrete history item", () => {
    const d = vi.fn().mockResolvedValue(undefined);
    const item = { id: "7", hash: "0xabcdef1234567890", time: "2026-06-29", forgotten: false };
    const { container } = render(<PlayArea t={t} state={state({ history: [item], historyCount: 1 })} dispatch={d} />);
    // The records used to be openable from a shortcut card whose label repeated
    // the "Burial Records" section header sitting right below it. That duplicate
    // row is gone; the section's own Open toggle is the control now. Intent is
    // unchanged: reveal the records, then act on an item.
    // (The t() stub echoes unmapped keys, so the toggle renders as "open".)
    const drawerToggle = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.trim() === "open");
    expect(drawerToggle).toBeTruthy();
    fireEvent.click(drawerToggle!);
    const forgetBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("Forget"));
    expect(forgetBtn).toBeTruthy();
    fireEvent.click(forgetBtn!);
    expect(d).toHaveBeenCalledWith("requestForget", item);
  });
});
