import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import { parseMiniAppLaunchContext } from "../utils/launch-params";
import PlayArea from "../../gas-lucky-pool/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    title: "OneGate Vault",
    subtitle: "Bounded random GAS rewards via OneGate QR",
    poolOverview: "Pool overview",
    activePools: "Active pools",
    claims: "Claims",
    createPoolTitle: "Create reward pool",
    claimPoolTitle: "Claim with OneGate",
    claimKey: "Claim key",
    inspectClaim: "Check reward",
    claimOnce: "Claim once",
    claimScannedKey: "Claim scanned reward",
    scanClaimReady: "OneGate scan detected",
    scanClaimPool: "Reward key is ready",
    scanClaimReview: "Submit the key and wallet address; the server sends GAS from the reward wallet.",
    noPoolSelected: "Enter a reward key or scan a OneGate QR code.",
    shareQr: "OneGate QR claim",
    oneGateReady: "OneGate ready",
    shareLink: "Claim link",
    totalPools: "Total pools",
    claimCongratsTitle: "Congratulations, your claim is in",
    claimCongratsBody: "Reward key {claimKey} awarded {amount} GAS.",
    luckPercentLabel: "Luck beat {percent}% of users.",
    claimedAmount: "Claimed {amount} GAS",
    totalAmount: "Total GAS",
    maxClaims: "Claim slots",
    minClaim: "Minimum claim",
    maxClaim: "Maximum claim",
    expiryHours: "Expiry hours",
    contractGuarded: "Contract guarded",
    createPool: "Create pool",
    gasCredit: "Recoverable GAS",
    gasCreditDescription: "Recover interrupted prepaid GAS.",
    checkGasCredit: "Check credit",
    withdrawGasCredit: "Withdraw credit",
    refundPool: "Recover remaining GAS",
    topUpAmount: "Top up amount",
    topUpPool: "Add GAS",
    refundCongratsTitle: "Remaining GAS returned",
    refundCongratsBody: "Pool #{poolId} returned {amount} GAS to the creator.",
    fundCongratsTitle: "Pool topped up",
    fundCongratsBody: "Pool #{poolId} received {amount} GAS.",
  };
  let value = messages[key] ?? key;
  for (const [paramKey, paramValue] of Object.entries(params ?? {})) {
    value = value.replaceAll(`{${paramKey}}`, String(paramValue));
  }
  return value;
}

function launch(claimKey = "ogv_test_key_1234567890") {
  return parseMiniAppLaunchContext(
    `https://neomini.app/miniapps/gas-lucky-pool/index.html?source=onegate&operation=claimPool&network=testnet&claimKey=${claimKey}`,
    "miniapp-gas-lucky-pool",
  );
}

function baseState(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    currentPoolId: "42",
    currentClaimKey: "ogv_test_key_1234567890",
    currentPool: null,
    recentPools: [],
    recentClaims: [],
    isCreating: false,
    isClaiming: false,
    isRefunding: false,
    isFunding: false,
    isLoading: false,
    isCreditLoading: false,
    isWithdrawingCredit: false,
    currentShareUrl: "",
    lastTxid: "",
    lastClaimAmount: 0n,
    lastClaimPoolId: "",
    lastClaimKey: "",
    lastClaimLuckPercent: "",
    lastRefundAmount: 0n,
    lastRefundPoolId: "",
    lastFundAmount: 0n,
    lastFundPoolId: "",
    lastSuccessType: "",
    lastError: "",
    gasCredit: 0n,
    activePoolCount: 0,
    claimCount: 0,
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("OneGate Vault PlayArea launch flow", () => {
  it("prefills the claim key from OneGate scan params and submits the backend claim", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    render(
      <PlayArea
        t={t}
        state={baseState()}
        dispatch={dispatch}
        launchContext={launch("ogv_test_key_1234567890")}
      />,
    );

    expect(screen.getByText("OneGate scan detected")).toBeTruthy();
    expect(screen.getByText("Reward key is ready")).toBeTruthy();
    expect((screen.getByLabelText("Claim key") as HTMLInputElement).value).toBe("ogv_test_key_1234567890");

    fireEvent.click(screen.getByRole("button", { name: "Claim scanned reward" }));

    expect(dispatch).toHaveBeenCalledWith("claimPool", { claimKey: "ogv_test_key_1234567890" });
  });

  it("shows a clear congratulations state after a successful claim", () => {
    render(
      <PlayArea
        t={t}
        state={baseState({
          lastTxid: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
          lastClaimAmount: 350000000n,
          lastClaimKey: "ogv_test_key_1234567890",
          lastClaimLuckPercent: "7.00",
          lastSuccessType: "claim",
        })}
        dispatch={vi.fn()}
        launchContext={launch("42")}
      />,
    );

    expect(screen.getByText("Congratulations, your claim is in")).toBeTruthy();
    expect(screen.getByText(/Reward key ogv_test_key_1234567890 awarded 3\.5[0-9]* GAS/)).toBeTruthy();
    expect(screen.getByText("Luck beat 7.00% of users.")).toBeTruthy();
    expect(screen.getByText(/Claimed 3\.5[0-9]* GAS/)).toBeTruthy();
  });

  it("lets the creator recover remaining GAS from an ended pool", () => {
    const dispatch = vi.fn();

    render(
      <PlayArea
        t={t}
        state={baseState({
          currentPool: {
            id: "42",
            creator: "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3",
            totalAmount: 1000000000n,
            minClaimAmount: 100000000n,
            maxClaimAmount: 500000000n,
            maxClaims: 5,
            claimedCount: 3,
            remainingAmount: 625000000n,
            bestLuckAddress: "",
            bestLuckAmount: 0n,
            expiryTime: 1767225600,
            active: false,
            status: "expired",
          },
          lastTxid: "0xrefund1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
          lastRefundAmount: 625000000n,
          lastRefundPoolId: "42",
          lastSuccessType: "refund",
        })}
        dispatch={dispatch}
        launchContext={launch("42")}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Recover remaining GAS" }));

    expect(dispatch).toHaveBeenCalledWith("refundPool", { poolId: "42" });
    expect(screen.getByText("Remaining GAS returned")).toBeTruthy();
    expect(screen.getAllByText(/Pool #42 returned 6\.25[0-9]* GAS to the creator/).length).toBeGreaterThan(0);
  });

  it("lets the creator add more GAS to an active pool", () => {
    const dispatch = vi.fn();

    render(
      <PlayArea
        t={t}
        state={baseState({
          currentPool: {
            id: "42",
            creator: "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3",
            totalAmount: 1000000000n,
            minClaimAmount: 100000000n,
            maxClaimAmount: 500000000n,
            maxClaims: 5,
            claimedCount: 2,
            remainingAmount: 425000000n,
            bestLuckAddress: "",
            bestLuckAmount: 0n,
            expiryTime: 1767225600,
            active: true,
            status: "active",
          },
          lastTxid: "0xfund1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
          lastFundAmount: 250000000n,
          lastFundPoolId: "42",
          lastSuccessType: "fund",
        })}
        dispatch={dispatch}
        launchContext={launch("42")}
      />,
    );

    fireEvent.change(screen.getByLabelText("Top up amount"), { target: { value: "2.5" } });
    fireEvent.click(screen.getByRole("button", { name: "Add GAS" }));

    expect(dispatch).toHaveBeenCalledWith("topUpPool", { poolId: "42", amount: "2.5" });
    expect(screen.getByText("Pool topped up")).toBeTruthy();
    expect(screen.getAllByText(/Pool #42 received 2\.5[0-9]* GAS/).length).toBeGreaterThan(0);
  });

  it("keeps the OneGate QR below the claim controls instead of a standalone column", () => {
    render(
      <PlayArea
        t={t}
        state={baseState()}
        dispatch={vi.fn()}
        launchContext={launch("42")}
      />,
    );

    expect(screen.queryByRole("region", { name: "OneGate QR claim" })).toBeNull();
    expect(screen.getByRole("button", { name: "Claim link" })).toBeTruthy();
    expect(screen.getByTestId("onegate-qr-logo")).toBeTruthy();
  });
});
