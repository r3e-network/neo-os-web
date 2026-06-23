import React from "react";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../gasbox/src/PlayArea";
import type { Machine, MachineItem } from "../../gasbox/src/types";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    dismiss: "Dismiss",
    docDescription: "Review active GasBox machines and pull escrowed prizes.",
    docSubtitle: "On-chain blind boxes with escrowed prizes",
    feature2Name: "Verifiable RNG",
    gasboxCheckNeedsAction: "Needs action",
    gasboxCheckPassed: "Passed",
    gasboxChecklistActive: "Machine active",
    gasboxChecklistInventory: "Prize inventory",
    gasboxChecklistOdds: "Odds readable",
    gasboxDecisionSubtitle:
      "Check cost, inventory, and odds before the wallet confirmation.",
    gasboxDecisionTitle: "Pull decision",
    gasboxEscrowSafetyDesc:
      "Prizes are escrowed before activation, odds remain inspectable, and pulls require the selected machine to be active.",
    gasboxEscrowSafetyTitle: "Escrow and odds safety",
    gasboxHeroCopy:
      "GasBox keeps the fun path simple: compare funded machines, confirm the GAS pull in your wallet, then reveal a prize paid from escrow.",
    gasboxHeroEscrow: "Escrowed prizes",
    gasboxHeroPrize: "Paid on-chain",
    gasboxHeroProofs: "Game safety signals",
    gasboxHeroReveal: "Next-block reveal",
    gasboxHeroTitle: "Pick a capsule machine, pull on-chain, reveal the prize.",
    gasboxIntentEscrow: "Escrow checked",
    gasboxIntentReveal: "Reveal next",
    gasboxInventoryActionRequired:
      "Inventory needs funding before players can pull.",
    gasboxInventoryReady: "Escrow funded and available for draws.",
    gasboxLiveStatus: "Live market status",
    gasboxMachineLive: "Live",
    gasboxMachineNeedsFunding: "Needs funding",
    gasboxNoAvailablePrize: "No available prize",
    gasboxOddsCoverage: "Readable odds",
    gasboxPending: "Sync pending",
    gasboxPlayerRoute: "Player route",
    gasboxPullIntent: "Pull confirmation details",
    gasboxPrizeFocus: "Prize focus",
    gasboxPrizeFocusOdds: "Drop chance",
    gasboxReelEmpty: "No escrow-ready prizes are available for this machine.",
    gasboxReelHint: "Ready to spin",
    gasboxReelTitle: "Prize reel",
    gasboxCommitted: "Bet placed - revealing on the next block...",
    gasboxPendingDesc:
      "The bet is committed. Reveal when the next block can settle the prize.",
    gasboxPendingTitle: "Draw in progress",
    gasboxRevealAction: "Reveal result",
    gasboxRevealHint: "Retry safely if the reveal block is not ready yet.",
    gasboxRevealing: "Revealing your prize...",
    gasboxPullBlockedInactive:
      "This machine is inactive. Choose an active machine or open Studio to update it.",
    gasboxPullBlockedInventory:
      "Prize inventory is not escrow-ready. Refresh the market or fund prizes in Studio.",
    gasboxPullBlockedTitle: "Pull unavailable",
    gasboxPullChecklist: "Pull checklist",
    gasboxPullReadyCopy:
      "The machine is active, inventory is escrowed, and the pull can proceed through the wallet flow.",
    gasboxPullReadyTitle: "Ready for pull",
    gasboxSelectedActions: "Selected machine operations",
    gasboxUnavailableInventory: `${params?.count ?? 0} prize entries are currently unavailable and excluded from the pull odds.`,
    gasboxWalletIntent:
      "The wallet confirms the GAS pull and records the selected machine.",
    inactive: "Inactive",
    inventoryAndOdds: "Inventory & Odds",
    inventoryEmpty: "Inventory empty - deposit prizes to activate",
    items: "items",
    loadingMachines: "Loading machines...",
    machines: "Machines",
    market: "Market",
    openStudio: "Open Studio",
    plays: "plays",
    pull: "Pull",
    pullCost: "Pull Cost",
    pulling: "Pulling...",
    rarityDistribution: "Drop Rates",
    readyToPlay: "Ready to Play",
    refreshMachines: "Refresh Machines",
    revenue: "Revenue",
    selectMachine: "Select a Machine",
    selectMachinePrompt:
      "Select a machine from the market to review odds and play cost.",
    statusActive: "Active",
    step1: "Connect your wallet and browse machines.",
    step2: "Review odds and prize inventory before spinning.",
    step3: "Pay GAS to spin on-chain.",
    step4: "Receive the prize automatically after RNG resolves.",
    title: "GasBox",
    topPrizeLabel: "Top Prize",
    totalItems: "Items",
    totalPlays: "Plays",
    totalPulls: "Total Pulls",
    estPlays: "Est. Plays",
    estPlaysHint: "Estimated from accrued revenue ÷ price.",
    yourPulls: "Your Pulls",
    withdrawRevenue: "Withdraw Revenue",
    gasboxCreatorEarningsTitle: "Creator earnings",
    gasboxRevenueAvailable:
      "Accrued play revenue is available to withdraw to your wallet.",
    gasboxRevenueNone: "No withdrawable revenue yet.",
    gasboxTopUpLabel: `Top up amount (${params?.asset ?? "GAS"})`,
    gasboxTopUpPlaceholder: "Amount",
    gasboxTopUpAction: "Top up pool",
    gasboxStudioPrizeCount: `${params?.count ?? 0} prize rows`,
    gasboxStudioSafety: "Funds largest prize",
    gasboxStudioSummary: "Studio setup summary",
    studioAmountUnset: "Set prize",
    derivedTierLabel: "Tier",
    derivedTierExplain:
      "Rarity tiers are derived from each item's weight share.",
    studioFlowLabel: "Studio build route",
    studioFlowMachine: "Shape cabinet",
    studioFlowMachineHint: "Name and price",
    studioFlowPrizes: "Load capsules",
    studioFlowPrizesHint: "Weights become odds",
    studioFlowPublish: "Publish on-chain",
    studioFlowPublishHint: "Fund and activate",
    studioLaunchPadLabel: "Launch pad",
    studioLaunchReadyTitle: "Machine ready for wallet publish",
    studioLaunchDraftTitle: "Finish loading the cabinet",
    studioLaunchNeedsMachine:
      "Name the machine first so players know what they are pulling.",
    studioLaunchNeedsPrize:
      "Add at least one named prize capsule with weight before publishing.",
    studioLaunchReadyCopy:
      "The cabinet has a name and a prize capsule. Review the odds, then publish on-chain.",
    studioOddsRailTitle: "Capsule odds rail",
    studioOddsRailHint:
      "Preview what players will see before the wallet confirmation.",
    studioConveyorLabel: "Capsule conveyor",
    studioConveyorHint:
      "Capsules move from setup into the machine inventory as weights change.",
    rarityCommon: "COMMON",
    rarityRare: "RARE",
    rarityEpic: "EPIC",
    rarityLegendary: "LEGENDARY",
    weightLabel: "Weight",
    createMachineAction: "Create Machine",
    studioCloseAction: "Close Studio",
    itemNamePlaceholder: "Item Name",
    machineNameLabel: "Machine Name",
    machineNamePlaceholder: "e.g. Cyber Dragon Box",
    pricePerPlayLabel: "Price per Play (GAS)",
    pricePlaceholder: "1.0",
    backToMarket: "Back to Market",
    prizeAssetLabel: "Prize Asset",
    prizeAssetGasHint: "Decimal payouts for flexible prize amounts",
    prizeAssetNeoHint: "Whole-token prizes for simple fixed rewards",
    prizePerWinLabel: "Prize per win",
    addItem: "Add Item",
    congratulations: "Congratulations!",
    gasboxOnChainPrizeNote:
      "The prize was drawn from a later block's randomness and paid to your wallet in the reveal transaction.",
  };
  return messages[key] ?? key;
}

function item(overrides: Partial<MachineItem> = {}): MachineItem {
  return {
    name: "Legend Capsule",
    probability: 10,
    displayProbability: 10,
    rarity: "legendary",
    assetType: 1,
    assetHash: "0x1111111111111111111111111111111111111111",
    amountRaw: 1,
    amountDisplay: "1",
    tokenId: "",
    stockRaw: 4,
    stockDisplay: "4",
    tokenCount: 4,
    decimals: 0,
    available: true,
    ...overrides,
  };
}

function machine(overrides: Partial<Machine> = {}): Machine {
  return {
    id: "gasbox-alpha",
    name: "Aurora Capsule",
    description: "Escrowed art and GAS rewards.",
    category: "Art",
    tags: "aurora, rewards",
    tagsList: ["aurora", "rewards"],
    creator: "Creator",
    creatorHash: "NCreator1111111111111111111111111111",
    owner: "Owner",
    ownerHash: "NOwner11111111111111111111111111111",
    price: "0.50",
    priceRaw: 50_000_000,
    itemCount: 3,
    totalWeight: 100,
    availableWeight: 100,
    plays: 42,
    revenue: "21.00",
    revenueRaw: 2_100_000_000,
    sales: 0,
    salesVolume: "0",
    salesVolumeRaw: 0,
    createdAt: 0,
    lastPlayedAt: 0,
    active: true,
    listed: true,
    banned: false,
    locked: false,
    forSale: false,
    salePrice: "0",
    salePriceRaw: 0,
    inventoryReady: true,
    items: [
      item({
        name: "Legend Capsule",
        displayProbability: 5,
        rarity: "legendary",
      }),
      item({ name: "GAS Rebate", displayProbability: 95, rarity: "common" }),
      item({ name: "Sold Out Badge", displayProbability: 0, available: false }),
    ],
    topPrize: "Legend Capsule",
    winRate: 100,
    // On-chain economics (MiniAppGasBox): every item pays a single prize asset
    // out of an on-chain pool that must cover the largest prize before activation.
    prizeAsset: "GAS",
    poolBalance: "21.00",
    poolBalanceRaw: 2_100_000_000,
    maxPrize: "1.00",
    maxPrizeRaw: 100_000_000,
    poolReady: true,
    ...overrides,
  };
}

function state(
  overrides: Partial<Record<string, unknown>> = {},
): ObservableState {
  const selectedMachine = machine();
  const values = {
    isCreating: false,
    isLoading: false,
    isPlayingDisplay: false,
    isPulling: false,
    machineCount: 1,
    machines: [selectedMachine],
    pullResult: null,
    selectedMachine,
    selectedMachineName: selectedMachine.name,
    showResult: false,
    totalPulls: 42,
    userPulls: 3,
    walletAddress: "",
    ...overrides,
  };

  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      createObservable(value),
    ]),
  );
}

describe("GasBox PlayArea", () => {
  it("shows a complete pull decision panel and dispatches real page actions", async () => {
    const dispatch = vi.fn(async () => undefined);
    const selectedMachine = machine();

    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          machines: [selectedMachine],
          selectedMachine,
          selectedMachineName: selectedMachine.name,
        })}
        dispatch={dispatch}
      />,
    );

    expect(screen.getByText("Pull decision")).toBeTruthy();
    expect(container.querySelector(".gasbox-control-deck")).not.toBeNull();
    expect(
      container.querySelector(".gasbox-cabinet-lever.is-ready"),
    ).not.toBeNull();
    expect(container.querySelector(".gasbox-prize-reel--ready")).not.toBeNull();
    expect(
      container.querySelector(
        '.gasbox-stage-art img[src="gasbox-capsule-machine.png"]',
      ),
    ).not.toBeNull();
    expect(screen.getByText("Prize reel")).toBeTruthy();
    expect(screen.getByText("Ready to spin")).toBeTruthy();
    expect(
      screen.getByText(
        "Pick a capsule machine, pull on-chain, reveal the prize.",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Escrow checked")).toBeTruthy();
    expect(screen.getByText("Next-block reveal")).toBeTruthy();
    expect(screen.getByText("Ready for pull")).toBeTruthy();
    expect(
      screen.getByText("Escrow funded and available for draws."),
    ).toBeTruthy();
    expect(screen.getAllByText("5%").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText(/1 prize entries are currently unavailable/),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Refresh Machines" }));
    fireEvent.click(screen.getByRole("button", { name: "Open Studio" }));
    fireEvent.click(screen.getByRole("button", { name: /Pull/ }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("refreshMachines");
      expect(dispatch).toHaveBeenCalledWith("openStudio");
      expect(dispatch).toHaveBeenCalledWith("pull", "gasbox-alpha");
    });
  });

  it("previews the pull motion immediately and locks repeat clicks", async () => {
    let finishPull: (() => void) | undefined;
    const pullPromise = new Promise<void>((resolve) => {
      finishPull = resolve;
    });
    const dispatch = vi.fn((name: string) =>
      name === "pull" ? pullPromise : Promise.resolve(),
    );
    const selectedMachine = machine();

    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          machines: [selectedMachine],
          selectedMachine,
          selectedMachineName: selectedMachine.name,
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Pull/ }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("pull", "gasbox-alpha");
      expect(
        container.querySelector(".gasbox-stage-art--pulling"),
      ).not.toBeNull();
      expect(
        container.querySelector(".gasbox-prize-reel--active"),
      ).not.toBeNull();
      expect(
        container.querySelector(".gasbox-control-deck--active"),
      ).not.toBeNull();
      expect(
        container.querySelector(".gasbox-cabinet-lever.is-active"),
      ).not.toBeNull();
      expect(
        container.querySelectorAll(".gasbox-stage-art__capsule").length,
      ).toBe(3);
      expect(
        container
          .querySelector(".gasbox-pull-stage")
          ?.getAttribute("aria-busy"),
      ).toBe("true");
      expect(
        container
          .querySelector(".gasbox-prize-reel")
          ?.getAttribute("aria-busy"),
      ).toBe("true");
      expect(
        container
          .querySelector(".gasbox-control-deck")
          ?.getAttribute("aria-busy"),
      ).toBe("true");
      expect(screen.getByText("Pulling...")).toBeTruthy();
    });

    const busyButton = screen.getByRole("button", {
      name: "Pulling...",
    }) as HTMLButtonElement;
    expect(busyButton.disabled).toBe(true);
    expect(busyButton.getAttribute("aria-busy")).toBe("true");

    fireEvent.click(busyButton);
    expect(dispatch).toHaveBeenCalledTimes(1);

    finishPull?.();
  });

  it("previews reveal motion immediately and locks repeat clicks", async () => {
    let finishReveal: (() => void) | undefined;
    const revealPromise = new Promise<void>((resolve) => {
      finishReveal = resolve;
    });
    const dispatch = vi.fn((name: string) =>
      name === "reveal" ? revealPromise : Promise.resolve(),
    );
    const selectedMachine = machine();

    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          betPhase: "committed",
          canReveal: true,
          isAwaitingReveal: true,
          machines: [selectedMachine],
          selectedMachine,
          selectedMachineName: selectedMachine.name,
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Reveal result" }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("reveal");
      expect(
        container.querySelector(".gasbox-pending--revealing"),
      ).not.toBeNull();
      expect(
        container.querySelector(".gasbox-prize-reel--active"),
      ).not.toBeNull();
      expect(
        container.querySelector(".gasbox-control-deck--active"),
      ).not.toBeNull();
      expect(
        container.querySelector(".gasbox-cabinet-lever.is-active"),
      ).not.toBeNull();
      expect(
        screen
          .getByRole("button", { name: "Revealing your prize..." })
          .getAttribute("aria-busy"),
      ).toBe("true");
    });

    const busyButton = screen.getByRole("button", {
      name: "Revealing your prize...",
    }) as HTMLButtonElement;
    expect(busyButton.disabled).toBe(true);
    fireEvent.click(busyButton);
    expect(dispatch).toHaveBeenCalledTimes(1);

    finishReveal?.();
  });

  it("blocks pulls when the selected machine is inactive or inventory is missing", () => {
    const blockedMachine = machine({
      active: false,
      inventoryReady: false,
      items: [item({ available: false, displayProbability: 0 })],
    });

    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          machineCount: 1,
          machines: [blockedMachine],
          selectedMachine: blockedMachine,
          selectedMachineName: blockedMachine.name,
        })}
        dispatch={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByText("Pull unavailable")).toBeTruthy();
    expect(
      container.querySelector(".gasbox-cabinet-lever.is-locked"),
    ).not.toBeNull();
    expect(
      screen.getByText(
        "This machine is inactive. Choose an active machine or open Studio to update it.",
      ),
    ).toBeTruthy();
    expect(screen.getAllByText("Needs action").length).toBeGreaterThanOrEqual(
      2,
    );
    expect(
      (screen.getByRole("button", { name: /Pull/ }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("hides the creator Withdraw Revenue control from non-creators", () => {
    const selectedMachine = machine({
      revenueRaw: 2_100_000_000,
      revenue: "21.00",
    });

    render(
      <PlayArea
        t={t}
        state={state({
          machines: [selectedMachine],
          selectedMachine,
          selectedMachineName: selectedMachine.name,
          // A wallet that does not own the machine.
          walletAddress: "NSomeoneElse111111111111111111111111",
        })}
        dispatch={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.queryByText("Creator earnings")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Withdraw Revenue" }),
    ).toBeNull();
  });

  it("shows the creator Withdraw Revenue control and dispatches withdrawRevenue with the machine id", async () => {
    const dispatch = vi.fn(async () => undefined);
    const selectedMachine = machine({
      revenueRaw: 2_100_000_000,
      revenue: "21.00",
    });

    render(
      <PlayArea
        t={t}
        state={state({
          machines: [selectedMachine],
          selectedMachine,
          selectedMachineName: selectedMachine.name,
          // The connected wallet matches the machine's creatorHash.
          walletAddress: selectedMachine.creatorHash,
        })}
        dispatch={dispatch}
      />,
    );

    expect(screen.getByText("Creator earnings")).toBeTruthy();
    expect(screen.getByText("21.00 GAS")).toBeTruthy();
    const withdraw = screen.getByRole("button", {
      name: "Withdraw Revenue",
    }) as HTMLButtonElement;
    expect(withdraw.disabled).toBe(false);

    fireEvent.click(withdraw);
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("withdrawRevenue", "gasbox-alpha");
    });
  });

  it("disables Withdraw Revenue for the creator when there is no accrued revenue", () => {
    const selectedMachine = machine({ revenueRaw: 0, revenue: "0.00" });

    render(
      <PlayArea
        t={t}
        state={state({
          machines: [selectedMachine],
          selectedMachine,
          selectedMachineName: selectedMachine.name,
          walletAddress: selectedMachine.creatorHash,
        })}
        dispatch={vi.fn(async () => undefined)}
      />,
    );

    // The panel is shown to the creator, but the action is disabled with no revenue.
    expect(screen.getByText("Creator earnings")).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Withdraw Revenue",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("validates creator pool top-ups with asset-aware base-unit parsing before dispatch", async () => {
    const dispatch = vi.fn(async () => undefined);
    const selectedMachine = machine();

    render(
      <PlayArea
        t={t}
        state={state({
          machines: [selectedMachine],
          selectedMachine,
          selectedMachineName: selectedMachine.name,
          walletAddress: selectedMachine.creatorHash,
        })}
        dispatch={dispatch}
      />,
    );

    const topUp = screen.getByPlaceholderText("Amount") as HTMLInputElement;
    const submit = screen.getByRole("button", {
      name: "Top up pool",
    }) as HTMLButtonElement;
    expect(topUp.type).toBe("text");
    expect(submit.disabled).toBe(true);

    fireEvent.change(topUp, { target: { value: "1e2" } });
    expect(submit.disabled).toBe(true);
    fireEvent.click(submit);
    expect(dispatch).not.toHaveBeenCalledWith(
      "topUpPool",
      expect.anything(),
      expect.anything(),
    );

    fireEvent.change(topUp, { target: { value: "0.000000001" } });
    expect(submit.disabled).toBe(true);

    fireEvent.change(topUp, { target: { value: "0.00000001" } });
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        "topUpPool",
        "gasbox-alpha",
        "0.00000001",
      );
    });
  });

  it("blocks fractional NEO creator pool top-ups before dispatch", () => {
    const dispatch = vi.fn(async () => undefined);
    const selectedMachine = machine({ prizeAsset: "NEO" });

    render(
      <PlayArea
        t={t}
        state={state({
          machines: [selectedMachine],
          selectedMachine,
          selectedMachineName: selectedMachine.name,
          walletAddress: selectedMachine.creatorHash,
        })}
        dispatch={dispatch}
      />,
    );

    const topUp = screen.getByPlaceholderText("Amount") as HTMLInputElement;
    const submit = screen.getByRole("button", {
      name: "Top up pool",
    }) as HTMLButtonElement;

    fireEvent.change(topUp, { target: { value: "1.5" } });
    expect(submit.disabled).toBe(true);
    fireEvent.click(submit);
    expect(dispatch).not.toHaveBeenCalled();

    fireEvent.change(topUp, { target: { value: "2" } });
    expect(submit.disabled).toBe(false);
  });

  it("replaces the dead Studio rarity selector with a weight-derived tier preview", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ studioOpen: true })}
        dispatch={vi.fn(async () => undefined)}
      />,
    );

    // Studio now uses app-native picker cards instead of browser-native selects.
    expect(container.querySelector("select")).toBeNull();
    // Machine setup is presented as a cabinet blueprint instead of a flat form.
    expect(container.querySelector(".gasbox-studio-cabinet")).not.toBeNull();
    expect(container.querySelectorAll(".gasbox-cabinet-card").length).toBe(2);
    expect(container.querySelector(".gasbox-studio-flow")).not.toBeNull();
    expect(
      container.querySelector(".gasbox-studio-machine-preview__lights"),
    ).not.toBeNull();
    expect(container.querySelector(".gasbox-studio-odds-rail")).not.toBeNull();
    expect(container.querySelectorAll(".gasbox-studio-odds-token").length).toBe(
      1,
    );
    expect(container.querySelector(".gasbox-studio-conveyor")).not.toBeNull();
    expect(
      container.querySelector(".gasbox-studio-conveyor__belt"),
    ).not.toBeNull();
    expect(
      container.querySelector(
        '.gasbox-studio-conveyor__orb img[src="gasbox-prize-capsule.png"]',
      ),
    ).not.toBeNull();
    expect(container.querySelector(".gasbox-studio-launch-pad")).not.toBeNull();
    expect(
      container.querySelector(".gasbox-studio-launch-pad.is-ready"),
    ).toBeNull();
    expect(screen.getByText("Finish loading the cabinet")).toBeTruthy();
    expect(
      screen.getByText(
        "Name the machine first so players know what they are pulling.",
      ),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Create Machine",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(container.querySelector(".gasbox-capsule-editor")).not.toBeNull();
    expect(
      container.querySelector(".gasbox-studio-item__asset"),
    ).not.toBeNull();
    expect(
      container.querySelector(
        '.gasbox-studio-item__asset img[src="gasbox-prize-capsule.png"]',
      ),
    ).not.toBeNull();
    expect(
      container.querySelector(
        '.gasbox-studio-machine-preview img[src="gasbox-capsule-machine.png"]',
      ),
    ).not.toBeNull();
    expect(
      container.querySelector(
        '.gasbox-studio-launch-pad__machine img[src="gasbox-capsule-machine.png"]',
      ),
    ).not.toBeNull();
    expect(container.querySelector(".gasbox-dial-control")).not.toBeNull();
    expect(
      container.querySelectorAll(".gasbox-capsule-preset-row").length,
    ).toBe(2);
    // A read-only weight-derived tier preview is shown instead.
    expect(container.querySelector(".gasbox-derived-tier")).not.toBeNull();
    expect(screen.getByText("Capsule odds rail")).toBeTruthy();
    expect(screen.getByText("Capsule conveyor")).toBeTruthy();
    expect(screen.getAllByText("Shape cabinet").length).toBeGreaterThanOrEqual(
      1,
    );
    expect(screen.getByText("Tier")).toBeTruthy();
  });

  it("locks Studio publish until the cabinet and capsule are loaded, then preserves the publish payload", async () => {
    const dispatch = vi.fn(async (name: string) => name === "publishMachine");

    const { container } = render(
      <PlayArea
        t={t}
        state={state({ studioOpen: true })}
        dispatch={dispatch}
      />,
    );

    const publish = screen.getByRole("button", {
      name: "Create Machine",
    }) as HTMLButtonElement;
    expect(publish.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Machine Name"), {
      target: { value: "Sunrise Capsule" },
    });
    expect(publish.disabled).toBe(true);
    expect(
      screen.getByText(
        "Add at least one named prize capsule with weight before publishing.",
      ),
    ).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Item Name"), {
      target: { value: "Golden Ticket" },
    });

    expect(
      container.querySelector(".gasbox-studio-launch-pad.is-ready"),
    ).not.toBeNull();
    expect(
      container.querySelector(".gasbox-studio-conveyor.is-ready"),
    ).not.toBeNull();
    expect(screen.getByText("Machine ready for wallet publish")).toBeTruthy();
    expect(publish.disabled).toBe(false);

    fireEvent.click(publish);

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("publishMachine", {
        name: "Sunrise Capsule",
        price: "0",
        prizeAsset: "GAS",
        items: [
          {
            name: "Golden Ticket",
            weight: "50",
            amount: "0.1",
          },
        ],
      });
    });
  });

  it("lets creators choose the prize asset with card radios and updates prize units", () => {
    render(
      <PlayArea
        t={t}
        state={state({ studioOpen: true })}
        dispatch={vi.fn(async () => undefined)}
      />,
    );

    const gas = screen.getByRole("radio", {
      name: "GAS Decimal payouts for flexible prize amounts",
    });
    const neo = screen.getByRole("radio", {
      name: "NEO Whole-token prizes for simple fixed rewards",
    });
    expect(gas.getAttribute("aria-checked")).toBe("true");
    expect(neo.getAttribute("aria-checked")).toBe("false");
    expect(screen.getByText("Prize per win (GAS)")).toBeTruthy();

    fireEvent.click(neo);

    expect(gas.getAttribute("aria-checked")).toBe("false");
    expect(neo.getAttribute("aria-checked")).toBe("true");
    expect(screen.getByText("Prize per win (NEO)")).toBeTruthy();
  });

  it("shows active machine-control motion affordances while a pull is in flight", () => {
    const selectedMachine = machine();
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          isPulling: true,
          machines: [selectedMachine],
          selectedMachine,
          selectedMachineName: selectedMachine.name,
        })}
        dispatch={vi.fn(async () => undefined)}
      />,
    );

    expect(
      container.querySelector(".gasbox-control-deck--active"),
    ).not.toBeNull();
    expect(
      container.querySelector(".gasbox-cabinet-lever.is-active"),
    ).not.toBeNull();
    expect(container.querySelector(".gasbox-pull-btn--active")).not.toBeNull();
    expect(
      container.querySelector(".gasbox-prize-reel--active"),
    ).not.toBeNull();
    expect(container.querySelector(".gasbox-reel-strip")).not.toBeNull();
    expect(
      container.querySelector(".gasbox-stage-art__slot.is-active"),
    ).not.toBeNull();
  });

  it("celebrates a revealed prize with a real cabinet theater and rarity capsule", async () => {
    const dispatch = vi.fn(async () => undefined);
    const selectedMachine = machine();

    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          machines: [selectedMachine],
          selectedMachine,
          selectedMachineName: selectedMachine.name,
          pullResult: {
            item: "Legend Capsule",
            name: "Legend Capsule",
            rarity: "legendary",
            amountDisplay: "1 GAS",
          },
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Pull/ }));

    await waitFor(() => {
      expect(container.querySelector(".gasbox-result-theater")).not.toBeNull();
    });

    expect(
      container.querySelector(
        '.gasbox-result-theater__machine img[src="gasbox-capsule-machine.png"]',
      ),
    ).not.toBeNull();
    expect(
      container.querySelector(
        '.gasbox-result-theater__capsule img[src="gasbox-prize-capsule.png"]',
      ),
    ).not.toBeNull();
    expect(
      container.querySelector(
        ".gasbox-result-theater__capsule.gasbox-rarity--legendary",
      ),
    ).not.toBeNull();
    expect(
      container.querySelector(".gasbox-result-theater__beam"),
    ).not.toBeNull();
    expect(container.querySelectorAll(".gasbox-confetti__bit").length).toBe(14);
    expect(screen.getByText("Congratulations!")).toBeTruthy();
  });

  it("keeps game motion explicit and disabled for reduced-motion users", () => {
    const repoPath = resolve(process.cwd(), "apps/gasbox/src/PlayArea.scss");
    const sharedPath = resolve(process.cwd(), "../gasbox/src/PlayArea.scss");
    const css = readFileSync(
      existsSync(repoPath) ? repoPath : sharedPath,
      "utf8",
    );
    const repoAssetDir = resolve(process.cwd(), "apps/gasbox/public");
    const sharedAssetDir = resolve(process.cwd(), "../gasbox/public");
    const assetDir = existsSync(repoAssetDir) ? repoAssetDir : sharedAssetDir;

    expect(existsSync(resolve(assetDir, "gasbox-capsule-machine.png"))).toBe(
      true,
    );
    expect(existsSync(resolve(assetDir, "gasbox-prize-capsule.png"))).toBe(
      true,
    );
    expect(css).toContain("@keyframes gasbox-machine-idle");
    expect(css).toContain("@keyframes gasbox-capsule-ready");
    expect(css).toContain("@keyframes gasbox-result-capsule-open");
    expect(css).toContain("@keyframes gasbox-pending-reveal-sweep");
    expect(css).toContain("@keyframes gasbox-pending-reveal-pop");
    expect(css).toContain("@keyframes gasbox-studio-machine-breathe");
    expect(css).toContain("@keyframes gasbox-studio-token-glow");
    expect(css).toContain("@keyframes gasbox-studio-capsule-roll");
    expect(css).toContain("@keyframes gasbox-studio-belt-flow");
    expect(css).toContain("@keyframes gasbox-studio-conveyor-bob");
    expect(css).toContain("@keyframes gasbox-studio-conveyor-ready");
    expect(css).toContain("@keyframes gasbox-studio-item-scan");
    expect(css).toContain("@keyframes gasbox-studio-launch-ready");
    expect(css).toContain(".gasbox-studio-launch-pad");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(".gasbox-result-theater__capsule");
    expect(css).toContain("&--revealing");
    expect(css).toContain(".gasbox-studio-odds-token__capsule");
    expect(css).toContain(".gasbox-studio-conveyor__belt");
    expect(css).toContain(".gasbox-studio-conveyor__capsule");
    expect(css).toContain(".gasbox-studio-item__asset");
    expect(css).toContain(".gasbox-dial-control");
    expect(css).toContain("animation: none");
  });
});
