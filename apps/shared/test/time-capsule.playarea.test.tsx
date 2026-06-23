import React from "react";
import fs from "node:fs";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../time-capsule/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string) {
  const messages: Record<string, string> = {
    title: "Time Capsule",
    subtitle: "Lock content until future date",
    sidebarTotalCapsules: "Total Capsules",
    sidebarLocked: "Locked",
    sidebarRevealed: "Revealed",
    createCapsule: "Create New Capsule",
    titleLabel: "Capsule Title",
    titlePlaceholder: "Give your capsule a name",
    secretMessage: "Secret Message",
    secretMessagePlaceholder: "Enter your secret message",
    unlockIn: "Lock Duration",
    daysPlaceholder: "30",
    categoryLabel: "Category",
    categoryPersonal: "Personal",
    categoryGift: "Gift",
    categoryMemorial: "Memorial",
    categoryAnnouncement: "Announcement",
    categorySecret: "Secret",
    categoryPersonalHint: "A note for your future self",
    categoryGiftHint: "A timed reveal for someone else",
    categoryMemorialHint: "Preserve a milestone or memory",
    categoryAnnouncementHint: "Publish when the date arrives",
    categorySecretHint: "Keep the tone private and sealed",
    visibility: "Visibility",
    decreaseLockDuration: "Decrease lock duration",
    increaseLockDuration: "Increase lock duration",
    private: "Private",
    public: "Public",
    publicHint: "Anyone can reveal after unlock",
    privateHint: "Only you can reveal after unlock",
    durationPresets: "Duration presets",
    daysShort: "D",
    contentStorageNote: "Your full message is stored locally on this device.",
    collectTips: "Collect tips",
    collectingTips: "Collecting tips...",
    collectTipsHint: "Collect public fishing tips.",
    fish: "Fish",
    fishSummary: "Discover public capsules",
    fishFactTip: "0.05 GAS tip",
    fishFactSealed: "Sealed until unlock",
    fishFactCharged: "Charged route",
    fishCandidatesTitle: "Public capsules",
    fishCandidatesRefresh: "Refresh candidates",
    fishCandidatesLoading: "Loading candidates...",
    fishCandidatesHint: "Pick a public capsule before tipping.",
    fishCandidatesEmpty: "No public capsules yet.",
    fishTipThis: "Fish this capsule",
    letterDockLabel: "Message sealing dock",
    letterDockKicker: "Letter loading",
    letterDockEmpty: "Write a title or message to load the capsule.",
    letterDockCount: "{count} characters ready to seal",
    capsuleBoardTitle: "Capsule seal board",
    capsuleBoardDraft: "Draft slot",
    capsuleBoardReadySeal: "Ready to seal",
    capsuleBoardLocked: "Unlock slot",
    createCapsuleButton: "Create Capsule (0.2 GAS)",
    creatingCapsule: "Sealing capsule...",
    fishButton: "Fish (0.05 GAS)",
    fishing: "Fishing...",
    fishDescription: "Try your luck to discover a public capsule.",
    yourCapsules: "Your Capsules",
    noCapsules: "No capsules yet. Create your first one!",
    noLocalCapsules: "No local capsules on this device yet.",
    locked: "Locked",
    unlocked: "Unlocked",
    revealed: "Revealed",
    unlocks: "Unlocks:",
    open: "Open Capsule",
    notUnlockedYet: "Not unlocked yet",
    prepaidCreditLabel: "Recoverable credit",
    prepaidCreditHint: "A previous deposit can be withdrawn.",
    withdrawCredit: "Withdraw credit",
    withdrawingCredit: "Withdrawing credit...",
  };
  return messages[key] ?? key;
}

function state(
  capsules: Array<Record<string, unknown>>,
  overrides: Record<string, unknown> = {},
): ObservableState {
  const values: Record<string, unknown> = {
    totalCapsules: capsules.length,
    lockedCount: capsules.filter((capsule) => capsule.locked).length,
    revealedCount: capsules.filter((capsule) => capsule.revealed).length,
    isCreating: false,
    isProcessing: false,
    isBusy: false,
    canCreate: true,
    capsules,
    newCapsule: {
      title: "",
      content: "",
      days: "30",
      isPublic: false,
      category: 1,
    },
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      createObservable(value),
    ]),
  );
}

describe("Time Capsule PlayArea", () => {
  it("keeps future second-based capsules locked instead of treating them as open", () => {
    const futureSeconds = Math.floor(Date.now() / 1000) + 86_400;

    render(
      <PlayArea
        t={t}
        state={state([
          {
            id: "7",
            title: "Tomorrow note",
            unlockTime: futureSeconds,
            locked: true,
            revealed: false,
          },
        ])}
        dispatch={vi.fn()}
      />,
    );

    expect(screen.getByText("Not unlocked yet")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open Capsule" })).toBeNull();
    expect(screen.getByText(/Unlocks:/).textContent).not.toContain("1970");
  });

  it("opens past second-based capsules from the capsule list", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const capsule = {
      id: "8",
      title: "Yesterday note",
      unlockTime: Math.floor(Date.now() / 1000) - 60,
      locked: true,
      revealed: false,
    };

    render(<PlayArea t={t} state={state([capsule])} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: "Open Capsule" }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("openCapsule", capsule);
    });
  });

  it("uses app-like category, visibility, and duration choices instead of native controls", () => {
    const { container } = render(
      <PlayArea t={t} state={state([])} dispatch={vi.fn()} />,
    );

    expect(container.querySelector("select")).toBeNull();
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    expect(screen.getByLabelText("Message sealing dock")).toBeTruthy();
    expect(container.querySelector(".capsule-letter-dock.is-ready")).toBeTruthy();
    expect(container.querySelector(".capsule-time-lock-dial.is-valid")).toBeTruthy();
    expect(container.querySelector(".capsule-duration-row .neo-input")).toBeNull();

    const gift = screen.getByRole("radio", { name: "Gift A timed reveal for someone else" });
    const publicVisibility = screen.getByRole("radio", { name: "Public Anyone can reveal after unlock" });
    const privateVisibility = screen.getByRole("radio", { name: "Private Only you can reveal after unlock" });

    expect(gift.getAttribute("aria-checked")).toBe("false");
    expect(privateVisibility.getAttribute("aria-checked")).toBe("true");

    fireEvent.click(gift);
    fireEvent.click(publicVisibility);
    fireEvent.click(screen.getByRole("button", { name: "365D" }));

    expect(gift.getAttribute("aria-checked")).toBe("true");
    expect(privateVisibility.getAttribute("aria-checked")).toBe("false");
    expect(publicVisibility.getAttribute("aria-checked")).toBe("true");
    expect((screen.getByRole("spinbutton", { name: "Lock Duration" }) as HTMLInputElement).value).toBe("365");

    fireEvent.click(screen.getByRole("button", { name: "Increase lock duration" }));
    expect((screen.getByRole("spinbutton", { name: "Lock Duration" }) as HTMLInputElement).value).toBe("366");

    fireEvent.click(screen.getByRole("button", { name: "Decrease lock duration" }));
    expect((screen.getByRole("spinbutton", { name: "Lock Duration" }) as HTMLInputElement).value).toBe("365");
  });

  it("surfaces ready and sealing motion states on the capsule workbench", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state([], {
          isCreating: true,
          isBusy: true,
          canCreate: true,
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".capsule-play-area.is-ready.is-sealing")).toBeTruthy();
    expect(container.querySelector(".capsule-seal-workbench.is-ready.is-sealing")).toBeTruthy();
    expect(container.querySelector(".capsule-letter-dock.is-ready.is-sealing")).toBeTruthy();
    expect(container.querySelector(".capsule-letter-dock__rail")).toBeTruthy();
    expect(container.querySelector(".capsule-letter-dock__seal")).toBeTruthy();
    expect(container.querySelector(".capsule-preview-panel.is-ready.is-sealing")).toBeTruthy();
    expect(container.querySelector(".capsule-game-board.is-ready.is-sealing")).toBeTruthy();
    expect(container.querySelector('.capsule-game-token img[src="./logo.jpg"]')).toBeTruthy();
    expect(container.querySelector(".capsule-game-slot--seal.is-active.is-sealing")).toBeTruthy();
    expect(container.querySelector(".capsule-game-slot--unlock.is-active")).toBeTruthy();
  });

  it("previews create sealing immediately and locks both create entry points", async () => {
    let finishCreate: (() => void) | undefined;
    const createPromise = new Promise<void>((resolve) => {
      finishCreate = resolve;
    });
    const dispatch = vi.fn((name: string) =>
      name === "createCapsule" ? createPromise : Promise.resolve(),
    );

    const { container } = render(
      <PlayArea t={t} state={state([])} dispatch={dispatch} />,
    );

    const createButtons = screen.getAllByRole("button", {
      name: "Create Capsule (0.2 GAS)",
    });
    fireEvent.click(createButtons[0]!);

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("createCapsule");
      expect(container.querySelector(".capsule-play-area")?.getAttribute("aria-busy")).toBe("true");
      expect(container.querySelector(".capsule-play-area.is-sealing")).toBeTruthy();
      expect(container.querySelector(".capsule-seal-workbench.is-sealing")?.getAttribute("aria-busy")).toBe("true");
      expect(container.querySelector(".capsule-letter-dock.is-sealing")).toBeTruthy();
      expect(container.querySelector(".capsule-preview-panel.is-sealing")?.getAttribute("aria-busy")).toBe("true");
      expect(container.querySelector(".capsule-game-board.is-sealing")).toBeTruthy();
    });

    expect(createButtons[0]?.getAttribute("aria-busy")).toBe("true");
    expect(createButtons[1]?.getAttribute("aria-busy")).toBe("true");
    fireEvent.click(createButtons[0]!);
    fireEvent.click(createButtons[1]!);
    expect(dispatch).toHaveBeenCalledTimes(1);
    finishCreate?.();
  });

  it("previews recovery, collect, candidate refresh, fish, and open actions locally", async () => {
    let finishWithdraw: (() => void) | undefined;
    const withdrawPromise = new Promise<void>((resolve) => {
      finishWithdraw = resolve;
    });
    const withdrawDispatch = vi.fn((name: string) =>
      name === "withdrawCredit" ? withdrawPromise : Promise.resolve(),
    );
    const withdrawView = render(
      <PlayArea
        t={t}
        state={state([], { hasCredit: true, reusableCredit: "0.2" })}
        dispatch={withdrawDispatch}
      />,
    );

    const withdrawButton = screen.getByRole("button", { name: "Withdraw credit" });
    fireEvent.click(withdrawButton);

    await waitFor(() => {
      expect(withdrawDispatch).toHaveBeenCalledWith("withdrawCredit");
      expect(withdrawView.container.querySelector(".capsule-play-area.is-recovering")).toBeTruthy();
      expect(withdrawView.container.querySelector(".capsule-recovery-card.is-recovering")).toBeTruthy();
    });
    expect(withdrawButton.getAttribute("aria-busy")).toBe("true");
    fireEvent.click(withdrawButton);
    expect(withdrawDispatch).toHaveBeenCalledTimes(1);
    finishWithdraw?.();
    withdrawView.unmount();

    let finishCollect: (() => void) | undefined;
    const collectPromise = new Promise<void>((resolve) => {
      finishCollect = resolve;
    });
    const collectDispatch = vi.fn((name: string) =>
      name === "withdrawFishRevenue" ? collectPromise : Promise.resolve(),
    );
    const collectView = render(
      <PlayArea t={t} state={state([])} dispatch={collectDispatch} />,
    );

    const collectButton = screen.getByRole("button", { name: "Collect tips" });
    fireEvent.click(collectButton);

    await waitFor(() => {
      expect(collectDispatch).toHaveBeenCalledWith("withdrawFishRevenue");
      expect(collectView.container.querySelector(".capsule-play-area.is-collecting")).toBeTruthy();
      expect(collectView.container.querySelector(".capsule-actions.is-collecting")).toBeTruthy();
      expect(collectView.container.querySelector(".capsule-collect-tips.is-collecting")).toBeTruthy();
    });
    expect(collectButton.getAttribute("aria-busy")).toBe("true");
    fireEvent.click(collectButton);
    expect(collectDispatch).toHaveBeenCalledTimes(1);
    finishCollect?.();
    collectView.unmount();

    let finishLoad: (() => void) | undefined;
    const loadPromise = new Promise<void>((resolve) => {
      finishLoad = resolve;
    });
    const loadDispatch = vi.fn((name: string) =>
      name === "loadFishCandidates" ? loadPromise : Promise.resolve(),
    );
    const loadView = render(
      <PlayArea t={t} state={state([])} dispatch={loadDispatch} />,
    );

    const refreshButton = screen.getByRole("button", { name: "Refresh candidates" });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(loadDispatch).toHaveBeenCalledWith("loadFishCandidates");
      expect(loadView.container.querySelector(".capsule-actions.is-loading-candidates")).toBeTruthy();
    });
    expect(refreshButton.textContent).toBe("Loading candidates...");
    fireEvent.click(refreshButton);
    expect(loadDispatch).toHaveBeenCalledTimes(1);
    finishLoad?.();
    loadView.unmount();

    let finishFish: (() => void) | undefined;
    const fishPromise = new Promise<void>((resolve) => {
      finishFish = resolve;
    });
    const fishDispatch = vi.fn((name: string) =>
      name === "fishCapsule" ? fishPromise : Promise.resolve(),
    );
    const fishView = render(
      <PlayArea
        t={t}
        state={state([], {
          fishCandidates: [{ id: "42", category: 2, unlockTime: Date.now() + 10_000 }],
        })}
        dispatch={fishDispatch}
      />,
    );

    const fishButton = screen.getByRole("button", { name: "Fish this capsule" });
    fireEvent.click(fishButton);

    await waitFor(() => {
      expect(fishDispatch).toHaveBeenCalledWith("fishCapsule", "42");
      expect(fishView.container.querySelector(".capsule-play-area.is-fishing")).toBeTruthy();
      expect(fishView.container.querySelector(".capsule-actions.is-fishing")).toBeTruthy();
      expect(fishView.container.querySelector(".capsule-fish-candidates__item.is-fishing")?.getAttribute("aria-busy")).toBe("true");
    });
    expect(fishButton.getAttribute("aria-busy")).toBe("true");
    fireEvent.click(fishButton);
    expect(fishDispatch).toHaveBeenCalledTimes(1);
    finishFish?.();
    fishView.unmount();

    let finishOpen: (() => void) | undefined;
    const openPromise = new Promise<void>((resolve) => {
      finishOpen = resolve;
    });
    const openDispatch = vi.fn((name: string) =>
      name === "openCapsule" ? openPromise : Promise.resolve(),
    );
    const readyCapsule = {
      id: "8",
      title: "Yesterday note",
      unlockTime: Math.floor(Date.now() / 1000) - 60,
      locked: true,
      revealed: false,
    };
    const openView = render(
      <PlayArea t={t} state={state([readyCapsule])} dispatch={openDispatch} />,
    );

    const openButton = screen.getByRole("button", { name: "Open Capsule" });
    fireEvent.click(openButton);

    await waitFor(() => {
      expect(openDispatch).toHaveBeenCalledWith("openCapsule", readyCapsule);
      expect(openView.container.querySelector(".capsule-play-area.is-opening")).toBeTruthy();
      expect(openView.container.querySelector(".capsule-item.is-opening")?.getAttribute("aria-busy")).toBe("true");
    });
    expect(openButton.getAttribute("aria-busy")).toBe("true");
    fireEvent.click(openButton);
    expect(openDispatch).toHaveBeenCalledTimes(1);
    finishOpen?.();
  });

  it("labels local capsules with visual state classes for locked, ready, and revealed states", () => {
    const now = Math.floor(Date.now() / 1000);
    const { container } = render(
      <PlayArea
        t={t}
        state={state([
          {
            id: "1",
            title: "Future note",
            unlockTime: now + 86_400,
            locked: true,
            revealed: false,
          },
          {
            id: "2",
            title: "Open note",
            unlockTime: now - 60,
            locked: true,
            revealed: false,
          },
          {
            id: "3",
            title: "Revealed note",
            content: "Visible",
            unlockTime: now - 120,
            locked: false,
            revealed: true,
          },
        ])}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".capsule-item.locked")).toBeTruthy();
    expect(container.querySelector(".capsule-item.ready")).toBeTruthy();
    expect(container.querySelector(".capsule-item.revealed")).toBeTruthy();
    expect(container.querySelector(".capsule-board-card--locked .capsule-item-state-icon--locked")).toBeTruthy();
    expect(container.querySelector(".capsule-board-card--ready .capsule-item-state-icon--ready")).toBeTruthy();
    expect(container.querySelector(".capsule-board-card--revealed .capsule-item-state-icon--revealed")).toBeTruthy();
  });

  it("keeps the create CTA active/loading colors separate from disabled styling", () => {
    const styles = fs.readFileSync(
      `${process.cwd()}/../time-capsule/src/PlayArea.scss`,
      "utf8",
    );

    expect(styles).toMatch(
      /\.neo-btn--primary:not\(:disabled\),\s*\.neo-btn--primary\.neo-btn--loading\s*\{[\s\S]*color:\s*#ffffff/,
    );
    expect(styles).toMatch(
      /\.neo-btn--primary:disabled:not\(\.neo-btn--loading\)/,
    );
  });

  it("keeps motion states accessible with reduced-motion fallbacks", () => {
    const playAreaStyles = fs.readFileSync(
      `${process.cwd()}/../time-capsule/src/PlayArea.scss`,
      "utf8",
    );
    const heroStyles = fs.readFileSync(
      `${process.cwd()}/../time-capsule/src/components/CapsuleHero.scss`,
      "utf8",
    );
    const listStyles = fs.readFileSync(
      `${process.cwd()}/../time-capsule/src/components/CapsuleList.scss`,
      "utf8",
    );

    expect(playAreaStyles).toContain("@keyframes capsule-preview-sweep");
    expect(playAreaStyles).toContain("@keyframes capsule-letter-glint");
    expect(playAreaStyles).toContain("@keyframes capsule-letter-load");
    expect(playAreaStyles).toContain("@keyframes capsule-letter-seal");
    expect(playAreaStyles).toContain("@keyframes capsule-time-lock-scan");
    expect(playAreaStyles).toContain("@keyframes capsule-time-lock-orbit");
    expect(playAreaStyles).toContain("@keyframes capsule-time-lock-glow");
    expect(playAreaStyles).toContain("@keyframes capsule-ready-card");
    expect(playAreaStyles).toContain("@keyframes capsule-game-route-flow");
    expect(playAreaStyles).toContain("@keyframes capsule-game-token-route");
    expect(playAreaStyles).toContain("@keyframes capsule-game-token-seal");
    expect(playAreaStyles).toContain("@keyframes capsule-game-slot-scan");
    expect(playAreaStyles).toContain("@keyframes capsule-game-seal-pulse");
    expect(playAreaStyles).toContain("@keyframes capsule-game-icon-ready");
    expect(playAreaStyles).toContain("@keyframes capsule-action-sweep");
    expect(playAreaStyles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(playAreaStyles).toContain(".capsule-letter-dock");
    expect(playAreaStyles).toContain(".capsule-time-lock-dial");
    expect(playAreaStyles).toContain(".capsule-game-token");
    expect(playAreaStyles).toContain(".capsule-game-slot--seal.is-sealing");
    expect(playAreaStyles).toContain(".capsule-game-slot");
    expect(playAreaStyles).toContain(".capsule-actions.is-fishing");
    expect(playAreaStyles).toContain(".capsule-collect-tips.is-collecting");
    expect(playAreaStyles).toContain(".capsule-recovery-card.is-recovering");
    expect(playAreaStyles).toContain(".capsule-item.is-opening");
    expect(heroStyles).toContain("@keyframes capsule-hero-drift");
    expect(heroStyles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(listStyles).toContain("@keyframes capsule-empty-badge");
  });
});
