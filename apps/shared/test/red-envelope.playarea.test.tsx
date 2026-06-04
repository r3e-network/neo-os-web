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
    creatorMode: "Creator mode",
    createdGasLabel: "Created GAS",
    enterPoolId: "Enter pool ID",
    envelopeId: "Envelope ID",
    expiryHours: "Expiry hours",
    hoursSuffix: "h",
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

    render(
      <PlayArea
        t={t}
        state={baseState()}
        dispatch={dispatch}
        launchContext={launch()}
      />,
    );

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

    render(
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

    fireEvent.click(screen.getByRole("tab", { name: "Create" }));

    expect((screen.getByLabelText("Total GAS") as HTMLInputElement).value).toBe("0.1");
    expect((screen.getByLabelText("Packet count") as HTMLInputElement).value).toBe("100");
    expect((screen.getByRole("button", { name: "Send Red Envelope" }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Packet count"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Send Red Envelope" }));

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith("createEnvelope", {
        amount: "0.1",
        count: "5",
        expiryHours: "12",
      }),
    );
  });
});
