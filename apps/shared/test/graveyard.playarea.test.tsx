import React from "react";
import fs from "node:fs";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../graveyard/src/PlayArea";
import type { HistoryItem } from "../../graveyard/src/types";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    assetHash: "Content hash",
    composeModeWrite: "Write memory",
    composeModeHash: "I have a hash",
    composeModeWriteHint: "Hash locally from a private note",
    composeModeHashHint: "Use an existing encrypted target",
    memoryTextLabel: "Your memory",
    memoryTextPlaceholder: "Write the memory to bury.",
    memoryTextHint: "The text stays on this device.",
    hashFromMemory: "Hash (computed locally)",
    gasReclaimedEstimate: "Burial Fees (est.)",
    forgetConfirmFee: `Forgetting costs ${params?.fee ?? ""}.`,
    forgetConfirmAction: "Confirm forget",
    epitaph: "Epitaph",
    addEpitaph: "Add epitaph",
    editEpitaph: "Edit epitaph",
    epitaphPlaceholder: "A short note for this memory",
    epitaphSave: "Save epitaph",
    epitaphFree: "Free — no deposit",
    showAllRecords: "Show all records",
    showFewerRecords: "Show fewer",
    historyTruncatedNote: `Showing the most recent ${params?.shown ?? ""} of ${params?.total ?? ""} burials.`,
    assetHashHint:
      "Use the encrypted content hash or token identifier you intend to bury.",
    assetHashPlaceholder: "Enter encrypted content hash...",
    assetHashTooShort:
      "Enter at least 12 characters so the burial target is identifiable.",
    burialChecklist: "Burial checklist",
    burialFee: "Burial fee",
    burialReview: "Burial review",
    memoryVaultStage: "Memory vault",
    memoryConsole: "Memory console",
    sealReady: "Seal ready",
    sealEmpty: "Awaiting memory",
    memoryTypeLocal: "Record tag",
    memoryTypeLocalHint:
      "Categorises the memory; this tag is anchored on-chain alongside the content hash.",
    selectedTypeLocal: "Record tag",
    burialReviewSubtitle:
      "Confirm target, wallet action, and fee model before signing.",
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
    hashMissingCopy:
      "Enter the encrypted content hash before preparing the burial.",
    hashPending: "Waiting for hash",
    hashPreview: "Target",
    hashPreviewCopy:
      "Only the hash is written; original encrypted content stays outside the app.",
    hashQuality: "Hash quality",
    hashReady: "Ready for review",
    hashReadyCopy: "The target is long enough for the wallet action review.",
    hashTooShort: "Hash too short",
    hashTooShortCopy:
      "Short values are blocked so users do not bury an accidental fragment.",
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
    walletActionCopy:
      "The wallet submits the paid burial intent through the NFT service boundary.",
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

function state(
  overrides: Partial<Record<string, unknown>> = {},
): ObservableState {
  const values = {
    assetHash: "",
    burialFeeDisplay: "0.10 GAS",
    forgetFeeDisplay: "1 GAS",
    forgettingId: "",
    forgetConfirmId: "",
    epitaphDraftId: "",
    epitaphText: "",
    epitaphSavingId: "",
    showAllHistory: false,
    historyTruncated: false,
    // Default the compose mode to "hash" so the hash-input flow tests render the
    // content-hash field directly (the new default in the app is "write").
    composeMode: "hash",
    memoryText: "",
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
    Object.entries(values).map(([key, value]) => [
      key,
      createObservable(value),
    ]),
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
    expect(screen.getAllByText("Hash too short").length).toBeGreaterThan(0);
    expect(document.querySelector(".grave-ritual-stage--draft")).toBeTruthy();
    expect(document.querySelectorAll(".grave-ritual-track__step").length).toBe(
      4,
    );
    expect(
      document.querySelector(
        '.grave-ritual-stage__banner[src="memory-vault-stage.jpg"]',
      ),
    ).toBeTruthy();
    // Blocked-state review tile renders the short-hash guidance copy.
    expect(
      screen.getAllByText(
        "Short values are blocked so users do not bury an accidental fragment.",
      ).length,
    ).toBeGreaterThan(0);
    expect(
      (
        screen.getByRole("button", {
          name: "Review burial",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("binds the burial fee from state and labels the type as a local record tag", () => {
    const dispatch = vi.fn(async () => undefined);

    render(
      <PlayArea
        t={t}
        state={state({
          assetHash: "0x1234567890abcdef1234567890abcdef12345678",
          burialFeeDisplay: "0.10 GAS",
        })}
        dispatch={dispatch}
      />,
    );

    // Fee is derived from the source-of-truth constant (state), not hardcoded.
    expect(screen.getByText("0.10 GAS")).toBeTruthy();
    expect(document.querySelector(".graveyard-play-area--ready")).toBeTruthy();
    expect(document.querySelector(".grave-ritual-stage--ready")).toBeTruthy();
    expect(
      document.querySelector(
        '.grave-ritual-stage__seal img[src="memory-vault-stage.jpg"]',
      ),
    ).toBeTruthy();
    // Memory type is presented as a record tag that is anchored on-chain
    // alongside the content hash (one label on the selector, one in the review
    // panel).
    expect(screen.getAllByText("Record tag").length).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByText(
        "Categorises the memory; this tag is anchored on-chain alongside the content hash.",
      ),
    ).toBeTruthy();
  });

  it("uses the brand-green primary variant for the burial CTA, not the danger variant", () => {
    const dispatch = vi.fn(async () => undefined);

    render(
      <PlayArea
        t={t}
        state={state({
          assetHash: "0x1234567890abcdef1234567890abcdef12345678",
        })}
        dispatch={dispatch}
      />,
    );

    const cta = screen.getByRole("button", { name: "Review burial" });
    expect(cta.className).toContain("neo-btn--primary");
    expect(cta.className).not.toContain("neo-btn--danger");
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

    expect(
      document.querySelector(".grave-ritual-stage--confirming"),
    ).toBeTruthy();
    expect(document.querySelector(".grave-ritual-pulse")).toBeTruthy();
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("cancelDestroy");
    });
    expect(
      (screen.getByLabelText("Content hash") as HTMLInputElement).value,
    ).toBe("");
  });

  it("dispatches burial and record refresh, and ARMS a forget confirmation (does not pay on first tap)", async () => {
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
    // First tap on Forget ARMS the confirmation (requestForget) — it must NOT
    // fire the paid forgetMemory immediately (forgetting costs 1 GAS).
    fireEvent.click(screen.getByRole("button", { name: "Forget" }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("executeDestroy");
      expect(dispatch).toHaveBeenCalledWith("refreshRecords");
      expect(dispatch).toHaveBeenCalledWith("requestForget", historyItem);
    });
    expect(dispatch).not.toHaveBeenCalledWith("forgetMemory", historyItem);
  });

  it("shows the forget fee and pays only after the explicit confirm", async () => {
    const dispatch = vi.fn(async () => undefined);

    render(
      <PlayArea
        t={t}
        state={state({
          history: [historyItem],
          historyCount: 1,
          totalDestroyed: 1,
          // The row is already armed for confirmation.
          forgetConfirmId: historyItem.id,
          forgetFeeDisplay: "1 GAS",
        })}
        dispatch={dispatch}
      />,
    );

    // The confirmation surfaces the live forget fee before any GAS moves.
    expect(screen.getByText("Forgetting costs 1 GAS.")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Confirm forget" }));
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("forgetMemory", historyItem);
    });
  });

  it("offers an Add epitaph action and a local-hash 'write memory' compose mode", () => {
    const dispatch = vi.fn(async () => undefined);

    render(
      <PlayArea
        t={t}
        state={state({
          history: [historyItem],
          historyCount: 1,
          totalDestroyed: 1,
        })}
        dispatch={dispatch}
      />,
    );

    // The epitaph affordance exists on a non-forgotten row (free, non-deposit).
    fireEvent.click(screen.getByRole("button", { name: "Add epitaph" }));
    expect(dispatch).toHaveBeenCalledWith("startEpitaph", historyItem);

    // The compose-mode toggle exposes the local-hash "write memory" mode.
    expect(screen.getByRole("tab", { name: /Write memory/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Write memory/ }));
    expect(dispatch).toHaveBeenCalledWith("setComposeMode", "write");
  });

  it("uses a generated memory-vault scene as the real burial stage asset", () => {
    render(
      <PlayArea
        t={t}
        state={state({
          assetHash: "0x1234567890abcdef1234567890abcdef12345678",
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(
      fs.existsSync(`${process.cwd()}/../graveyard/public/memory-vault-stage.jpg`),
    ).toBe(true);
    expect(
      document.querySelector('.grave-hero-art img[src="memory-vault-stage.jpg"]'),
    ).toBeTruthy();
    expect(
      document.querySelector(
        '.grave-ritual-stage__banner[src="memory-vault-stage.jpg"]',
      ),
    ).toBeTruthy();
    expect(screen.getByLabelText("Memory console")).toBeTruthy();
  });

  it("renders the write-memory textarea and routes typing through setMemoryText (local hashing)", () => {
    const dispatch = vi.fn(async () => undefined);

    render(
      <PlayArea
        t={t}
        state={state({ composeMode: "write" })}
        dispatch={dispatch}
      />,
    );

    const textarea = screen.getByLabelText("Your memory");
    expect(textarea).toBeTruthy();
    fireEvent.change(textarea, { target: { value: "a secret memory" } });
    expect(dispatch).toHaveBeenCalledWith("setMemoryText", "a secret memory");
    // No raw content-hash field in write mode — only the locally derived hash.
    expect(screen.queryByLabelText("Content hash")).toBeNull();
  });

  it("keeps the burial ritual motion accessible with reduced-motion fallbacks", () => {
    const styles = fs.readFileSync(
      `${process.cwd()}/../graveyard/src/PlayArea.scss`,
      "utf8",
    );

    expect(styles).toContain(".grave-ritual-stage");
    expect(styles).toContain(".grave-memory-console");
    expect(styles).toContain(".grave-ritual-track");
    expect(styles).toContain("@keyframes grave-banner-drift");
    expect(styles).toContain("@keyframes grave-seal-ready");
    expect(styles).toContain("@keyframes grave-confirm-pulse");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.grave-ritual-stage__banner[\s\S]*animation:\s*none/,
    );
    expect(styles).toMatch(
      /@media \(max-width: 720px\)[\s\S]*\.grave-ritual-track[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/,
    );
  });
});
