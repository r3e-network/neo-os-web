import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../neo-pay-shared-example/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());

const RECIPIENT = "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq";

function t(key: string, params?: Record<string, string | number>) {
  const copy: Record<string, string> = {
    assetPicker: "Payment asset",
    beneficiaryPlaceholder: "Enter Neo N3 address",
    bindingVerified: "Canonical NeoPay",
    createStudioStream: "Create payment stream",
    creatingStudioStream: "Creating payment stream",
    customDays: "Custom",
    durationDays: "Release duration",
    exactTab: "Ticket",
    guideTab: "How it works",
    incomingTab: "Receiving",
    networkTestnet: "Neo N3 Testnet",
    officialAsset: "Official Neo N3 asset",
    outgoingTab: "Created",
    paymentArtAlt: "Payment vault",
    paymentTicket: "Payment ticket",
    recipientRoute: "Recipient route",
    refreshStreams: "Refresh chain view",
    releaseLinear: "{amount} {token} per day",
    serviceLive: "Live chain view",
    servicePending: "Confirmation pending",
    streamAmount: "Stream amount",
    streamWorkspace: "Streams & details",
    studioEyebrow: "Programmable payments",
    studioHeroSubtitle: "Fund and review one stream.",
    studioHeroTitle: "Shape one clear payment stream",
    studioStageAria: "NeoPay workstation",
    ticketReady: "Ready for wallet review",
    transactionPreviewHint: "Review before signing",
  };
  let value = copy[key] ?? key;
  for (const [name, replacement] of Object.entries(params ?? {})) {
    value = value.replaceAll(`{${name}}`, String(replacement));
  }
  return value;
}

function state(values: Partial<Record<string, unknown>> = {}): ObservableState {
  const defaults: Record<string, unknown> = {
    network: "neo-n3-testnet",
    contractHash: "0x27a81e6d2f01a1d241b9aef5bed74c93f3a5ca5e",
    chainBindingState: "verified",
    serviceState: "live",
    createdStreams: [],
    beneficiaryStreams: [],
  };
  return Object.fromEntries(
    Object.entries({ ...defaults, ...values }).map(([key, value]) => [key, createObservable(value)]),
  ) as ObservableState;
}

describe("neo-pay-shared-example integration", () => {
  it("dispatches one validated stream ticket from the primary action", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.change(screen.getByLabelText("Stream amount"), { target: { value: "50.125" } });
    fireEvent.change(screen.getByLabelText("Recipient route"), { target: { value: RECIPIENT } });
    fireEvent.click(screen.getByText("Create payment stream"));

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("createStream", {
      recipient: RECIPIENT,
      amount: "50.125",
      duration: "30",
      token: "GAS",
      notes: "",
    }));
  });

  it("turns the single primary action into read-only recovery while a tx is pending", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(
      <PlayArea
        t={t}
        state={state({
          pendingCreateTxid: `0x${"ab".repeat(32)}`,
          serviceState: "pending",
          serviceNotice: "Transaction submitted. Do not repeat it.",
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(screen.getByText("checkPendingStream"));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("recoverPendingCreate"));
    expect(dispatch).not.toHaveBeenCalledWith("createStream", expect.anything());
  });

  it("keeps refresh separate from create and never presents it as a wallet action", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(screen.getByText("Refresh chain view"));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("refreshStreams"));
    expect(dispatch).not.toHaveBeenCalledWith("createStream", expect.anything());
  });

  it("has a reduced-motion guard", () => {
    const fs = require("node:fs");
    const sharedRoot = process.cwd().endsWith("/apps/shared")
      ? process.cwd()
      : `${process.cwd()}/apps/shared`;
    const css = fs.readFileSync(`${sharedRoot}/../neo-pay-shared-example/src/PlayArea.scss`, "utf8");
    expect(css).toMatch(/prefers-reduced-motion/);
  });
});
