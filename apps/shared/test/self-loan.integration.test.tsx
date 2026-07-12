import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../self-loan/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string) { const m: Record<string,string> = { borrowFlowKicker:"Loan", borrowNow:"Borrow", borrow:"Borrow", borrowFlowBorrowing:"Borrowing", borrowFlowDraft:"Draft", borrowFlowReady:"Ready", collateral:"Collateral", collateralRatio:"LTV", collateralLocked:"Locked", collateralStatus:"Status", collateralRefunded:"Refunded", collateralReleased:"Released", collateralRecoveryNeeded:"Recovery", borrowedLabel:"Borrowed", estimatedBorrow:"Estimated", estimatedBorrowNet:"Estimated net", available:"Available", availableBalance:"Balance", amountToLock:"Amount", addCollateral:"Add Collateral", repay:"Repay", borrowFlowBoard:"Board", docSubtitle:"Self-loan", note:"No interest", custodyTitle:"Custody", custodyBadge:"No voting", feature2Name:"Flexible", collateralPlan:"Plan", quickCollateral:"Quick", riskRoute:"Risk", selectedLTV:"LTV", ltvTier:"Tier", ltvLabel:"LTV", originationFee:"Fee", positionActive:"Active", loanStatus:"Loan", yourLoan:"Your Loan", safetyPreview:"Preview", poolAvailable:"Pool", availablePool:"Pool", yourBalance:"Balance", rateLabel:"Rate", rateFeeNote:"Operator rate", currentLTV:"Current", reclaimTools:"Recovery", reclaimCollateral:"Reclaim Collateral", reclaimRepayCredit:"Reclaim Repay", notAvailable:"N/A" }; return m[k] ?? k; }
function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  const b: Record<string, unknown> = {
    loan:null,
    neoBalance:"100",
    neoBalanceDisplay:"100",
    neoPrice:12,
    neoPriceBase:1200000000n,
    neoPriceDisplay:"12 GAS",
    poolGas:1000,
    poolDisplay:"1000",
    gasBalance:100,
    gasBalanceDisplay:"100",
    isConnected:true,
    hasActiveLoan:false,
    collateralAmount:"10",
    selectedLtv:2,
    selectedLtvPercent:30,
    ltvOptions:[
      { tier:1, percent:20, label:"Conservative", desc:"20% LTV" },
      { tier:2, percent:30, label:"Balanced", desc:"30% LTV" },
      { tier:3, percent:40, label:"Aggressive", desc:"40% LTV" },
    ],
    platformStats:{ platformFeeBps:50 },
    isLoading:false,
    isBorrowing:false,
    isRepaying:false,
    isAddingCollateral:false,
    isProcessing:false,
    isRefreshing:false,
    marketStatus:"ready",
    balancesStatus:"ready",
    positionStatus:"ready",
    recoveryStatus:"ready",
    marketReady:true,
    borrowDataReady:true,
    manageDataReady:true,
    collateralCredit:0,
    repayCredit:0,
    hasCollateralCredit:false,
    hasRepayCredit:false,
    ...o,
  };
  return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, createObservable(v)]));
}
describe("self-loan integration: dispatch params + state", () => {
  it("reviews exact live terms before dispatching the borrow", async () => {
    const dispatch = vi.fn().mockResolvedValue("confirmed");
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    expect(container.querySelector(".selfloan-review")).toBeTruthy();
    expect(dispatch).not.toHaveBeenCalledWith("borrow", expect.anything());

    fireEvent.click(container.querySelector(".selfloan-review__confirm") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("borrow", {
      collateralAmount: "10",
      ltvTier: 2,
      expectedPriceBase: "1200000000",
      expectedFeeBps: 50,
      expectedLtvBps: 3000,
      expectedDisbursedBase: "3582000000",
    }));
  });
  it("dispatches setCollateralAmount on input change", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    fireEvent.change(container.querySelector(".selfloan-asset-input input") as Element, { target: { value: "50" } });
    expect(dispatch).toHaveBeenCalledWith("setCollateralAmount", "50");
  });
  it("dispatches setLtvTier with contract tier value", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    fireEvent.click(container.querySelectorAll(".selfloan-tier-grid button")[0]);
    expect(dispatch).toHaveBeenCalledWith("setLtvTier", "1");
  });
  it("shows repay as the focused management mode for an active position", () => {
    const { container } = render(<PlayArea t={t} state={state({ hasActiveLoan:true, loan:{ active:true, borrowed:12, collateralLocked:50, ltvPercent:30 } })} dispatch={vi.fn()} />);
    expect(container.querySelector(".selfloan-manage")).toBeTruthy();
    expect(container.querySelector(".selfloan-manage__switch button.is-active")?.textContent).toContain("Repay");
  });
  it("switches the same primary composer to add collateral", () => {
    const { container } = render(<PlayArea t={t} state={state({ hasActiveLoan:true, loan:{ active:true, borrowed:12, collateralLocked:50, ltvPercent:30 } })} dispatch={vi.fn()} />);
    fireEvent.click(container.querySelectorAll(".selfloan-manage__switch button")[1]);
    expect(container.querySelector(".selfloan-manage__switch button.is-active")?.textContent).toContain("Collateral");
    expect(container.querySelector(".selfloan-asset-input input")?.getAttribute("inputmode")).toBe("numeric");
  });
});
