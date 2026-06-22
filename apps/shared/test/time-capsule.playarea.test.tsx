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
    private: "Private",
    public: "Public",
    publicHint: "Anyone can reveal after unlock",
    privateHint: "Only you can reveal after unlock",
    durationPresets: "Duration presets",
    daysShort: "D",
    contentStorageNote: "Your full message is stored locally on this device.",
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
    expect(container.querySelector(".capsule-preview-panel.is-ready.is-sealing")).toBeTruthy();
    expect(container.querySelector(".capsule-game-board.is-ready.is-sealing")).toBeTruthy();
    expect(container.querySelector(".capsule-game-slot--seal.is-active.is-sealing")).toBeTruthy();
    expect(container.querySelector(".capsule-game-slot--unlock.is-active")).toBeTruthy();
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
    expect(playAreaStyles).toContain("@keyframes capsule-ready-card");
    expect(playAreaStyles).toContain("@keyframes capsule-game-route-flow");
    expect(playAreaStyles).toContain("@keyframes capsule-game-slot-scan");
    expect(playAreaStyles).toContain("@keyframes capsule-game-seal-pulse");
    expect(playAreaStyles).toContain("@keyframes capsule-game-icon-ready");
    expect(playAreaStyles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(playAreaStyles).toContain(".capsule-game-slot--seal.is-sealing");
    expect(playAreaStyles).toContain(".capsule-game-slot");
    expect(heroStyles).toContain("@keyframes capsule-hero-drift");
    expect(heroStyles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(listStyles).toContain("@keyframes capsule-empty-badge");
  });
});
