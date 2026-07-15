import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import { BLOCKCHAIN_CONSTANTS } from "../constants";
import type { StreamItem } from "../composables/neo-pay";
import PlayArea from "../../neo-pay-shared-example/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());

const CREATOR = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const BENEFICIARY = "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq";

function t(key: string, params?: Record<string, string | number>) {
  const copy: Record<string, string> = {
    amountEmptyHint: "Choose an amount to fund.",
    assetPicker: "Payment asset",
    atomicFundingHint: "One wallet transaction atomically funds and creates the stream.",
    beneficiaryPlaceholder: "Enter Neo N3 address",
    bindingVerified: "Canonical NeoPay",
    cancel: "Cancel",
    claim: "Claim",
    claimable: "Claimable",
    confirmCancel: "Confirm cancel",
    createStudioStream: "Create payment stream",
    customDays: "Custom",
    durationDays: "Release duration",
    exactTab: "Ticket",
    gasFixed8Required: "Enter a positive GAS amount with no more than 8 decimal places.",
    guideTab: "How it works",
    incomingTab: "Receiving",
    intervalLabel: "Interval",
    networkTestnet: "Neo N3 Testnet",
    neoWholeAmountRequired: "NEO is indivisible. Enter a positive whole-token amount; your draft was not changed.",
    noCreatedStudioStreams: "No verified outgoing streams yet.",
    noIncomingStudioStreams: "No verified incoming streams yet.",
    officialAsset: "Official Neo N3 asset",
    outgoingTab: "Created",
    paymentArtAlt: "A bright payment vault",
    paymentTicket: "Payment ticket",
    recipientEmptyHint: "Enter a valid Neo N3 address.",
    recipientRoute: "Recipient route",
    releaseLinear: "{amount} {token} per day",
    releasePlan: "Release plan",
    remaining: "Remaining",
    serviceLive: "Live chain view",
    streamAmount: "Stream amount",
    streamWorkspace: "Streams & details",
    studioEyebrow: "Programmable payments",
    studioHeroSubtitle: "A focused stream workstation.",
    studioHeroTitle: "Shape one clear payment stream",
    studioStageAria: "NeoPay stream workstation",
    ticketDraft: "Complete the payment route",
    ticketReady: "Ready for wallet review",
    totalLocked: "Total locked",
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

function stream(overrides: Partial<StreamItem> = {}): StreamItem {
  return {
    id: "42",
    creator: CREATOR,
    beneficiary: BENEFICIARY,
    asset: BLOCKCHAIN_CONSTANTS.GAS_HASH,
    assetSymbol: "GAS",
    totalAmount: 2_000_000_000n,
    releasedAmount: 500_000_000n,
    remainingAmount: 1_500_000_000n,
    rateAmount: 100_000_000n,
    intervalSeconds: 86_400n,
    intervalDays: 1,
    status: "active",
    claimable: 100_000_000n,
    title: "Studio payroll",
    notes: "",
    ...overrides,
  };
}

describe("neo-pay-shared-example PlayArea", () => {
  it("uses the real NeoPay artwork as the primary bright stream workstation", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    expect(container.querySelector(".neo-pay-shared-playstage")).toBeTruthy();
    expect(container.querySelector(".stream-studio__workbench")).toBeTruthy();
    expect((container.querySelector(".stream-studio__art") as HTMLImageElement).src)
      .toContain("payment-stream-desk.webp");
    expect(container.textContent).toContain("Shape one clear payment stream");
    expect(container.querySelectorAll(".mx2-btn--primary")).toHaveLength(1);
  });

  it("preserves a fractional draft when switching to NEO and blocks dispatch with a clear error", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    const amount = screen.getByLabelText("Stream amount") as HTMLInputElement;
    fireEvent.change(amount, { target: { value: "12.9" } });
    fireEvent.click(container.querySelector<HTMLInputElement>('.stream-studio__asset-options input[value="NEO"]')!);

    expect(amount.value).toBe("12.9");
    expect(screen.getByRole("alert").textContent).toContain("NEO is indivisible");
    expect(container.querySelector<HTMLButtonElement>(".mx2-btn--primary")?.disabled).toBe(true);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("preserves and rejects GAS amounts beyond Fixed8 precision", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    const amount = screen.getByLabelText("Stream amount") as HTMLInputElement;
    fireEvent.change(amount, { target: { value: "0.123456789" } });
    expect(amount.value).toBe("0.123456789");
    expect(screen.getByRole("alert").textContent).toContain("no more than 8 decimal places");
    expect(container.querySelector<HTMLButtonElement>(".mx2-btn--primary")?.disabled).toBe(true);
  });

  it("requires a real Neo N3 address and a 1-365 whole-day duration", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Stream amount"), { target: { value: "1" } });
    fireEvent.change(screen.getByLabelText("Recipient route"), { target: { value: "Nrecipient" } });
    fireEvent.change(screen.getByLabelText("Custom"), { target: { value: "366" } });
    expect(screen.getAllByRole("alert")).toHaveLength(2);
    expect(container.querySelector<HTMLButtonElement>(".mx2-btn--primary")?.disabled).toBe(true);
  });

  it("only claims an authoritative incoming row", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea t={t} state={state({ beneficiaryStreams: [stream()] })} dispatch={dispatch} />,
    );
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(screen.getByText("Receiving"));
    fireEvent.click(screen.getByText("Claim"));
    expect(dispatch).toHaveBeenCalledWith("claimStream", "42");
  });

  it("requires a second click before cancelling an authoritative outgoing row", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea t={t} state={state({ createdStreams: [stream()] })} dispatch={dispatch} />,
    );
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(screen.getByText("Cancel"));
    expect(dispatch).not.toHaveBeenCalledWith("cancelStream", "42");
    fireEvent.click(screen.getByText("Confirm cancel"));
    expect(dispatch).toHaveBeenCalledWith("cancelStream", "42");
  });

  it("reads as a connect invitation, not a locked contract, before any chain context", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ chainBindingState: "awaiting-context", serviceState: "disconnected", network: "" })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.textContent).not.toContain("Wallet actions are locked");
    expect(container.textContent).not.toContain("Network unavailable");
    expect(container.textContent).not.toContain("Live stream data unavailable");
    expect(container.querySelector('.stream-studio__network-ticket > em[data-state="mismatch"]')).toBeNull();
    expect(container.querySelector('.stream-studio__network-ticket > em[data-state="awaiting"]')).toBeTruthy();
  });

  it("announces the service state once per screen", () => {
    const { container } = render(
      <PlayArea t={t} state={state({ serviceState: "unavailable" })} dispatch={vi.fn()} />,
    );
    // The PlayStage badge is the single owner of this copy; the composer header
    // used to repeat it verbatim, so the same chip appeared twice at once.
    const rendered = container.textContent ?? "";
    const label = t("serviceUnavailable");
    const occurrences = rendered.split(label).length - 1;
    expect(occurrences).toBe(1);
    expect(container.querySelector(".stream-studio__service")).toBeNull();
  });

  it("does not turn a failed read into a zero-stream success state", () => {
    const { container } = render(
      <PlayArea t={t} state={state({ serviceState: "unavailable" })} dispatch={vi.fn()} />,
    );
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.textContent).toContain("streamDataUnavailable");
    expect(container.textContent).not.toContain("No verified outgoing streams yet.");
    expect(container.querySelector(".stream-studio__drawer-tab em")).toBeNull();
  });

  it("imports direct v2/OpenUiLite styles and contains no CSS-art route or backdrop", () => {
    const fs = require("node:fs");
    const sharedRoot = process.cwd().endsWith("/apps/shared")
      ? process.cwd()
      : `${process.cwd()}/apps/shared`;
    const css = fs.readFileSync(`${sharedRoot}/../neo-pay-shared-example/src/PlayArea.scss`, "utf8");
    const source = fs.readFileSync(`${sharedRoot}/../neo-pay-shared-example/src/PlayArea.tsx`, "utf8");
    expect(source).toContain('@shared/components-react/v2/PlayStage');
    expect(source).toContain('@shared/components-react/v2/OpenUiLite');
    expect(source).toContain('payment-stream-desk.webp');
    expect(css).toContain('@use "@shared/components-react/v2/v2" as *;');
    expect(css).toMatch(/\.stream-studio__workbench\s*\{[\s\S]*grid-template-columns/);
    expect(css).toMatch(/@media \(max-width: 920px\)[\s\S]*\.stream-studio__workbench\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(css).not.toMatch(/__orb|__pulse|__backdrop|background-image\s*:/);
  });
});
