import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../graveyard/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
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
  const base: Record<string, unknown> = {
    totalDestroyed: 0,
    burialFeesPaid: "0",
    gasReclaimedDisplay: "0 GAS",
    burialFeeDisplay: "0.1 GAS",
    forgetFeeDisplay: "1 GAS",
    historyCount: 0,
    isDestroying: false,
    isLoading: false,
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
  it("renders a memory-vault application surface instead of a naked form", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".graveyard-scene")).toBeTruthy();
    expect((container.querySelector(".graveyard-vault__image") as HTMLImageElement)?.src).toContain("memory-vault-stage.webp");
    expect(container.querySelector(".graveyard-artifact")).toBeTruthy();
    expect(container.querySelector(".graveyard-input")).toBeNull();
    expect(container.textContent).toContain("Burial review");
  });

  it("has reduced-motion and foreground clarity protections", () => {
    const fs = require("node:fs");
    const s = fs.readFileSync(`${process.cwd()}/../graveyard/src/PlayArea.scss`, "utf8");
    const tsx = fs.readFileSync(`${process.cwd()}/../graveyard/src/PlayArea.tsx`, "utf8");

    expect(s).toMatch(/prefers-reduced-motion/);
    expect(s).not.toContain("backdrop-filter");
    expect(s).toContain("@use \"@shared/components-react/v2/v2\"");
    expect(s).toMatch(/\.graveyard-scene\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.graveyard-scene\s*\{[\s\S]*box-shadow:\s*none/);
    expect(s).toMatch(/\.graveyard-play-area \.mx2-score\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/\.graveyard-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 172px/);
    expect(s).toMatch(/\.graveyard-vault\s*\{[\s\S]*grid-template-rows:\s*minmax\(220px,\s*auto\) auto auto/);
    expect(s).toMatch(/\.graveyard-vault__image\s*\{[\s\S]*object-fit:\s*contain/);
    expect(s).toMatch(/\.graveyard-vault__image\s*\{[\s\S]*opacity:\s*1/);
    expect(s).toMatch(/\.graveyard-vault__image\s*\{[\s\S]*filter:\s*none/);
    expect(s).toMatch(/\.graveyard-vault__media::after\s*\{[\s\S]*content:\s*none/);
    expect(s).toMatch(/\.graveyard-vault__media-chip\s*\{[\s\S]*position:\s*relative/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.graveyard-play-area \.mx2-stage__subtitle\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.graveyard-vault\s*\{[\s\S]*grid-template-rows:\s*auto auto auto/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.graveyard-vault__media,[\s\S]*\.graveyard-vault__image\s*\{[\s\S]*height:\s*146px/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.graveyard-review\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.graveyard-artifact__editor--textarea\s*\{[\s\S]*min-height:\s*66px/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.graveyard-artifact__foot span\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.graveyard-type-dock\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.graveyard-type-dock\s*\{[\s\S]*overflow:\s*visible/);
    expect(s).not.toMatch(/\.graveyard-scene\s*\{[\s\S]*radial-gradient/);
    expect(s).not.toMatch(/\.graveyard-vault__image\s*\{[^}]*object-fit:\s*cover/);
    expect(s).not.toMatch(/\.graveyard-vault__image\s*\{[^}]*filter:\s*saturate/);
    expect(s).not.toMatch(/\.graveyard-vault__media-chip\s*\{[^}]*position:\s*absolute/);
    expect(tsx).not.toContain("⚰");
  });
});
