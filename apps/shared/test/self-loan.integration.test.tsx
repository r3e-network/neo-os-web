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
    neoPriceDisplay:"12 GAS",
    poolGas:1000,
    poolDisplay:"1000",
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
    ...o,
  };
  return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, createObservable(v)]));
}
describe("self-loan integration: dispatch params + state", () => {
  it("dispatches borrow with collateral payload on primary action", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("borrow", { collateralAmount: "10", ltvTier: 2 }));
  });
  it("dispatches setCollateralAmount on input change", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    fireEvent.change(container.querySelector(".selfloan-amount-input") as Element, { target: { value: "50" } });
    expect(dispatch).toHaveBeenCalledWith("setCollateralAmount", "50");
  });
  it("dispatches setLtvTier with contract tier value", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    fireEvent.click(container.querySelectorAll(".selfloan-tier-card")[0]);
    expect(dispatch).toHaveBeenCalledWith("setLtvTier", "1");
  });
  it("shows repay secondary action when hasActiveLoan", () => {
    const { container } = render(<PlayArea t={t} state={state({ hasActiveLoan:true, loan:{ active:true, borrowed:12, collateralLocked:50, ltvPercent:30 } })} dispatch={vi.fn()} />);
    const repayBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("Repay"));
    expect(repayBtn).toBeTruthy();
  });
  it("shows addCollateral secondary action when hasActiveLoan", () => {
    const { container } = render(<PlayArea t={t} state={state({ hasActiveLoan:true, loan:{ active:true, borrowed:12, collateralLocked:50, ltvPercent:30 } })} dispatch={vi.fn()} />);
    const addBtn = Array.from(container.querySelectorAll("button")).find((b) => b.textContent?.includes("Collateral"));
    expect(addBtn).toBeTruthy();
  });
});
