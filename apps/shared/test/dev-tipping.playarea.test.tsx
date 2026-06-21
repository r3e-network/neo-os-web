import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../dev-tipping/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string) {
  const messages: Record<string, string> = {
    title: "Dev Tipping",
    docSubtitle: "Support developers with direct GAS tips",
    developers: "Developers",
    totalDonated: "Total Donated",
    recentTips: "Recent Tips",
    topDevelopers: "Top Developers",
    noDevelopers: "No developers yet",
    noDevelopersHint: "Enter a registered developer ID to send a tip.",
    howItWorks: "How it works",
    step1: "Connect your Neo wallet",
    step2: "Find a developer or project to support",
    step3: "Enter tip amount and optional message",
    step4: "Confirm transaction - tips go directly to developer",
    sendTip: "Send Tip",
    developerId: "Developer ID",
    developerIdPlaceholder: "Registered developer ID",
    directTipRoute: "Direct contract tip",
    tipAmount: "Tip Amount",
    customAmount: "Custom amount...",
    quickTipLabel: "Quick tip",
    tipPresetLabel: "Tip amount presets",
    tipPreviewTitle: "Tip preview",
    tipRecipientPending: "Choose a developer",
    tipAmountPending: "Choose amount",
    tokenGas: "GAS",
    minTip: "Minimum tip is 0.001 GAS",
    optionalMessage: "Optional Message",
    messagePlaceholder: "Say thanks...",
    tipperName: "Your Name (optional)",
    tipperNamePlaceholder: "Anonymous",
    anonymousOn: "Anonymous",
    anonymousOff: "Show Name",
    sending: "Sending...",
    sendTipBtn: "Send Tip",
  };
  return messages[key] ?? key;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    developers: [],
    recentTips: [],
    totalDonated: 0,
    isLoading: false,
    address: "",
    developerCount: 0,
    totalDonatedDisplay: "0",
    recentTipCount: 0,
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      createObservable(value),
    ]),
  );
}

describe("Dev Tipping PlayArea", () => {
  it("lets users enter a developer id when the developer list is empty", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    // With an empty registry the form exposes a manual developer-id field plus
    // the tip amount. The free-text message and tipper-name inputs were removed
    // because the on-chain tip() stores neither — so the tip dispatch carries
    // only (devId, amount, anonymous).
    fireEvent.change(screen.getByLabelText("Developer ID"), {
      target: { value: "7" },
    });
    fireEvent.change(screen.getByLabelText("Tip Amount"), {
      target: { value: "0.05" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send Tip" }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("sendTip", 7, "0.05", false);
    });
  });

  it("offers quick tip presets that update the submitted amount", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.change(screen.getByLabelText("Developer ID"), {
      target: { value: "7" },
    });
    fireEvent.click(screen.getByRole("button", { name: /0\.05\s+GAS/i }));
    fireEvent.click(screen.getByRole("button", { name: "Send Tip" }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("sendTip", 7, "0.05", false);
    });
  });

  it("renders the tipping banner assets in the hero", () => {
    render(<PlayArea t={t} state={state()} dispatch={vi.fn().mockResolvedValue(undefined)} />);

    expect(document.querySelector('.tipping-hero__media img[src="./banner.jpg"]')).toBeTruthy();
    expect(document.querySelector('.tipping-hero__badge img[src="./logo.jpg"]')).toBeTruthy();
    expect(document.querySelector('.tipping-support-stage img[src="./support-board-stage.jpg"]')).toBeTruthy();
  });

  it("does not let a default zero display hide a loaded donation total", () => {
    render(
      <PlayArea
        t={t}
        state={state({ totalDonated: 1.25, totalDonatedDisplay: "0" })}
        dispatch={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText("1.25")).toBeTruthy();
  });
});
