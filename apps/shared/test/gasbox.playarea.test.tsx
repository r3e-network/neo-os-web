import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../gasbox/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string) {
  const m: Record<string,string> = {
    title:"GasBox",
    docSubtitle:"Pull machines.",
    tapToPlay:"Pull",
    totalMachines:"Machines",
    yourPulls:"Your Pulls",
    totalPulls:"Pulls",
    collect:"Credit",
    congratulations:"Won!",
    commitPendingRetry:"Reveal pending",
    gasboxCommitted:"Reveal next block",
    gasboxRevealAction:"Reveal result",
    gasboxRevealHint:"Safe to retry",
    gasboxHeroTitle:"Pick a capsule machine.",
    gasboxWalletIntent:"Confirm the GAS bet in your wallet.",
    gasboxEmptyStageHint:"Live capsules appear here after sync.",
    gasboxCapsuleStation:"Capsule station",
    gasboxMarketSyncTitle:"Market sync in progress",
    gasboxMarketSyncCopy:"Refreshing checks live machines.",
    gasboxSyncingMachines:"Syncing live machines.",
    gasboxPrizeDeckPending:"Prize reel syncing",
    gasboxPrizeDeckPendingCopy:"Escrow prizes first.",
    gasboxDrawerMarketTitle:"Machine counter",
    gasboxDrawerMarketCopy:"Pick or refresh.",
    gasboxDrawerMarketEmpty:"No active machines loaded.",
    gasboxNoAvailablePrize:"No prize",
    gasboxPrizeFocus:"Prize focus",
    gasboxPrizeFocusOdds:"Drop chance",
    gasboxPullReadyTitle:"Ready for pull",
    gasboxPullBlockedTitle:"Pull unavailable",
    gasboxTwoStepNote:"Two-step pull",
    gasboxInventoryActionRequired:"Inventory needs funding",
    gasboxMarketEmptyTeaser:"Refresh to pull one.",
    gasboxPlayCreditLabel:"Prepaid credit",
    gasboxPlayCreditHint:"Your next pull uses it automatically.",
    gasboxCreatorEarningsTitle:"Creator earnings",
    gasboxRevenueAvailable:"Revenue available.",
    gasboxRevenueNone:"No revenue yet.",
    withdrawRevenue:"Withdraw Revenue",
    createMachineAction:"Create",
    createPanelHint:"Design a machine.",
    browseAll:"Browse",
    allMachines:"All Machines",
    create:"Studio",
    openStudio:"Open Studio",
    studioGuidance:"Create machines.",
    refreshMachines:"Refresh Machines",
    loadingMachines:"Loading machines...",
    readyToPlay:"Ready",
    inactive:"Inactive",
    pull:"Pull",
    pulling:"Pulling...",
    pullSuccess:"Reveal complete.",
    unknownPrize:"Unknown prize",
  };
  return m[k] ?? k;
}
function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  const b: Record<string, unknown> = { machines:[], selectedMachine:null, isLoading:false, isPulling:false, isCreating:false, pullResult:null, userPulls:0, totalPulls:0, machineCount:0, selectedMachineName:"", showResult:false, studioOpen:false, hasPlayCredit:false, formattedPlayCredit:"0", betPhase:"", canReveal:false, isAwaitingReveal:false, walletAddress:"", ...o };
  return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, createObservable(v)]));
}
const machine = {
  id: "m1",
  name: "Lucky Mint",
  active: true,
  inventoryReady: true,
  poolReady: true,
  creatorHash: "0x6d0656f6dd91469db1c90cc1e574380613f43738",
  revenue: "1.25",
  revenueRaw: 125000000,
  price: "0.1 GAS",
  items: [{ name: "Emerald capsule", rarity: "RARE", displayProbability: 12.5, available: true }],
};
const creatorAddress = "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32";
describe("GasBox PlayArea (v2)", () => {
  it("renders image-based machine and prize scene assets", () => {
    const { container } = render(<PlayArea t={t} state={state({ selectedMachine: machine, machines: [machine], selectedMachineName: "Lucky Mint", machineCount: 1 })} dispatch={vi.fn()} />);
    expect(container.querySelector(".gasbox-scene")).toBeTruthy();
    expect(container.querySelector<HTMLImageElement>(".gasbox-scene__machine-art")?.getAttribute("src")).toContain("gasbox-capsule-machine-cutout.webp");
    expect(container.querySelector<HTMLImageElement>(".gasbox-scene__result-art")?.getAttribute("src")).toContain("gasbox-prize-capsule-cutout.webp");
    expect(container.querySelectorAll(".gasbox-scene__capsule--rolling")).toHaveLength(4);
    expect(container.querySelector(".gasbox-scene__backdrop")).toBeNull();
    expect(container.querySelector(".gasbox-scene__wash")).toBeNull();
    expect(container.querySelector(".gasbox-scene__stage-light")).toBeNull();
    expect(container.textContent).not.toContain("🎰");
  });
  it("renders market sync as a designed game station instead of a broken prize card", () => {
    const { container } = render(<PlayArea t={t} state={state({ walletAddress:"Nabc", isLoading:true })} dispatch={vi.fn()} />);
    expect(container.querySelector('.gasbox-scene[data-state="syncing"]')).toBeTruthy();
    expect(container.querySelector(".gasbox-scene__sync-card")).toBeTruthy();
    expect(container.querySelectorAll(".gasbox-scene__sync-capsules img")).toHaveLength(5);
    expect(container.textContent).toContain("Market sync in progress");
    expect(container.textContent).toContain("Find machines");
    expect(container.textContent).not.toContain("No prize");
    expect(container.querySelector(".gasbox-scene__result")).toBeNull();
    expect(container.querySelector(".mx2-score")).toBeNull();
  });
  it("dispatches pull with the selected machine id", async () => {
    const d = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ walletAddress:"Nabc", selectedMachine: machine, machines: [machine], selectedMachineName: "Lucky Mint" })} dispatch={d} />);
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(d).toHaveBeenCalledWith("pull", "m1"));
  });
  it("uses the primary action to refresh when no machine is selected", async () => {
    const d = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ walletAddress:"Nabc" })} dispatch={d} />);
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(d).toHaveBeenCalledWith("refreshMachines"));
  });
  it("keeps Studio tucked in details when the market is empty", () => {
    const { container } = render(<PlayArea t={t} state={state({ walletAddress:"Nabc" })} dispatch={vi.fn()} />);
    const railText = Array.from(container.querySelectorAll(".mx2-action-rail button"))
      .map((button) => button.textContent?.trim())
      .join(" ");
    expect(railText).toContain("Find Machines");
    expect(railText).toContain("All Machines");
    expect(railText).not.toContain("Open Studio");
  });
  it("shows pull motion immediately after clicking pull", async () => {
    const d = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ walletAddress:"Nabc", selectedMachine: machine, machines: [machine], selectedMachineName: "Lucky Mint" })} dispatch={d} />);
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(container.querySelector('.gasbox-scene[data-state="pulling"]')).toBeTruthy());
  });
  it("dispatches reveal when awaiting reveal", async () => { const d = vi.fn().mockResolvedValue(undefined); const { container } = render(<PlayArea t={t} state={state({ isAwaitingReveal:true, walletAddress:"Nabc" })} dispatch={d} />); fireEvent.click(container.querySelector(".mx2-btn--primary") as Element); await waitFor(() => expect(d).toHaveBeenCalledWith("reveal")); });
  it("dispatches selectMachine on chip click", () => { const d = vi.fn().mockResolvedValue(undefined); const { container } = render(<PlayArea t={t} state={state({ machines: [{ id:"m1", name:"Lucky" }] })} dispatch={d} />); fireEvent.click(container.querySelector(".gasbox-machine-chip") as Element); expect(d).toHaveBeenCalledWith("selectMachine", "m1"); });
  it("shows machines in drawer", () => { const { container } = render(<PlayArea t={t} state={state({ machines: [{ id:"m1", name:"Lucky" }] })} dispatch={vi.fn()} />); fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element); expect(container.textContent).toContain("Lucky"); });
  it("shows creator earnings in the drawer and withdraws with machine id", () => {
    const d = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ walletAddress: creatorAddress, selectedMachine: machine, machines: [machine], selectedMachineName: "Lucky Mint" })} dispatch={d} />);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    const withdraw = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Withdraw Revenue"));
    expect(withdraw).toBeTruthy();
    fireEvent.click(withdraw!);
    expect(d).toHaveBeenCalledWith("withdrawRevenue", "m1");
  });
  it("does not expose revenue withdrawal to non-creators", () => {
    const { container } = render(<PlayArea t={t} state={state({ walletAddress: "Nabc", selectedMachine: machine, machines: [machine], selectedMachineName: "Lucky Mint" })} dispatch={vi.fn()} />);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.textContent).not.toContain("Creator earnings");
  });
  it("has reduced-motion, capsule animation, and clean stage coverage", () => {
    const fs = require("node:fs");
    const s = fs.readFileSync(`${process.cwd()}/../gasbox/src/PlayArea.scss`, "utf8");
    expect(s).toMatch(/prefers-reduced-motion/);
    expect(s).toMatch(/0\.001ms/);
    expect(s).toMatch(/gasbox-capsule-roll/);
    expect(s).toMatch(/gasbox-capsule-drop/);
    expect(s).toMatch(/gasbox-scene__sync-card/);
    expect(s).toMatch(/gasbox-machine-list__item/);
    expect(s).not.toMatch(/gasbox-scene__(?:backdrop|wash|stage-light)|gasbox-scene-art|backdrop-filter|radial-gradient/);
    expect(s).toMatch(/gasbox-play-area \.mx2-action-rail__row\s*\{[\s\S]*justify-content:\s*center/);
    expect(s).toMatch(/gasbox-play-area \.mx2-action-rail__drawer-toggle\s*\{[\s\S]*margin-left:\s*0/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*gasbox-scene\s*\{[\s\S]*min-height:\s*426px/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*gasbox-scene__status\s*\{[\s\S]*-webkit-line-clamp:\s*2/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*gasbox-play-area \.mx2-score\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*gasbox-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 204px/);
  });
});
