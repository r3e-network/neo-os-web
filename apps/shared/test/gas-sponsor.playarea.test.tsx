import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../gas-sponsor/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

// Mirror of the gas-sponsor locale keys the PlayArea reads. Interpolates
// {amount} so balance-aware hints are assertable.
function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    title: "Gas Sponsor",
    subtitle: "Get free GAS for transactions",
    requestGas: "Request GAS",
    gasBalance: "GAS Balance",
    sidebarTankLevel: "Tank Level",
    remaining: "Remaining",
    used: "Used",
    resetsAt: "Resets at",
    notEligibleTitle: "Not Eligible",
    balanceExceeds: "Your GAS balance exceeds 0.1 GAS.",
    quotaExhausted: "Daily quota exhausted",
    tryTomorrow: "Please try again tomorrow.",
    requestAmount: "Request Amount",
    maxRequest: "Max request",
    amountToRequest: "Amount to request",
    amountToRequestPlaceholder: "0.01",
    requesting: "Requesting...",
    tokenGas: "GAS",
    needsFuel: "Needs Fuel",
    tankFull: "Tank Full",
    // pay it forward
    payItForward: "Pay It Forward",
    payForwardLead: "You're funded — donate or send GAS to help another wallet.",
    payForwardLockedTitle: "Get funded first",
    payForwardLockedDesc: "Donate and Send move GAS you already hold.",
    balanceAvailable: `Available: ${params?.amount ?? ""} GAS`,
    donate: "Donate GAS",
    donateSubtitle: "Help new users get started on Neo",
    donateAmount: "Donation Amount",
    donateAmountPlaceholder: "0.1",
    donating: "Donating...",
    donateAction: "Donate",
    donateInvalid: "Enter an amount up to your balance",
    sendGas: "Send GAS",
    sendSubtitle: "Help someone with low GAS balance",
    recipient: "Recipient Address",
    recipientPlaceholder: "Enter Neo N3 address...",
    sendAmount: "Amount to Send",
    sendAmountPlaceholder: "0.1",
    sending: "Sending...",
    sendAction: "Send",
    sendAmountInvalid: "Enter an amount up to your balance",
    invalidAddress: "Invalid address",
  };
  return messages[key] ?? key;
}

// A valid Neo N3 address (N-prefix, 34 base58 chars).
const VALID_ADDR = "NhWxcoEc9qtmnjsTLF1fVF6myJ5MZZhSMK";

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    gasBalance: "0",
    gasBalanceDisplay: "0",
    isEligible: true,
    fuelLevelPercent: 0,
    remainingQuota: 0.1,
    remainingQuotaDisplay: "0.1000",
    isRequesting: false,
    requestAmount: "0.01",
    maxRequestAmount: 0.1,
    quickAmounts: [0.001, 0.005, 0.01, 0.05],
    loading: false,
    userAddress: "",
    usedQuota: 0,
    dailyLimit: 0.1,
    quotaPercent: 0,
    resetTime: "12h 0m",
    donateAmount: "0",
    sendAmount: "0",
    recipientAddress: "",
    isDonating: false,
    isSending: false,
    isFunded: false,
    donateAmountValid: false,
    recipientValid: false,
    sendAmountValid: false,
    canSend: false,
    tankLevelDisplay: "0%",
    eligibleDisplay: "Eligible",
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("Gas Sponsor PlayArea — pay-it-forward gating", () => {
  it("shows the locked pay-it-forward state for an unfunded (eligible) wallet", () => {
    render(<PlayArea t={t} state={state({ isFunded: false })} dispatch={vi.fn(async () => undefined)} />);

    // The locked explanation is shown instead of live transfer forms.
    expect(screen.getByText("Get funded first")).toBeTruthy();
    // No usable Donate / Send buttons that would fail at the chain.
    expect(screen.queryByRole("button", { name: "Donate" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Send" })).toBeNull();
    expect(screen.queryByLabelText("Recipient Address")).toBeNull();
  });

  it("reveals the donate + send forms once the wallet is funded", () => {
    render(
      <PlayArea
        t={t}
        state={state({ isFunded: true, gasBalance: "1.5", gasBalanceDisplay: "1.5", isEligible: false })}
        dispatch={vi.fn(async () => undefined)}
      />,
    );

    expect(screen.getByRole("button", { name: "Donate" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Send" })).toBeTruthy();
    expect(screen.getByLabelText("Recipient Address")).toBeTruthy();
    // Balance-aware helper hint surfaces the spendable amount.
    expect(screen.getAllByText("Available: 1.5 GAS").length).toBeGreaterThan(0);
  });

  it("disables Donate until the amount is valid and dispatches when it is", async () => {
    const dispatch = vi.fn(async () => undefined);
    // Invalid donate amount (0 / over balance) → button disabled.
    const { rerender } = render(
      <PlayArea
        t={t}
        state={state({ isFunded: true, gasBalance: "1", donateAmountValid: false })}
        dispatch={dispatch}
      />,
    );
    expect((screen.getByRole("button", { name: "Donate" }) as HTMLButtonElement).disabled).toBe(true);

    // Now valid → enabled and dispatches "donate" with the amount.
    rerender(
      <PlayArea
        t={t}
        state={state({ isFunded: true, gasBalance: "1", donateAmount: "0.5", donateAmountValid: true })}
        dispatch={dispatch}
      />,
    );
    const donateBtn = screen.getByRole("button", { name: "Donate" }) as HTMLButtonElement;
    expect(donateBtn.disabled).toBe(false);
    fireEvent.click(donateBtn);
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("donate", "0.5");
    });
  });

  it("disables Send until recipient + amount are valid, then dispatches", async () => {
    const dispatch = vi.fn(async () => undefined);
    const { rerender } = render(
      <PlayArea
        t={t}
        state={state({ isFunded: true, gasBalance: "1", recipientValid: false, sendAmountValid: false, canSend: false })}
        dispatch={dispatch}
      />,
    );
    expect((screen.getByRole("button", { name: "Send" }) as HTMLButtonElement).disabled).toBe(true);

    rerender(
      <PlayArea
        t={t}
        state={state({
          isFunded: true,
          gasBalance: "1",
          recipientAddress: VALID_ADDR,
          sendAmount: "0.25",
          recipientValid: true,
          sendAmountValid: true,
          canSend: true,
        })}
        dispatch={dispatch}
      />,
    );
    const sendBtn = screen.getByRole("button", { name: "Send" }) as HTMLButtonElement;
    expect(sendBtn.disabled).toBe(false);
    fireEvent.click(sendBtn);
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("send", VALID_ADDR, "0.25");
    });
  });

  it("surfaces inline field errors instead of letting a bad transfer reach the chain", () => {
    render(
      <PlayArea
        t={t}
        state={state({
          isFunded: true,
          gasBalance: "1",
          donateAmount: "5",
          donateAmountValid: false,
          recipientAddress: "not-a-real-address",
          recipientValid: false,
        })}
        dispatch={vi.fn(async () => undefined)}
      />,
    );

    // Over-balance donate amount → inline error (role=alert from NeoInput).
    expect(screen.getByText("Enter an amount up to your balance")).toBeTruthy();
    // Malformed recipient → inline invalid-address error.
    expect(screen.getByText("Invalid address")).toBeTruthy();
  });

  it("still dispatches the primary requestSponsorship flow for eligible users", async () => {
    const dispatch = vi.fn(async () => undefined);
    render(<PlayArea t={t} state={state({ isEligible: true, remainingQuota: 0.1 })} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: "Request GAS" }));
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("requestSponsorship", "0.01");
    });
  });
});
