import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../graveyard/src/PlayArea";
import type { HistoryItem } from "../../graveyard/src/types";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string) {
  const messages: Record<string, string> = {
    assetHash: "Content hash",
    assetHashHint: "Use the encrypted content hash or token identifier you intend to bury.",
    assetHashPlaceholder: "Enter encrypted content hash...",
    assetHashTooShort: "Enter at least 12 characters so the burial target is identifiable.",
    burialChecklist: "Burial checklist",
    burialFee: "Burial fee",
    burialReview: "Burial review",
    burialReviewSubtitle: "Confirm target, wallet action, and fee model before signing.",
    buryWalletIntent: "Bury memory",
    cancel: "Cancel",
    checkFees: "Fees visible",
    checkHash: "Target hash",
    checkMemoryType: "Memory type",
    checkNeedsAction: "Needs action",
    checkPassed: "Passed",
    clearHash: "Clear Hash",
    confirmDestroy: "Bury on-chain",
    confirmText: "Are you absolutely sure? The hash will be permanent.",
    confirmTitle: "Confirm Burial",
    destroyed: "Buried",
    destroyAsset: "Burial Chamber",
    destroyForever: "Review burial",
    destroying: "Burying...",
    forgettingFee: "Forgetting fee",
    forgetAction: "Forget",
    forgotten: "Forgotten",
    gasReclaimed: "Burial Fees",
    hashMissing: "Hash required",
    hashMissingCopy: "Enter the encrypted content hash before preparing the burial.",
    hashPending: "Waiting for hash",
    hashPreview: "Target",
    hashPreviewCopy: "Only the hash is written; original encrypted content stays outside the app.",
    hashQuality: "Hash quality",
    hashReady: "Ready for review",
    hashReadyCopy: "The target is long enough for the wallet action review.",
    hashTooShort: "Hash too short",
    hashTooShortCopy: "Short values are blocked so users do not bury an accidental fragment.",
    historyGuidance:
      "Buried records remain inspectable here. Forgetting marks a paid follow-up state instead of deleting the audit trail.",
    itemsDestroyed: "Buried",
    memoryType: "Memory Type",
    memoryTypeConfession: "Confession",
    memoryTypeOther: "Other",
    memoryTypeRegret: "Regret",
    memoryTypeSecret: "Secret",
    memoryTypeWish: "Wish",
    noDestructions: "No burial records yet",
    recentDestructions: "Burial Records",
    records: "records",
    refreshRecords: "Refresh Records",
    selectedType: "Selected type",
    subtitle: "Hash-based memory burial on-chain",
    title: "Graveyard",
    tokenGas: "GAS",
    transactionPath: "Transaction path",
    walletAction: "Wallet action",
    walletActionCopy: "The wallet submits the paid burial intent through the NFT service boundary.",
    warning: "Permanent record",
    warningText:
      "This writes the content hash on-chain permanently. Forgetting records an additional paid state change and cannot be reversed.",
  };
  return messages[key] ?? key;
}

const historyItem: HistoryItem = {
  id: "memory-1",
  hash: "0x1234567890abcdef1234567890abcdef12345678",
  time: "2026-06-02",
  forgotten: false,
  memoryType: 1,
};

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values = {
    assetHash: "",
    forgettingId: "",
    gasReclaimedDisplay: "0 GAS",
    history: [],
    historyCount: 0,
    isDestroying: false,
    isLoading: false,
    memoryType: 1,
    memoryTypeOptions: [
      { value: 1, label: "Secret" },
      { value: 2, label: "Regret" },
      { value: 3, label: "Wish" },
    ],
    showConfirm: false,
    showWarningShake: false,
    totalDestroyed: 0,
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("Graveyard PlayArea", () => {
  it("shows burial review details and blocks short hashes before submission", () => {
    const dispatch = vi.fn(async () => undefined);

    render(
      <PlayArea
        t={t}
        state={state({ assetHash: "short" })}
        dispatch={dispatch}
      />,
    );

    expect(screen.getByText("Burial review")).toBeTruthy();
    expect(screen.getByText("Hash too short")).toBeTruthy();
    expect(screen.getByText("Needs action")).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Review burial" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("clears the hash and cancels any pending confirmation", async () => {
    const dispatch = vi.fn(async () => undefined);

    render(
      <PlayArea
        t={t}
        state={state({
          assetHash: "0x1234567890abcdef1234567890abcdef12345678",
          showConfirm: true,
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Clear Hash" }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("cancelDestroy");
    });
    expect((screen.getByLabelText("Content hash") as HTMLInputElement).value).toBe("");
  });

  it("dispatches burial, record refresh, and paid forgetting actions", async () => {
    const dispatch = vi.fn(async () => undefined);

    render(
      <PlayArea
        t={t}
        state={state({
          assetHash: "0x1234567890abcdef1234567890abcdef12345678",
          history: [historyItem],
          historyCount: 1,
          showConfirm: true,
          totalDestroyed: 1,
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Bury on-chain" }));
    fireEvent.click(screen.getByRole("button", { name: "Refresh Records" }));
    fireEvent.click(screen.getByRole("button", { name: "Forget" }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("executeDestroy");
      expect(dispatch).toHaveBeenCalledWith("refreshRecords");
      expect(dispatch).toHaveBeenCalledWith("forgetMemory", historyItem);
    });
  });
});
