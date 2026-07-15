import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../graveyard/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
const REPO_ROOT = process.cwd().endsWith("/apps/shared")
  ? resolve(process.cwd(), "../..")
  : process.cwd();
function t(k: string) {
  const m: Record<string, string> = {
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
    destroyed: "Buried",
    destroyAsset: "Burial Chamber",
    destroying: "Burying...",
    destructionStats: "Burial Stats",
    docSubtitle: "On-chain burial and right-to-forget flow",
    editEpitaph: "Edit epitaph",
    epitaphPending: "Awaiting epitaph",
    epitaphPendingResolution: "An epitaph is awaiting readback.",
    epitaphRecoveryReady: "Epitaph awaiting confirmation",
    epitaphRecoveryHint: "Memory was submitted.",
    recoverEpitaphAction: "Check status",
    epitaphPlaceholder: "A short note for this memory",
    epitaphSave: "Save epitaph",
    forgetAction: "Forget",
    forgetConfirmAction: "Confirm forget",
    forgetConfirmFee: "Forgetting costs {fee}.",
    feePending: "Checking…",
    checkingLiveFees: "Checking live contract fees",
    checkingLiveFeesHint: "Reading the burial and forget fees.",
    contractPaused: "Memory Garden is temporarily paused",
    contractPausedHint: "No paid action is available while paused.",
    liveFeeUnavailable: "Live contract fees are unavailable",
    liveFeeUnavailableHint: "Retry before a paid action.",
    feeNeedsConnection: "Connect to load",
    feeNeedsConnectionTitle: "Fees load with your wallet",
    feeNeedsConnectionHint: "Nothing is charged until a fee is read and you confirm.",
    retryFeeCheck: "Retry",
    burialRecoveryReady: "A previous prepaid action needs recovery",
    burialRecoveryDepositHint: "Reuse the existing deposit.",
    burialRecoveryTargetHint: "Refresh the unresolved target transaction.",
    recoverBurial: "Review recovery",
    recoverBurialHint: "No new GAS deposit",
    burialPending: "Awaiting burial readback",
    burialPendingHint: "Duplicate payment is blocked",
    gasReclaimedEstimate: "GAS spent on burials",
    hashMissing: "Hash required",
    hashPending: "Waiting for hash",
    hashPreview: "Target",
    hashReady: "Ready for review",
    hashReadyCopy: "The target is long enough for review.",
    hashTooShortCopy: "Enter the full 64-character digest.",
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
    sha256Hint: "A leading 0x is accepted.",
    sha256InvalidHint: "Enter exactly 64 hexadecimal characters.",
  };
  return m[k] ?? k;
}
function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    totalDestroyed: 0,
    burialFeesPaid: "0",
    gasReclaimedDisplay: "0 GAS",
    burialFeeDisplay: "0.1 GAS",
    forgetFeeDisplay: "1 GAS",
    historyCount: 0,
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
    historyTruncated: false,
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
    history: [],
    ...o,
  };
  return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, createObservable(v)])) as ObservableState;
}
describe("graveyard PlayArea (v2)", () => {
  it("renders a designed memory-garden ritual with all three private sources", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".graveyard-app")).toBeTruthy();
    expect((container.querySelector(".graveyard-garden__image") as HTMLImageElement)?.src).toContain("memory-garden.webp");
    expect((container.querySelector(".graveyard-letter__paper") as HTMLImageElement)?.src).toContain("memory-letter.webp");
    expect(container.querySelectorAll(".graveyard-source-tabs button")).toHaveLength(3);
    expect(container.querySelector(".graveyard-types")).toBeTruthy();
    expect(container.querySelector(".graveyard-review-button")).toBeTruthy();
    expect(container.textContent).toContain("0.1 GAS");
  });

  it("keeps fees and the primary review action visible on mobile", () => {
    const s = readFileSync(resolve(REPO_ROOT, "apps/graveyard/src/PlayArea.scss"), "utf8");
    const tsx = readFileSync(resolve(REPO_ROOT, "apps/graveyard/src/PlayArea.tsx"), "utf8");

    expect(s).toMatch(/prefers-reduced-motion/);
    expect(s).not.toContain("backdrop-filter");
    // This standalone surface does not emit the entire shared v2/Semi theme;
    // every class it uses is locally scoped below `.graveyard-app`.
    expect(s).not.toContain("@shared/components-react/v2/v2");
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.graveyard-ritual__review\s*\{[\s\S]*padding:/);
    expect(s).not.toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.graveyard-ritual__review\s*\{[^}]*display:\s*none/);
    // PlayArea.scss migrated its palette from Sass `$moss-deep` etc. to the
    // `:root/.graveyard-app` `--gy-*` CSS custom-property design tokens; the
    // primary review button's brand fill is now `var(--gy-moss-deep)`.
    expect(s).toMatch(/\.graveyard-review-button\s*\{[\s\S]*background:\s*var\(--gy-moss-deep\)/);
    expect(s).toMatch(/\.graveyard-garden__header > div\s*\{[\s\S]*background:\s*rgb\(255 253 246 \/ 94%\)/);
    expect(tsx).toContain('variant="gas"');
    expect(tsx).toContain("memory-garden.webp");
    expect(tsx).toContain("memory-letter.webp");
    expect(tsx).not.toContain("⚰");
  });

  it("renders an explicit fee and wallet confirmation before the chain action", () => {
    const hash = "ab".repeat(32);
    const { container, getByRole } = render(
      <PlayArea
        t={t}
        state={state({ showConfirm: true, assetHash: hash, walletConnected: true, walletAddress: "NgaiKFjurmNmiRzDRQGs44yzByXuSkdGPF" })}
        dispatch={vi.fn()}
      />,
    );

    expect(getByRole("dialog")).toBeTruthy();
    expect(container.textContent).toContain("0.1 GAS");
    expect(container.querySelector(".graveyard-confirm__route")).toBeTruthy();
  });

  it("keeps keyboard focus inside the paid confirmation and supports Escape", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByRole } = render(
      <PlayArea
        t={t}
        state={state({ showConfirm: true, assetHash: "ab".repeat(32) })}
        dispatch={dispatch}
      />,
    );
    const dialog = getByRole("dialog");
    const buttons = Array.from(dialog.querySelectorAll<HTMLButtonElement>("button:not([disabled])"));
    const first = buttons[0]!;
    const last = buttons[buttons.length - 1]!;

    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(last);
    fireEvent.keyDown(window, { key: "Tab" });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(dispatch).toHaveBeenCalledWith("cancelDestroy");
  });

  // Re-pinned for the settled/loading split. The guard's intent is unchanged and
  // still fully asserted: with no verified fee, the paid action stays blocked
  // and a retry is offered. Only the copy moved — a fee read that SETTLED with
  // nothing is the expected pre-wallet first paint, so it no longer renders the
  // amber "Live contract fees are unavailable. No GAS will move until they are
  // verified." accusation. `feesSettled` must be set explicitly now: without it
  // the honest phase is "loading", which is what the added case below covers.
  it("blocks GAS actions and offers recovery once a fee read settles unverified", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByText, queryByText } = render(
      <PlayArea
        t={t}
        state={state({ feesReady: false, feesSettled: true, assetHash: "ab".repeat(32) })}
        dispatch={dispatch}
      />,
    );
    const review = container.querySelector(".graveyard-review-button") as HTMLButtonElement;
    expect(review.disabled).toBe(true);
    expect(getByText("Fees load with your wallet")).toBeTruthy();
    // The expected pre-wallet state must not accuse the product of being broken.
    expect(queryByText("Live contract fees are unavailable")).toBeNull();
    fireEvent.click(getByText("Retry"));
    expect(dispatch).toHaveBeenCalledWith("refreshRecords");
  });

  it("narrates an in-flight fee read instead of asserting it already failed", () => {
    // The defect this guards: the rails rendered "Checking…" while the panel
    // below simultaneously declared the fees unavailable, because `feesReady`
    // alone could not tell "still asking" from "asked, got nothing".
    const { container, getByText, queryByText } = render(
      <PlayArea
        t={t}
        state={state({ feesReady: false, feesSettled: false, isLoading: true, assetHash: "ab".repeat(32) })}
        dispatch={vi.fn()}
      />,
    );

    expect(getByText("Checking live contract fees")).toBeTruthy();
    expect(queryByText("Live contract fees are unavailable")).toBeNull();
    expect(queryByText("Fees load with your wallet")).toBeNull();
    // Nothing to retry while the read is still running.
    expect(queryByText("Retry")).toBeNull();
    expect((container.querySelector(".graveyard-review-button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("distinguishes a paused contract from an RPC failure before payment", () => {
    const { container, getByText } = render(
      <PlayArea
        t={t}
        state={state({
          feesReady: false,
          // The pause is only known once the contract read has come back.
          feesSettled: true,
          contractPaused: true,
          assetHash: "ab".repeat(32),
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(getByText("Memory Garden is temporarily paused")).toBeTruthy();
    expect((container.querySelector(".graveyard-review-button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("surfaces a prepaid recovery as the next primary task without asking for new GAS", () => {
    const { container, getByText } = render(
      <PlayArea
        t={t}
        state={state({
          assetHash: "ab".repeat(32),
          burialRecoveryPhase: "deposit-broadcast",
          burialRecoveryTxid: "0xdeposit",
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(getByText("A previous prepaid action needs recovery")).toBeTruthy();
    expect(getByText("Review recovery")).toBeTruthy();
    expect(container.textContent).toContain("No new GAS deposit");
  });

  it("blocks a second burial while the exact target transaction awaits readback", () => {
    const { container, getByText } = render(
      <PlayArea
        t={t}
        state={state({
          assetHash: "ab".repeat(32),
          burialRecoveryPhase: "target-broadcast",
          burialRecoveryTxid: "0xtarget",
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(getByText("Awaiting burial readback")).toBeTruthy();
    expect(getByText("Duplicate payment is blocked")).toBeTruthy();
    expect((container.querySelector(".graveyard-review-button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("turns an unresolved epitaph into a read-only recovery task", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getAllByText, getByText } = render(
      <PlayArea
        t={t}
        state={state({
          history: [{ id: "7", hash: "ab".repeat(32), time: "", forgotten: false }],
          historyCount: 1,
          epitaphRecoveryPhase: "target-broadcast",
          epitaphRecoveryMemoryId: "7",
          epitaphRecoveryTxid: "0xepitaph",
        })}
        dispatch={dispatch}
      />,
    );

    // Opens the records. This used to click the first of two "Burial Records"
    // rows — a shortcut card that duplicated the section header directly below
    // it. The duplicate is gone, so drive the records section's own Open toggle;
    // the intent (reveal the records, then assert on them) is unchanged.
    // (The t() stub echoes unmapped keys, so the toggle renders as "open".)
    fireEvent.click(getByText("open"));
    expect(getByText("Epitaph awaiting confirmation")).toBeTruthy();
    const editButton = container.querySelector(".graveyard-record__actions button") as HTMLButtonElement;
    expect(editButton.disabled).toBe(true);
    fireEvent.click(getByText("Check status"));
    expect(dispatch).toHaveBeenCalledWith("recoverEpitaph");
  });

  it("explains an invalid existing hash instead of leaving a disabled dead end", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByRole, getByText } = render(
      <PlayArea
        t={t}
        state={state({ composeMode: "hash", memoryText: "abcd", assetHash: "abcd" })}
        dispatch={dispatch}
      />,
    );

    const input = getByRole("textbox", { name: /Content hash/i });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("graveyard-hash-hint");
    expect(getByText("Enter the full 64-character digest.")).toBeTruthy();
    expect((container.querySelector(".graveyard-review-button") as HTMLButtonElement).disabled).toBe(true);
  });

  it("uses the designed workspace as the only operation surface", () => {
    const manifest = JSON.parse(
      readFileSync(resolve(REPO_ROOT, "apps/graveyard/neo-manifest.json"), "utf8"),
    ) as { operation_panel?: { operations?: unknown[] } };

    expect(manifest.operation_panel?.operations).toEqual([]);
  });

  it("keeps key small-copy color pairs above WCAG AA contrast", () => {
    const luminance = (hex: string) => {
      const channels = [0, 2, 4].map((offset) =>
        Number.parseInt(hex.slice(1 + offset, 3 + offset), 16) / 255,
      );
      const linear = channels.map((channel) =>
        channel <= 0.03928
          ? channel / 12.92
          : ((channel + 0.055) / 1.055) ** 2.4,
      );
      return 0.2126 * linear[0]! + 0.7152 * linear[1]! + 0.0722 * linear[2]!;
    };
    const contrast = (foreground: string, background: string) => {
      const values = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
      return (values[0]! + 0.05) / (values[1]! + 0.05);
    };
    const pairs = [
      ["#183629", "#f8f7f1"],
      ["#4f6258", "#fffefa"],
      ["#5d6d63", "#f6f0e5"],
      ["#56665c", "#f6f0e5"],
      ["#5f6d64", "#fffefa"],
      ["#294f37", "#eef5eb"],
      ["#fffdf7", "#23432f"],
    ] as const;

    for (const [foreground, background] of pairs) {
      expect(contrast(foreground, background)).toBeGreaterThanOrEqual(4.5);
    }
  });
});
