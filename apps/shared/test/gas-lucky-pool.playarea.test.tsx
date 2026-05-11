import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
    claimReward: "Claim Reward",
    scanClaimReady: "OneGate scan detected",
    scanClaimPool: "Reward key is ready",
    scanClaimReview:
      "Submit the key and wallet address; the server sends GAS from the reward wallet.",
    rewardRange: "1-50",
    noPoolSelected: "Enter a reward key or scan a OneGate QR code.",
    claimConsoleHint: "Primary action lives in the right action console.",
    claimProgressTitle: "Claim progress",
    claimProgressWallet: "Wallet ready",
    claimProgressSubmitting: "Submitting claim",
    claimProgressConfirming: "Waiting for GAS transfer",
    claimProgressPaid: "GAS received",
    claimProgressFailed: "Claim needs retry",
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
    `https://onegate.space/app/23?key=${claimKey}&pool=pool-001&network=testnet`,
    "miniapp-gas-lucky-pool",
  );
}

function launchWithOperation(
  operation: string,
  claimKey = "ogv_test_key_1234567890",
) {
  return parseMiniAppLaunchContext(
    `https://neomini.app/miniapps/gas-lucky-pool/index.html?source=onegate&operation=${operation}&network=testnet&claimKey=${claimKey}`,
    "miniapp-gas-lucky-pool",
  );
}

function baseState(
  overrides: Partial<Record<string, unknown>> = {},
): ObservableState {
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
    claimStatus: "",
    claimProgress: "",
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
    Object.entries(values).map(([key, value]) => [
      key,
      createObservable(value),
    ]),
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
    expect(screen.getByRole("heading", { name: "Claim Reward" })).toBeTruthy();
    expect(screen.queryByLabelText("Claim key")).toBeNull();
    expect(screen.queryByText("Create reward pool")).toBeNull();
    expect(screen.queryByText("OneGate QR claim")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Claim Reward" }));
    expect(dispatch).toHaveBeenCalledWith("claimPool", {
      claimKey: "ogv_test_key_1234567890",
      poolId: "pool-001",
      oneGateAppId: "",
      appId: "miniapp-gas-lucky-pool",
    });
  });

  it("treats the legacy OneGate Vault operation name as a claim launch", () => {
    render(
      <PlayArea
        t={t}
        state={baseState()}
        dispatch={vi.fn()}
        launchContext={launchWithOperation("claimOneGateVault")}
      />,
    );

    expect(screen.getByText("OneGate scan detected")).toBeTruthy();
    expect(screen.queryByText("Create reward pool")).toBeNull();
  });

  it("shows an explicit waiting state while the backend payout is pending", () => {
    render(
      <PlayArea
        t={t}
        state={baseState({
          isClaiming: true,
          claimStatus: "submitted",
          claimProgress: "confirming",
        })}
        dispatch={vi.fn()}
        launchContext={launch("ogv_test_key_1234567890")}
      />,
    );

    expect(screen.getByText("Claim progress")).toBeTruthy();
    expect(
      screen.getAllByText("Waiting for GAS transfer").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Wallet ready")).toBeTruthy();
    expect(screen.getByText("Submitting claim")).toBeTruthy();
    expect(screen.queryByText("Congratulations, your claim is in")).toBeNull();
  });

  it("shows a clear congratulations state after a successful claim", () => {
    render(
      <PlayArea
        t={t}
        state={baseState({
          lastTxid:
            "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
          lastClaimAmount: 350000000n,
          lastClaimKey: "ogv_test_key_1234567890",
          lastClaimLuckPercent: "7.00",
          claimStatus: "paid",
          lastSuccessType: "claim",
        })}
        dispatch={vi.fn()}
        launchContext={launch("ogv_test_key_1234567890")}
      />,
    );

    expect(screen.getByText("Congratulations, your claim is in")).toBeTruthy();
    expect(
      screen.getByText(
        /Reward key ogv_tes\.\.\.7890 awarded 3\.5[0-9]* GAS/,
      ),
    ).toBeTruthy();
    expect(screen.getByText("Luck beat 7.00% of users.")).toBeTruthy();
    expect(screen.getByText(/Claimed 3\.5[0-9]* GAS/)).toBeTruthy();
  });

  it("does not expose legacy pool management controls in the recipient play area", () => {
    render(
      <PlayArea
        t={t}
        state={baseState()}
        dispatch={vi.fn()}
        launchContext={launch("ogv_test_key_1234567890")}
      />,
    );

    expect(screen.queryByText("Create reward pool")).toBeNull();
    expect(screen.queryByText("Recover remaining GAS")).toBeNull();
    expect(screen.queryByText("Add GAS")).toBeNull();
    expect(screen.queryByText("Claim link")).toBeNull();
  });
});
