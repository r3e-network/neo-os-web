import React from "react";
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
    visibility: "Visibility",
    publicHint: "Anyone can reveal after unlock",
    privateHint: "Only you can reveal after unlock",
    contentStorageNote: "Your full message is stored locally on this device.",
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

function state(capsules: Array<Record<string, unknown>>): ObservableState {
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
});
