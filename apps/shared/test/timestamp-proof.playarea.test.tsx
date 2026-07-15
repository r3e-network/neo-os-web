import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../timestamp-proof/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string) {
  const messages: Record<string, string> = {
    anchorCostNote: "Anchoring writes the digest into a public Neo transaction.",
    anchoredOnChain: "Anchored on-chain",
    anchoredProofs: "Anchored",
    anchorOnChain: "Anchor on-chain",
    anchorShort: "Anchor",
    broadcastPending: "Broadcast pending",
    checkReceipt: "Check receipt",
    checkingReceipt: "Checking…",
    clearRetryLock: "Clear retry lock",
    contentChars: "Characters",
    contentPlaceholder: "Paste your text, document hash, or idea...",
    createPanelKicker: "Create",
    createPanelBody: "Place source material on the proof sheet.",
    createPanelTitle: "Prepare a timestamp certificate",
    createProof: "Create Proof",
    documentPreviewEmptyTitle: "Ready for content",
    documentTypeHash: "SHA-256 digest",
    documentTypeText: "Source content",
    digestPassThrough: "Use this digest directly",
    enterContent: "Enter content to timestamp",
    latestId: "Latest ID",
    latestIdNone: "None yet",
    localHashPending: "Will hash locally on save",
    localOnly: "Local only",
    journalUnavailable: "Existing records are hidden, not deleted.",
    journalUnavailableShort: "Journal unavailable",
    journalUnavailableTitle: "Proof journal unavailable",
    notAvailable: "N/A",
    networkMainnet: "Neo N3 Mainnet",
    networkNotConnected: "Wallet network not connected",
    networkTestnet: "Neo N3 Testnet",
    noProofsHint: "Saved proof entries will appear here.",
    pendingDigest: "After save",
    proofDigest: "SHA-256 digest",
    proofId: "Proof ID",
    proofPressAnchorAnchoring: "Anchoring",
    proofDeskAlt: "Timestamp proof desk with a sealed certificate",
    proofPressEmptyBody: "Nothing leaves this device.",
    proofPressEmptyTitle: "Proof press standing by.",
    proofPressKicker: "Document fingerprint",
    proofPressLabel: "Animated proof press",
    proofPressReadyBody: "One tap hashes the content on this device and saves a timestamp certificate.",
    proofPressReadyTitle: "Fingerprint queued. Review the sheet, then seal the proof.",
    proofPressStampingTitle: "Stamping the local certificate.",
    proofPrivacy: "Your source content stays local; only the digest is saved or anchored.",
    proofRouteAnchor: "Public anchor",
    proofRouteHash: "Local hash",
    proofRouteLabel: "Proof route",
    proofRouteReady: "Ready",
    proofRouteSave: "Device proof",
    proofRouteWaiting: "Waiting",
    proofSheetLabel: "Proof sheet",
    proofStageKicker: "Proof desk",
    proofStageTitle: "Timestamp proof press",
    proofTemplateAudit: "Audit seal",
    proofTemplateAuditBody: "Review result or report",
    proofTemplateDigest: "Known digest",
    proofTemplateDigestBody: "Paste a SHA-256 hash",
    proofTemplateRelease: "Release note",
    proofTemplateReleaseBody: "Version or artifact note",
    proofTemplatesLabel: "Proof templates",
    proofWorkspace: "Timestamp proof workspace",
    retryJournal: "Retry journal",
    submissionInterrupted: "Submission interrupted",
    verificationNetwork: "Receipt network",
    recentProofs: "Recent Proofs",
    timestamp: "Timestamp",
    totalProofs: "Total Proofs",
    validProof: "Proof Found",
    verify: "Verify",
    verifyFailed: "Verification failed",
    verifyPlaceholder: "Proof ID, SHA-256 digest, or original content",
    verifyProof: "Verify Proof",
    verifying: "Verifying...",
  };
  return messages[key] ?? key;
}

function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    anchoredProofs: 0,
    isAnchoring: false,
    isCreating: false,
    isRecovering: false,
    isVerifying: false,
    // Mirrors main.tsx: the latestId observable reports "no proof saved yet" as
    // an empty string and lets each view name that state. It used to seed "N/A"
    // here because the composable itself emitted ctx.t("notAvailable"), which
    // pinned a placeholder void onto the first-run route tile and footer chip.
    latestId: "",
    proofs: [],
    storageState: "ready",
    totalProofs: 0,
    verifiedProof: null,
    verificationSource: "none",
    verifyError: false,
    ...o,
  };
  return Object.fromEntries(
    Object.entries(base).map(([key, value]) => [key, createObservable(value)]),
  );
}

function playAreaStyles(app: string): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return readFileSync(path.join(appsRoot, app, "src/PlayArea.scss"), "utf8");
}

describe("timestamp-proof PlayArea (v2)", () => {
  it("renders a foreground proof desk instead of the old empty backdrop scene", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".tsp-workbench")).toBeTruthy();
    expect(container.querySelector(".tsp-document-card")).toBeTruthy();
    expect(container.querySelector(".tsp-proof-sheet")).toBeTruthy();
    expect(container.querySelector(".tsp-proof-sheet__surface")).toBeTruthy();
    expect(container.querySelector(".tsp-proof-sheet__editor")).toBeTruthy();
    expect(container.querySelector(".tsp-proof-sheet__source")).toBeTruthy();
    expect(container.querySelector(".tsp-proof-sheet__seal")).toBeTruthy();
    expect(container.querySelector(".tsp-proof-sheet__seal-row")).toBeTruthy();
    expect(container.querySelector(".tsp-proof-sheet__privacy")).toBeTruthy();
    expect(container.querySelector(".tsp-press-card")).toBeTruthy();
    expect(container.querySelector<HTMLImageElement>(".tsp-press-card__media img")?.getAttribute("src")).toContain("proof-desk.webp");
    expect(container.querySelectorAll(".tsp-route li")).toHaveLength(3);
    expect(screen.getByText("Timestamp proof press")).toBeTruthy();
    expect(container.querySelector(".tool-scene")).toBeNull();
    expect(container.querySelector(".tsp-scene__backdrop")).toBeNull();
    expect(container.querySelector(".tsp-template-row")).toBeNull();
    expect(container.querySelector(".tsp-document-card__input")).toBeNull();
    expect(container.textContent).not.toContain("wake the press");
  });

  it("uses the document proof creation flow as the primary action", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.change(screen.getByLabelText("Paste your text, document hash, or idea..."), {
      target: { value: "release artifact v2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create Proof/ }));

    expect(dispatch).toHaveBeenCalledWith("createProof", "release artifact v2");
  });

  it("keeps the draft until storage-backed creation resolves true", async () => {
    const failedDispatch = vi.fn().mockResolvedValue(false);
    const first = render(<PlayArea t={t} state={state()} dispatch={failedDispatch} />);
    const failedEditor = screen.getByLabelText("Paste your text, document hash, or idea...") as HTMLTextAreaElement;
    fireEvent.change(failedEditor, { target: { value: "keep this draft" } });
    fireEvent.click(screen.getByRole("button", { name: /Create Proof/ }));
    await waitFor(() => expect(failedDispatch).toHaveBeenCalled());
    expect(failedEditor.value).toBe("keep this draft");

    first.unmount();
    const successfulDispatch = vi.fn().mockResolvedValue(true);
    render(<PlayArea t={t} state={state()} dispatch={successfulDispatch} />);
    const savedEditor = screen.getByLabelText("Paste your text, document hash, or idea...") as HTMLTextAreaElement;
    fireEvent.change(savedEditor, { target: { value: "saved draft" } });
    fireEvent.click(screen.getByRole("button", { name: /Create Proof/ }));
    await waitFor(() => expect(savedEditor.value).toBe(""));
  });

  it("treats pasted SHA-256 digests as the proof target and hides stale saved digests while editing", () => {
    const proof = {
      id: 4,
      content: "old document",
      contentHash: "b".repeat(64),
      timestamp: Date.now(),
      anchored: false,
    };
    const { container } = render(<PlayArea t={t} state={state({ proofs: [proof], latestId: "#4" })} dispatch={vi.fn()} />);

    expect(container.textContent).toContain("bbbbbbbb...bbbbbb");

    fireEvent.change(screen.getByLabelText("Paste your text, document hash, or idea..."), {
      target: { value: "fresh private draft" },
    });
    expect(container.textContent).toContain("Will hash locally on save");
    expect(container.textContent).not.toContain("bbbbbbbb...bbbbbb");

    cleanup();
    const digest = "a".repeat(64);
    const rendered = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Paste your text, document hash, or idea..."), {
      target: { value: digest },
    });
    expect(rendered.container.textContent).toContain("Use this digest directly");
    expect(rendered.container.textContent).toContain("aaaaaaaa...aaaaaa");
  });

  it("keeps anchoring as a secondary action for an existing local proof", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const proof = {
      id: 7,
      content: "audit artifact",
      contentHash: "a".repeat(64),
      timestamp: Date.now(),
      anchored: false,
    };
    render(<PlayArea t={t} state={state({ proofs: [proof], latestId: "#7" })} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: /^Anchor$/ }));

    expect(dispatch).toHaveBeenCalledWith("anchorProof", 7);
  });

  it("turns a saved broadcast into receipt recovery instead of another anchor submit", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const proof = {
      id: 8,
      content: "pending artifact",
      contentHash: "c".repeat(64),
      timestamp: Date.now(),
      anchorStatus: "pending",
      anchorTxid: `0x${"d".repeat(64)}`,
      anchorNetwork: "neo-n3-mainnet",
      anchored: false,
    };
    render(<PlayArea t={t} state={state({ proofs: [proof], latestId: "#8" })} dispatch={dispatch} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Check receipt" }).at(-1) as HTMLButtonElement);

    expect(dispatch).toHaveBeenCalledWith("recoverPendingAnchors");
    expect(dispatch).not.toHaveBeenCalledWith("anchorProof", 8);
  });

  it("keeps an interrupted wallet submission locked until the user explicitly clears it", () => {
    const dispatch = vi.fn().mockResolvedValue(true);
    const proof = {
      id: 9,
      content: "interrupted artifact",
      contentHash: "e".repeat(64),
      timestamp: Date.now(),
      anchorStatus: "preparing",
      anchorNetwork: "neo-n3-mainnet",
      anchored: false,
    };
    render(<PlayArea t={t} state={state({ proofs: [proof], latestId: "#9" })} dispatch={dispatch} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Clear retry lock" }).at(-1) as HTMLButtonElement);

    expect(dispatch).toHaveBeenCalledWith("releasePreparingAnchor", 9);
    expect(dispatch).not.toHaveBeenCalledWith("anchorProof", 9);
  });

  it("names the first-run proof state honestly instead of printing an N/A void", () => {
    render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    // Storage is ready and the visitor simply has not saved a proof yet — a
    // normal pre-data first paint. Neither the DEVICE PROOF route tile nor the
    // LATEST ID footer chip may borrow the shared "N/A" placeholder for it.
    expect(screen.queryByText("N/A")).toBeNull();
    expect(screen.getAllByText("Waiting").length).toBeGreaterThan(0);
    expect(screen.getAllByText("None yet").length).toBeGreaterThan(0);
  });

  it("does not print the proof-sheet status twice on an empty sheet", () => {
    render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    // The sheet header owns "Ready for content"; the source row below the
    // textarea is a label -> value pair that must name the source category, not
    // repeat the header's status phrase ~150px away.
    expect(screen.getAllByText("Ready for content")).toHaveLength(1);
    expect(screen.getAllByText("Source content").length).toBeGreaterThan(0);
  });

  it("shows journal failure as unavailable instead of a zero-proof empty state", () => {
    const dispatch = vi.fn().mockResolvedValue(true);
    const { container } = render(<PlayArea t={t} state={state({ storageState: "unavailable" })} dispatch={dispatch} />);

    expect(container.querySelector(".tsp-journal-alert")).toBeTruthy();
    expect(screen.getAllByText("Proof journal unavailable").length).toBeGreaterThan(0);
    expect(screen.getAllByText("N/A").length).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText("Saved proof entries will appear here.")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Retry journal" }));
    expect(dispatch).toHaveBeenCalledWith("reloadProofs");
  });

  it("uses Open UI panels for secondary proof workspace controls", () => {
    const { container } = render(<PlayArea t={t} state={state({ verifyError: true })} dispatch={vi.fn()} />);

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as HTMLButtonElement);

    expect(container.querySelectorAll(".tsp-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(2);
    expect(container.querySelectorAll(".tsp-drawer__panel--wide")).toHaveLength(2);
    expect(container.querySelector(".tsp-network-switch")).toBeTruthy();
    expect(container.querySelector(".tsp-drawer__field.mx2-open-field .mx2-open-field__control input.semi-input")).toBeTruthy();
    expect(container.querySelectorAll(".tsp-drawer__actions .mx2-btn.mx2-btn--ghost")).toHaveLength(1);
    expect(container.querySelector(".tsp-drawer__notice.mx2-open-notice.semi-banner")).toBeTruthy();
    expect(container.querySelector(".tsp-drawer__section")).toBeNull();
    expect(container.querySelector(".tsp-drawer__list")).toBeNull();
    expect(container.querySelector(".tsp-drawer h4")).toBeNull();
  });

  it("keeps the scene scoped, clean, and motion-accessible", () => {
    const styles = playAreaStyles("timestamp-proof");

    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(/animation-duration:\s*0\.001ms/);
    expect(styles).toMatch(/\.timestamp-proof-play-area\s*\{[\s\S]*--mx2-stage-floor:\s*#ffffff/);
    expect(styles).toMatch(/\.tsp-workbench\s*\{[\s\S]*grid-template-areas:\s*"press document"/);
    expect(styles).toMatch(/\.tsp-workbench\s*\{[\s\S]*align-items:\s*start/);
    expect(styles).toMatch(/\.tsp-workbench\s*\{[\s\S]*border:\s*0/);
    expect(styles).toMatch(/\.tsp-workbench\s*\{[\s\S]*background:\s*transparent/);
    expect(styles).toMatch(/\.tsp-document-card\s*\{[\s\S]*grid-area:\s*document/);
    expect(styles).toMatch(/\.tsp-proof-sheet\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.tsp-proof-sheet\s*\{[\s\S]*border-radius:\s*22px/);
    expect(styles).toMatch(/\.tsp-proof-sheet\s*\{[\s\S]*box-shadow:\s*0 6px 16px rgba\(15,\s*23,\s*42,\s*0\.035\)/);
    expect(styles).toMatch(/\.tsp-proof-sheet__surface\s*\{[\s\S]*background:\s*var\(--mx2-surface-2\)/);
    expect(styles).toMatch(/\.tsp-proof-sheet__surface\s*\{[\s\S]*padding:\s*13px 58px 13px 14px/);
    expect(styles).toMatch(/\.tsp-proof-sheet__seal\s*\{[\s\S]*position:\s*absolute/);
    expect(styles).toMatch(/\.tsp-proof-sheet__seal-row\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto/);
    expect(styles).toMatch(/\.tsp-proof-sheet__privacy\s*\{[\s\S]*background:\s*var\(--mx2-brand-light\)/);
    expect(styles).toMatch(/\.tsp-proof-sheet__editor\.mx2-open-field\s*\{[\s\S]*display:\s*block/);
    expect(styles).toMatch(/\.tsp-proof-sheet__editor \.mx2-open-field__label\s*\{[\s\S]*clip:\s*rect\(0 0 0 0\)/);
    expect(styles).toMatch(/\.tsp-proof-sheet__editor textarea,[\s\S]*\.tsp-proof-sheet__textarea textarea\s*\{[\s\S]*min-height:\s*56px/);
    expect(styles).toMatch(/\.tsp-proof-sheet__editor textarea,[\s\S]*\.tsp-proof-sheet__textarea textarea\s*\{[\s\S]*max-height:\s*72px/);
    expect(styles).toMatch(/\.tsp-proof-sheet__editor textarea,[\s\S]*\.tsp-proof-sheet__textarea textarea\s*\{[\s\S]*resize:\s*none/);
    expect(styles).toMatch(/\.tsp-proof-sheet__editor textarea,[\s\S]*\.tsp-proof-sheet__textarea textarea\s*\{[\s\S]*box-shadow:\s*none/);
    expect(styles).toMatch(/\.tsp-proof-sheet__source\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto/);
    expect(styles).toMatch(/\.tsp-proof-sheet__digest\s*\{[\s\S]*background:\s*var\(--mx2-surface-2\)/);
    expect(styles).toMatch(/\.tsp-template-dock\s*\{[\s\S]*display:\s*flex/);
    expect(styles).toMatch(/\.tsp-document-card__facts dd\s*\{[\s\S]*white-space:\s*normal/);
    expect(styles).toMatch(/\.tsp-press-card\s*\{[\s\S]*grid-area:\s*press/);
    expect(styles).toMatch(/\.tsp-press-card\s*\{[\s\S]*grid-template-areas:\s*"media"[\s\S]*"status"[\s\S]*"route"/);
    expect(styles).toMatch(/\.tsp-press-card__media\s*\{[\s\S]*border:\s*1px solid rgba\(15,\s*23,\s*42,\s*0\.08\)/);
    expect(styles).toMatch(/\.tsp-press-card__media img\s*\{[\s\S]*object-fit:\s*contain/);
    expect(styles).toMatch(/\.tsp-press-card__media img\s*\{[\s\S]*aspect-ratio:\s*1\.62 \/\s*1/);
    expect(styles).toMatch(/\.tsp-press-card__media img\s*\{[\s\S]*max-height:\s*292px/);
    expect(styles).toMatch(/\.tsp-press-card__media img\s*\{[\s\S]*filter:\s*none/);
    expect(styles).toMatch(/\.tsp-route\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.tsp-anchor-truth\s*\{[\s\S]*grid-area:\s*truth/);
    expect(styles).toMatch(/\.tsp-anchor-truth\s*\{[\s\S]*background:\s*var\(--mx2-bg\)/);
    expect(styles).toMatch(/\.tsp-drawer\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.tsp-drawer__panel--wide\s*\{[\s\S]*grid-column:\s*1 \/ -1/);
    expect(styles).toMatch(/\.tsp-drawer__notice\.mx2-open-notice\.semi-banner\s*\{[\s\S]*min-height:\s*78px/);
    expect(styles).toMatch(/\.tsp-network-switch\s*\{[\s\S]*background:\s*var\(--mx2-bg\)/);
    expect(styles).toMatch(/@media \(max-width:\s*860px\)[\s\S]*grid-template-areas:\s*"press"[\s\S]*"document"/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.timestamp-proof-play-area \.mx2-stage\s*\{[\s\S]*padding:\s*14px 14px 16px/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.tsp-workbench\s*\{[\s\S]*grid-template-areas:\s*"document"[\s\S]*"press"/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.tsp-document-card__facts\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.tsp-template-dock\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.tsp-proof-sheet__seal-row\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(0,\s*1fr\)/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.tsp-press-card\s*\{[\s\S]*grid-template-columns:\s*72px minmax\(0,\s*1fr\)/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.tsp-press-card__media img\s*\{[\s\S]*max-height:\s*72px/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.tsp-route\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.tsp-drawer\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(styles).toMatch(/\.tsp-route li\[data-active="true"\]\s*\{[\s\S]*background:\s*var\(--mx2-surface-2\)/);
    expect(styles).not.toMatch(/\.tsp-proof-sheet__editor textarea\s*\{[\s\S]*resize:\s*vertical/);
    expect(styles).not.toMatch(/\.tsp-proof-sheet__editor textarea\s*\{[^}]*min-height:\s*(?:9[0-9]|1[0-9]{2})px/);
    expect(styles).not.toMatch(/\.tsp-proof-sheet__editor textarea\s*\{[^}]*border:\s*1px/);
    expect(styles).not.toMatch(/\.tsp-drawer__section|\.tsp-drawer__list|\.tsp-drawer__section input|\.tsp-drawer__section-title/);
    expect(styles).not.toMatch(/#fffdf8/);
    expect(styles).not.toMatch(/tsp-template-row/);
    expect(styles).not.toMatch(/repeating-linear-gradient/);
    expect(styles).not.toMatch(/linear-gradient\(#ffffff 0 0\) padding-box/);
    expect(styles).not.toMatch(/__backdrop/);
    expect(styles).not.toMatch(/tool-scene/);
    expect(styles).not.toMatch(/--mx2-ink-soft/);
  });
});
