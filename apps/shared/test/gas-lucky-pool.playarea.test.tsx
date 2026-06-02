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
    ownerWorkspaceTitle: "Reward pool workspace",
    createPoolTitle: "Create reward pool",
    createPoolDescription:
      "Campaign owners configure 1-50 GAS rewards and single-use claim keys in the backend, then distribute OneGate QR codes.",
    claimPoolTitle: "Claim with OneGate",
    claimKey: "Claim key",
    poolId: "Pool ID",
    inspectClaim: "Check reward",
    inspectPool: "Inspect pool",
    claimOnce: "Claim once",
    claimReward: "Claim Reward",
    scanClaimReady: "OneGate scan detected",
    scanClaimPool: "Reward key is ready",
    scanClaimReview:
      "Submit the key and wallet address; the server sends GAS from the reward wallet.",
    rewardRange: "1-50",
    noPoolSelected: "Enter a reward key or scan a OneGate QR code.",
    claimConsoleHint: "Primary action lives in the right action console.",
    docOneGateFlow:
      "The claim QR opens OneGate app 23 directly and only carries key, pool, and network.",
    claimProgressTitle: "Claim progress",
    claimProgressWallet: "Wallet ready",
    claimProgressSubmitting: "Submitting claim",
    claimProgressConfirming: "Waiting for GAS transfer",
    claimProgressPaid: "GAS received",
    claimProgressFailed: "Claim needs retry",
    claimSubmitted: "Reward payout submitted",
    claimPaid: "Reward paid",
    claimFailed: "Claim failed.",
    shareQr: "OneGate QR claim",
    oneGateReady: "OneGate ready",
    shareLink: "Claim link",
    totalPools: "Total pools",
    claimCongratsTitle: "Congratulations, your claim is in",
    claimCongratsBody: "Reward key {claimKey} awarded {amount} GAS.",
    luckPercentLabel: "Luck beat {percent}% of users.",
    claimedAmount: "Claimed {amount} GAS",
    claimReceiptTitle: "Claim receipt",
    claimAmountLabel: "Reward",
    claimKeyLabel: "Claim key",
    claimNetworkLabel: "Network",
    networkMainnet: "Neo N3 MainNet",
    networkTestnet: "Neo N3 TestNet",
    transactionIdLabel: "Transaction ID",
    totalAmount: "Total GAS",
    maxClaims: "Claim slots",
    minClaim: "Minimum claim",
    maxClaim: "Maximum claim",
    expiryHours: "Expiry hours",
    contractGuarded: "Contract guarded",
    perAddressOnce: "One claim per address per pool",
    createPool: "Create pool",
    creatingPool: "Creating pool",
    gasCredit: "Recoverable GAS",
    gasCreditTitle: "Recover prepaid GAS",
    gasCreditDescription: "Recover interrupted prepaid GAS.",
    checkGasCredit: "Check credit",
    checkingGasCredit: "Checking credit",
    withdrawGasCredit: "Withdraw credit",
    withdrawingGasCredit: "Withdrawing credit",
    refundPool: "Recover remaining GAS",
    recoveringGas: "Recovering GAS",
    poolControlsTitle: "Pool controls",
    poolStateEmpty: "Enter a pool id and inspect it to load live pool state.",
    poolNotSelected: "No pool selected",
    recentPoolsTitle: "Recent pools",
    recentPoolsEmpty: "No recent pool events found yet.",
    recentClaimsTitle: "Recent claims",
    recentClaimsEmpty: "No recent claim events found yet.",
    claimedSlots: "Claimed slots",
    topUpAmount: "Top up amount",
    topUpPool: "Add GAS",
    addingGas: "Adding GAS",
    loadingPool: "Loading pool",
    refundCongratsTitle: "Remaining GAS returned",
    refundCongratsBody: "Pool #{poolId} returned {amount} GAS to the creator.",
    fundCongratsTitle: "Pool topped up",
    fundCongratsBody: "Pool #{poolId} received {amount} GAS.",
    campaignOwnerTitle: "Campaign owner setup",
    campaignOwnerStep1:
      "Create the campaign in the backend and fund the server payout wallet.",
    campaignOwnerStep2:
      "Generate one independent claim key per recipient and embed it in the OneGate QR code.",
    campaignOwnerStep3:
      "Recipients scan, claim once, then this dApp watches the payout and shows the result.",
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

function regularLaunch() {
  return parseMiniAppLaunchContext(
    "https://neomini.app/miniapps/gas-lucky-pool/index.html?network=testnet",
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

  it("keeps OneGate claim failures inside the claim card with diagnostics separated", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={baseState({
          claimStatus: "failed",
          claimProgress: "failed",
          lastError: "OneGate address missing.\n[ogvdiag v=2 provider=none]",
        })}
        dispatch={vi.fn()}
        launchContext={launch("ogv_test_key_1234567890")}
      />,
    );

    expect(screen.getByRole("alert").textContent).toContain(
      "OneGate address missing.",
    );
    expect(screen.getByText("[ogvdiag v=2 provider=none]")).toBeTruthy();
    expect(screen.queryByText("GAS received")).toBeNull();
    expect(container.querySelector(".gas-pool-toast")).toBeNull();
  });

  it("shows a clear congratulations state after a successful claim", () => {
    render(
      <PlayArea
        t={t}
        state={baseState({
          lastTxid:
            "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
          lastClaimAmount: 350000001n,
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
    expect(screen.getByText("3.50000001 GAS")).toBeTruthy();
    expect(screen.getByText("Luck beat 7.00% of users.")).toBeTruthy();
    expect(screen.getByText("Transaction ID")).toBeTruthy();
    expect(
      screen.getByText(
        "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
      ),
    ).toBeTruthy();
    expect(screen.getByText("Neo N3 TestNet")).toBeTruthy();
    expect(screen.queryByText(/Claimed 3\.5[0-9]* GAS/)).toBeNull();
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

  it("exposes creator and pool management actions outside the OneGate claim-only launch", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    const { container } = render(
      <PlayArea
        t={t}
        state={baseState({
          currentClaimKey: "",
          currentPoolId: "42",
          gasCredit: 150000000n,
          poolCount: 1,
          activePoolCount: 1,
          totalRemaining: 500000000n,
        })}
        dispatch={dispatch}
        launchContext={regularLaunch()}
      />,
    );

    expect(
      screen.getByRole("region", { name: "Reward pool workspace" }),
    ).toBeTruthy();
    expect(screen.getByText("Create reward pool")).toBeTruthy();
    expect(screen.getByText("Pool controls")).toBeTruthy();
    expect(container.textContent).not.toContain("inspectPool");
    expect(container.textContent).not.toContain("gasCreditTitle");

    fireEvent.change(screen.getByLabelText("Total GAS"), {
      target: { value: "12" },
    });
    fireEvent.change(screen.getByLabelText("Claim slots"), {
      target: { value: "4" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create pool" }));
    expect(dispatch).toHaveBeenCalledWith("createPool", {
      totalAmount: "12",
      minClaim: "1",
      maxClaim: "5",
      maxClaims: "4",
      expiryHours: "24",
    });

    fireEvent.click(screen.getByRole("button", { name: "Inspect pool" }));
    expect(dispatch).toHaveBeenCalledWith("loadPool", { poolId: "42" });

    fireEvent.change(screen.getByLabelText("Top up amount"), {
      target: { value: "2.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add GAS" }));
    expect(dispatch).toHaveBeenCalledWith("topUpPool", {
      poolId: "42",
      amount: "2.5",
    });

    fireEvent.click(screen.getByRole("button", { name: "Recover remaining GAS" }));
    expect(dispatch).toHaveBeenCalledWith("refundPool", { poolId: "42" });

    fireEvent.click(screen.getByRole("button", { name: "Check credit" }));
    expect(dispatch).toHaveBeenCalledWith("loadGasCredit");

    fireEvent.click(screen.getByRole("button", { name: "Withdraw credit" }));
    expect(dispatch).toHaveBeenCalledWith("withdrawGasCredit");
  });

  it("uses action-specific working copy in the creator workspace", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={baseState({
          currentClaimKey: "",
          currentPoolId: "42",
          gasCredit: 150000000n,
          isCreating: true,
          isFunding: true,
          isRefunding: true,
          isLoading: true,
          isCreditLoading: true,
          isWithdrawingCredit: true,
        })}
        dispatch={vi.fn()}
        launchContext={regularLaunch()}
      />,
    );

    expect(screen.getByRole("button", { name: "Creating pool" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Loading pool" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Adding GAS" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Recovering GAS" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Checking credit" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Withdrawing credit" }),
    ).toBeTruthy();
    expect(container.textContent).not.toContain("Legacy Pool ID");
    expect(container.textContent).not.toContain("Waiting for GAS transfer");
  });

  it("keeps a manual claim inside the regular creator workspace after success", () => {
    render(
      <PlayArea
        t={t}
        state={baseState({
          currentClaimKey: "ogv_browser_claim_001",
          currentPoolId: "42",
          lastTxid:
            "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcd",
          lastClaimAmount: 350000000n,
          lastClaimKey: "ogv_browser_claim_001",
          lastClaimLuckPercent: "7.00",
          claimStatus: "paid",
          lastSuccessType: "claim",
        })}
        dispatch={vi.fn()}
        launchContext={regularLaunch()}
      />,
    );

    expect(
      screen.getByRole("region", { name: "Reward pool workspace" }),
    ).toBeTruthy();
    expect(screen.getByText("Reward paid")).toBeTruthy();
    expect(
      screen.queryByText("Congratulations, your claim is in"),
    ).toBeNull();
  });
});
