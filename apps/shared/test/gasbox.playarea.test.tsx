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
    gasboxFindMachines:"Refresh live counter",
    gasboxDetails:"Wallet & machines",
    gasboxConnectAction:"Connect wallet",
    gasboxPaidPullsPaused:"Paid pulls paused",
    gasboxBrowseOnly:"Browse only",
    gasboxPublishingPaused:"Publishing paused",
    gasboxDeploymentPausedTitle:"Paid play is temporarily paused",
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
  const b: Record<string, unknown> = { machines:[], selectedMachine:null, isLoading:false, isPulling:false, isCreating:false, pullResult:null, userPulls:0, totalPulls:0, machineCount:0, selectedMachineName:"", showResult:false, studioOpen:false, hasPlayCredit:false, formattedPlayCredit:"0", formattedWalletGas:"0", formattedWalletNeo:"0", betPhase:"", pendingBetId:"", canReveal:false, isAwaitingReveal:false, walletAddress:"", walletStatus:"disconnected", runtimeStatus:"ready", runtimeNetwork:"Neo N3 TestNet", runtimeContract:"0x30e9d4a4758827361c3b51a0e8460b067e58b1db", catalogStatus:"ready", ...o };
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
  revenueBaseUnits: "125000000",
  price: "0.1",
  prizeAsset: "GAS",
  freePool: "9",
  reservedPool: "1",
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
    expect(container.querySelectorAll(".gasbox-finance-strip .mx2-coin")).toHaveLength(2);
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
    expect(container.textContent).toContain("Read live machines");
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
    expect(railText).toContain("Refresh live counter");
    expect(railText).toContain("Wallet & machines");
    expect(railText).not.toContain("Open Studio");
  });
  it("does not fake pull motion before the real transaction state changes", async () => {
    const d = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ walletAddress:"Nabc", selectedMachine: machine, machines: [machine], selectedMachineName: "Lucky Mint" })} dispatch={d} />);
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(d).toHaveBeenCalledWith("pull", "m1"));
    expect(container.querySelector('.gasbox-scene[data-state="ready"]')).toBeTruthy();
    expect(container.querySelector('.gasbox-scene[data-state="pulling"]')).toBeNull();
  });
  it("animates only when the real isPulling state is active", () => {
    const { container } = render(<PlayArea t={t} state={state({ isPulling:true, walletAddress:"Nabc", selectedMachine: machine, machines: [machine], selectedMachineName: "Lucky Mint" })} dispatch={vi.fn()} />);
    expect(container.querySelector('.gasbox-scene[data-state="pulling"]')).toBeTruthy();
  });
  it("dispatches reveal when awaiting reveal", async () => { const d = vi.fn().mockResolvedValue(undefined); const { container } = render(<PlayArea t={t} state={state({ isAwaitingReveal:true, walletAddress:"Nabc" })} dispatch={d} />); fireEvent.click(container.querySelector(".mx2-btn--primary") as Element); await waitFor(() => expect(d).toHaveBeenCalledWith("reveal")); });
  it("dispatches selectMachine on chip click", () => { const d = vi.fn().mockResolvedValue(undefined); const { container } = render(<PlayArea t={t} state={state({ machines: [{ id:"m1", name:"Lucky" }] })} dispatch={d} />); fireEvent.click(container.querySelector(".gasbox-machine-chip") as Element); expect(d).toHaveBeenCalledWith("selectMachine", "m1"); });
  it("shows machines in drawer", () => { const { container } = render(<PlayArea t={t} state={state({ machines: [{ id:"m1", name:"Lucky" }] })} dispatch={vi.fn()} />); fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element); expect(container.textContent).toContain("Lucky"); });
  it("keeps creation secondary but exposes a complete resource-led machine builder", async () => {
    const d = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ walletAddress:"Nabc", studioOpen:true })} dispatch={d} />);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.querySelector(".gasbox-studio-blueprint img")).toBeTruthy();
    const core = container.querySelectorAll<HTMLInputElement>(".gasbox-studio-core input");
    fireEvent.change(core[0], { target: { value: "Aurora Capsule" } });
    fireEvent.change(core[1], { target: { value: "0.1" } });
    const capsule = container.querySelectorAll<HTMLInputElement>(".gasbox-studio-capsules__list input");
    fireEvent.change(capsule[0], { target: { value: "Legend Capsule" } });
    fireEvent.change(capsule[1], { target: { value: "5" } });
    fireEvent.change(capsule[2], { target: { value: "1" } });
    const publish = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Publish machine"));
    expect(publish).toBeTruthy();
    expect((publish as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(publish!);
    await waitFor(() => expect(d).toHaveBeenCalledWith("publishMachine", {
      name: "Aurora Capsule",
      price: "0.1",
      prizeAsset: "GAS",
      items: [{ name: "Legend Capsule", weight: "5", amount: "1" }],
    }));
  });
  it("shows creator earnings in the drawer and withdraws with machine id", () => {
    const d = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ walletAddress: creatorAddress, selectedMachine: machine, machines: [machine], selectedMachineName: "Lucky Mint" })} dispatch={d} />);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    const withdraw = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Withdraw Revenue"));
    expect(withdraw).toBeTruthy();
    fireEvent.click(withdraw!);
    expect(d).toHaveBeenCalledWith("withdrawRevenue", "m1");
  });
  it("requires a connected wallet even when stale play credit is present", async () => {
    const d = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ hasPlayCredit:true, selectedMachine:machine, machines:[machine], selectedMachineName:"Lucky Mint" })} dispatch={d} />);
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(d).toHaveBeenCalledWith("connectWallet"));
    expect(d).not.toHaveBeenCalledWith("pull", "m1");
  });
  it("keeps a known incompatible deployment browse-only and explains the recovery condition", () => {
    const d = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ runtimeStatus:"incompatible", runtimeError:"Paid pulls paused", walletAddress:"Nabc", selectedMachine:machine, machines:[machine], selectedMachineName:"Lucky Mint" })} dispatch={d} />);
    const primary = container.querySelector<HTMLButtonElement>(".mx2-btn--primary");
    expect(primary?.textContent).toContain("Paid pulls paused");
    expect(primary?.disabled).toBe(true);
    expect(container.querySelector('.gasbox-scene[data-state="paused"]')).toBeTruthy();
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.querySelector(".gasbox-compatibility-card")).toBeTruthy();
    expect(container.textContent).toContain("Paid play is temporarily paused");
  });
  it("still exposes Reveal for an already committed pull on the incompatible deployment", async () => {
    const d = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ runtimeStatus:"incompatible", isAwaitingReveal:true, pendingBetId:"7", walletAddress:"Nabc" })} dispatch={d} />);
    const primary = container.querySelector<HTMLButtonElement>(".mx2-btn--primary");
    expect(primary?.disabled).toBe(false);
    fireEvent.click(primary!);
    await waitFor(() => expect(d).toHaveBeenCalledWith("reveal"));
  });
  it("shows exact wallet and credit recovery controls in the drawer", () => {
    const d = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ walletAddress:"Nabc", hasPlayCredit:true, formattedWalletGas:"2.50000001", formattedWalletNeo:"7", formattedPlayCredit:"0.25" })} dispatch={d} />);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.textContent).toContain("2.50000001");
    expect(container.textContent).toContain("7");
    const withdraw = Array.from(container.querySelectorAll("button")).find((button) => button.textContent?.includes("Return unused credit"));
    expect(withdraw).toBeTruthy();
    fireEvent.click(withdraw!);
    expect(d).toHaveBeenCalledWith("withdrawPlayCredit");
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
