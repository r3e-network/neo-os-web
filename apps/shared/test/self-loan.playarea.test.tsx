import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../self-loan/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    addCollateral: "Add Collateral",
    aggressive: "Aggressive",
    amountToLock: "Lock NEO",
    borrow: "Borrow",
    borrowedLabel: "Borrowed",
    collateralAmount: "Collateral Amount",
    conservative: "Conservative",
    connectWalletToUse: "Connect wallet to use Self Loan",
    custodyBadge: "No third-party voting",
    custodyTitle: "Collateral custody",
    custodyValue: "Returned in full",
    docSubtitle: "Tiered LTV self-loans with auto-repayment",
    estimatedBorrow: "Estimated Borrow",
    estimatedBorrowNet: "Estimated Borrow (after fee)",
    eyebrow: "Self Loan",
    loanAlreadyActiveHint: "One loan per address",
    loanStatsTitle: "Loan stats",
    loanTerms: "Loan terms",
    ltvLabel: "LTV",
    ltvTier: "LTV tier",
    originationFee: "Origination fee ({percent}%)",
    poolAvailable: "Pool available",
    rateFeeNote: "Rate is operator set; the fee stays with the pool.",
    rateLabel: "Rate",
    rateValue: "1 NEO = {price}",
    repay: "Repay",
    selectedLTV: "LTV Ratio",
    takeSelfLoan: "Take Self-Loan",
    title: "SelfLoan",
    totalBorrowed: "Total Borrowed",
    totalLoans: "Total Loans",
    totalRepaid: "Total Repaid",
    yourBalance: "Your Balance",
  };

  let value = messages[key] ?? key;
  for (const [paramKey, paramValue] of Object.entries(params ?? {})) {
    value = value.replaceAll(`{${paramKey}}`, String(paramValue));
  }
  return value;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    addCollateralOkNonce: 0,
    borrowedDisplay: "0",
    borrowOkNonce: 0,
    collateralAmount: "",
    collateralCreditDisplay: "",
    collateralDisplay: "0",
    currentLTV: 0,
    currentLTVDisplay: "",
    hasActiveLoan: false,
    hasCollateralCredit: false,
    hasLoanDisplay: "No",
    hasPendingConfirmation: false,
    hasRepayCredit: false,
    healthFactor: 0,
    healthFactorDisplay: "",
    healthMetricLabel: "",
    isAddingCollateral: false,
    isBorrowing: false,
    isConnected: true,
    isLoading: false,
    isProcessing: false,
    isRepaying: false,
    loan: null,
    ltvOptions: [
      { tier: 1, percent: 20, label: "Conservative" },
      { tier: 2, percent: 30, label: "Balanced" },
      { tier: 3, percent: 40, label: "Aggressive" },
    ],
    neoBalance: 48,
    neoBalanceDisplay: "48",
    neoPrice: 1,
    neoPriceDisplay: "1 GAS",
    pendingConfirmation: "",
    platformStats: {
      platformFeeBps: 50,
      totalBorrowed: 180,
      totalLoans: 9,
      totalRepaid: 42,
    },
    poolDisplay: "250 GAS",
    repayCreditDisplay: "",
    repayOkNonce: 0,
    selectedLtv: 2,
    selectedLtvPercent: 30,
    stats: {
      totalBorrowed: 180,
      totalLoans: 9,
      totalRepaid: 42,
    },
    totalBorrowedDisplay: "180",
    totalLoans: 9,
    totalRepaidDisplay: "42",
    ...overrides,
  };

  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      createObservable(value),
    ]),
  );
}

describe("Self Loan PlayArea", () => {
  it("renders the vault control desk and keeps borrow actions wired", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    expect(document.querySelector(".selfloan-borrow-desk")).toBeTruthy();
    expect(document.querySelector(".selfloan-ltv-desk")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Aggressive\s*40%/ }));
    expect(dispatch).toHaveBeenCalledWith("setLtvTier", 3);

    fireEvent.change(screen.getByLabelText("Collateral Amount"), {
      target: { value: "12" },
    });
    expect(dispatch).toHaveBeenCalledWith("setCollateralAmount", "12");

    fireEvent.click(screen.getByRole("button", { name: "Borrow" }));

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith("borrow", {
        collateralAmount: "12",
      }),
    );
  });
});
