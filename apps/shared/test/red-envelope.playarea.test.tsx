import fs from "node:fs";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import { parseMiniAppLaunchContext } from "../utils/launch-params";
import PlayArea from "../../red-envelope/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    availableEnvelopes: "Active envelopes",
    claimTab: "Claim",
    createTab: "Create",
    claimablePool: "Claimable pool",
    claimContractRoute: "game.placeBet -> claimResult",
    claimFlowTitle: "Claim flow",
    claimNow: "Claim now",
    claimPanelTitle: "Recipient claim path",
    claimRouteOne: "Select envelope",
    claimRouteOneCopy: "Choose a claimable envelope.",
    claimRouteThree: "Receive GAS",
    claimRouteThreeCopy: "Claimed GAS settles to the wallet.",
    claimRouteTwo: "Review request",
    claimRouteTwoCopy: "Review the wallet request.",
    claimedGasLabel: "Claimed GAS",
    contractRoute: "Contract route",
    createPanelTitle: "Send a lucky envelope",
    createPreviewTitle: "Envelope preview",
    createReadyDesc: "Ready to send. Each recipient draws a random share of the pool.",
    creatorMode: "Creator mode",
    createdGasLabel: "Created GAS",
    enterPoolId: "Enter pool ID",
    envelopeId: "Envelope ID",
    expiryHours: "Expiry hours",
    giftMachineTitle: "Lucky packet machine",
    giftMachineCopy: "Tune the pool, packet count, and expiry before sending.",
    hoursSuffix: "h",
    invalidAmount: "Enter at least 0.1 GAS",
    invalidExpiry: "Enter a valid expiry in hours",
    invalidPackets: "Enter 1-100 packets",
    invalidPerPacket: "Each packet must be at least 0.01 GAS",
    needsEnvelopeId: "Needs envelope ID",
    noActivity: "No recent claims",
    noActivityCopy: "Successful claims will appear here.",
    noPools: "No active envelopes",
    noPoolsCopy: "Create or paste an envelope ID.",
    packetCount: "Packet count",
    perPacketLabel: "Average packet",
    poolProgress: "Pool progress",
    ready: "Ready",
    readyToClaim: "Claim request prepared",
    recentClaimsTitle: "Recent claims",
    redEnvelopeHeroSubtitle: "Claim or send Neo N3 GAS envelopes.",
    redEnvelopeHeroTitle: "Red Envelope",
    remainingPacketsLabel: "Packets left",
    safetyPanelCopy: "Claims and creates go through guarded OS services.",
    safetyPanelTitle: "Transaction safety",
    sendRedEnvelope: "Send Red Envelope",
    shareReadyTitle: "OneGate share-ready",
    totalGas: "Total GAS",
    ...Object.fromEntries(
      Object.entries(params ?? {}).map(([paramKey, paramValue]) => [
        paramKey,
        String(paramValue),
      ]),
    ),
  };
  return messages[key] ?? key;
}

function launch(url = "https://neomini.app/miniapps/red-envelope/index.html?network=testnet") {
  return parseMiniAppLaunchContext(url, "miniapp-redenvelope");
}

function baseState(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    claimCount: 1,
    claims: [
      {
        id: "claim-1",
        holder: "Ndb1n4zzgW9h1yW7rS7Pqz4CkL8xF9m2Aa",
        amount: 0.42,
      },
    ],
    envelopeCount: 2,
    envelopes: [
      {
        id: "pool-alpha",
        totalAmount: 8,
        packetCount: 8,
        openedCount: 5,
        remainingAmount: 3.2,
        remainingPackets: 3,
        active: true,
        canOpen: true,
        status: "active",
      },
      {
        id: "pool-closed",
        totalAmount: 2,
        packetCount: 4,
        openedCount: 4,
        remainingAmount: 0,
        remainingPackets: 0,
        active: false,
        canOpen: false,
        status: "closed",
      },
    ],
    isLoading: false,
    luckyMessage: null,
    openingId: null,
    poolCount: 1,
    totalClaimed: 0.42,
    totalCreated: 8,
    ...overrides,
  };

  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("Red Envelope PlayArea", () => {
  it("lets a recipient select an active envelope and dispatch a claim", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    const { container } = render(
      <PlayArea
        t={t}
        state={baseState()}
        dispatch={dispatch}
        launchContext={launch()}
      />,
    );

    expect(container.querySelector(".redenv-envelope-preview--claim")).toBeTruthy();
    expect(container.querySelector(".redenv-envelope-preview__seal")).toBeTruthy();
    expect(container.querySelectorAll(".redenv-envelope-preview__packet img").length).toBe(5);
    expect(container.querySelector(".redenv-open-button")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /#pool-alpha\s+3\/8/ }));
    expect((screen.getByLabelText("Envelope ID") as HTMLInputElement).value).toBe("pool-alpha");

    fireEvent.click(screen.getByRole("button", { name: "Claim now" }));

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith("claimEnvelope", {
        envelopeId: "pool-alpha",
      }),
    );
  });

  it("prefills launch params and keeps creator validation tied to contract limits", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    const { container } = render(
      <PlayArea
        t={t}
        state={baseState({ envelopes: [], claims: [], claimCount: 0, poolCount: 0 })}
        dispatch={dispatch}
        launchContext={launch(
          "https://neomini.app/miniapps/red-envelope/index.html?network=testnet&envelopeId=qr-pool-42&amount=0.1&count=100&expiryHours=12",
        )}
      />,
    );

    expect((screen.getByLabelText("Envelope ID") as HTMLInputElement).value).toBe("qr-pool-42");
    expect(screen.getByText("Claim request prepared")).toBeTruthy();
    expect(screen.queryByText("Needs envelope ID")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: "Create" }));

    expect(container.querySelector(".redenv-envelope-preview--create")).toBeTruthy();
    expect(container.querySelectorAll(".redenv-envelope-preview__packet img").length).toBe(5);
    const giftMachine = container.querySelector(".redenv-gift-machine");
    expect(giftMachine).toBeTruthy();
    expect(giftMachine?.getAttribute("aria-label")).toBe("Lucky packet machine");
    expect(container.querySelector(".redenv-gift-machine__window img")?.getAttribute("src")).toBe("./red-envelope-claim-card.jpg");
    expect(container.querySelectorAll(".redenv-gift-machine__chute span").length).toBe(12);
    expect(container.querySelectorAll(".redenv-gift-machine__reel").length).toBe(3);
    expect(container.querySelector(".redenv-gift-machine--ready")).toBeNull();
    expect(container.querySelector(".redenv-send-button")).toBeTruthy();
    expect(document.querySelector(".redenv-envelope-dials")).toBeTruthy();
    expect(document.querySelectorAll(".redenv-preset-group").length).toBe(3);
    expect((screen.getByLabelText("Total GAS") as HTMLInputElement).value).toBe("0.1");
    expect((screen.getByLabelText("Packet count") as HTMLInputElement).value).toBe("100");
    expect((screen.getByRole("button", { name: "Send Red Envelope" }) as HTMLButtonElement).disabled).toBe(true);

    // 0.1 GAS across 100 packets = 0.001 each (< 0.01 min), so the disabled
    // button must explain itself with an inline per-packet validation message.
    expect(screen.getByRole("alert").textContent).toBe("Each packet must be at least 0.01 GAS");

    fireEvent.change(screen.getByLabelText("Packet count"), { target: { value: "5" } });

    // Once the form is valid the error clears and the send button enables.
    expect(screen.queryByRole("alert")).toBeNull();
    expect((screen.getByRole("button", { name: "Send Red Envelope" }) as HTMLButtonElement).disabled).toBe(false);
    expect(container.querySelector(".redenv-gift-machine--ready")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Send Red Envelope" }));

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith("createEnvelope", {
        amount: "0.1",
        count: "5",
        expiryHours: "12",
      }),
    );
  });

  it("marks the envelope preview as animated while an envelope is opening", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    const { container } = render(
      <PlayArea
        t={t}
        state={baseState({ openingId: "pool-alpha" })}
        dispatch={dispatch}
        launchContext={launch(
          "https://neomini.app/miniapps/red-envelope/index.html?network=testnet&envelopeId=pool-alpha",
        )}
      />,
    );

    const openButton = container.querySelector(".redenv-open-button");

    expect(container.querySelector(".redenv-envelope-preview--opening")).toBeTruthy();
    expect(openButton).toBeTruthy();
    expect(openButton?.getAttribute("aria-busy")).toBe("true");
  });

  it("keeps the lucky packet machine animated and reduced-motion safe", () => {
    const styles = fs.readFileSync(
      `${process.cwd()}/../red-envelope/src/PlayArea.scss`,
      "utf8",
    );

    expect(styles).toMatch(/@keyframes redenv-machine-sweep/);
    expect(styles).toMatch(/@keyframes redenv-machine-seal-send/);
    expect(styles).toMatch(/@keyframes redenv-machine-packet-ready/);
    expect(styles).toMatch(/\.redenv-gift-machine--sending \.redenv-gift-machine__chute span\s*\{[\s\S]*animation-name:\s*redenv-machine-packet-send/);
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.redenv-gift-machine__chute span/);
  });
});
