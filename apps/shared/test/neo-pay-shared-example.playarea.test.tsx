import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../neo-pay-shared-example/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());

function t(k: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    active: "active",
    assetType: "Asset",
    beneficiaryPlaceholder: "Enter Neo N3 address",
    claim: "claim",
    customDays: "Custom",
    docSubtitle: "Scheduled releases for payrolls, subscriptions, and allowances",
    duration: "Duration",
    recipient: "Recipient Address",
    releaseCliff: "{amount} {token} after {days} days",
    releaseLinear: "{amount} {token} per day",
    releasePlan: "Release plan",
    reviewStream: "Draft release schedule",
    sharedPaymentStage: "Shared payment stream stage",
    sharedStreamRoute: "Shared stream route",
    streamDraftIdle: "Stream ticket draft",
    streamDraftReady: "Ready for wallet review",
    streamDraftSigning: "Wallet signing in progress",
    streamTicket: "Stream ticket",
    totalAmount: "Total amount",
    transactionPreviewHint: "Wallet confirmation shows final recipient, token, amount, and schedule.",
    walletFunding: "Funding wallet",
  };
  let value = messages[k] ?? k;
  if (params) for (const [key, param] of Object.entries(params)) value = value.replaceAll(`{${key}}`, String(param));
  return value;
}
function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, createObservable(v)])) as ObservableState;
}

describe("neo-pay-shared-example PlayArea (v2)", () => {
  it("renders a styled payment stream desk with v2 stage", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          activeCount: 1,
          createdStreamCount: 1,
          beneficiaryStreamCount: 0,
          allStreams: [{ id: 7, beneficiary: "Nabc1234567890", amount: "1 GAS", status: "active" }],
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".mx2-stage")).toBeTruthy();
    expect(container.querySelector(".neopay-shared-desk")).toBeTruthy();
    expect(container.querySelector(".neopay-ticket-board")).toBeTruthy();
    expect(container.querySelector(".neopay-ticket-board__screen")).toBeTruthy();
    expect(container.querySelector(".neopay-receipt-strip")).toBeTruthy();
    expect(container.textContent).toContain("Payment Streams");
    expect(container.textContent).toContain("Stream ticket");
    expect(container.textContent).not.toMatch(/📥/);
  });

  it("creates a stream with recipient, preset amount, duration, and token", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByText("50 GAS"));
    fireEvent.change(screen.getByLabelText(/Recipient/), { target: { value: "Nrecipient" } });
    fireEvent.click(screen.getByText("Create Stream"));

    expect(dispatch).toHaveBeenCalledWith("createStream", {
      recipient: "Nrecipient",
      amount: "50",
      duration: "30",
      token: "GAS",
    });
  });

  it("keeps NEO stream amounts whole-number only before dispatch", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    const neoButton = Array.from(container.querySelectorAll(".neopay-asset-toggle button")).find((button) => button.textContent?.includes("NEO"))!;
    fireEvent.click(neoButton);

    const amountInput = container.querySelector<HTMLInputElement>("#neopay-shared-amount")!;
    expect(amountInput.inputMode).toBe("numeric");
    fireEvent.change(amountInput, { target: { value: "12.9" } });
    expect(amountInput.value).toBe("12");

    fireEvent.change(screen.getByLabelText(/Recipient/), { target: { value: "Nrecipient" } });
    fireEvent.click(screen.getByText("Create Stream"));

    expect(dispatch).toHaveBeenCalledWith("createStream", expect.objectContaining({
      amount: "12",
      token: "NEO",
    }));
  });

  it("claims streams by id from the drawer", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ allStreams: [{ id: 42, beneficiary: "Nclaim", amount: "1 GAS", status: "active" }] })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(screen.getByText("claim"));

    expect(dispatch).toHaveBeenCalledWith("claimStream", "42");
  });

  it("imports v2 styles and removes the old global backdrop override", () => {
    const fs = require("node:fs");
    const s = fs.readFileSync(`${process.cwd()}/../neo-pay-shared-example/src/PlayArea.scss`, "utf8");

    expect(s).toContain('@use "@shared/components-react/v2/v2" as *;');
    expect(s).toMatch(/prefers-reduced-motion/);
    expect(s).toMatch(/\.neopay-ticket-board\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.neopay-ticket-board__screen\s*\{[\s\S]*box-shadow:\s*inset 4px 0 0 rgba\(37,\s*99,\s*235,\s*0\.18\)/);
    expect(s).toMatch(/\.neopay-amount-presets\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/@media \(max-width: 860px\)[\s\S]*\.neopay-route\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(s).not.toMatch(/AI-generated scene backdrop/);
    expect(s).not.toMatch(/__backdrop/);
    expect(s).not.toMatch(/background-image:\s*url/);
  });
});
