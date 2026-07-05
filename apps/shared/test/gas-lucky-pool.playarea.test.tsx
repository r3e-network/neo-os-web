import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import { parseMiniAppLaunchContext } from "../utils/launch-params";
import PlayArea from "../../gas-lucky-pool/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function playAreaStyles(app: string): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return readFileSync(path.join(appsRoot, app, "src/PlayArea.scss"), "utf8");
}

function playAreaSource(app: string): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return readFileSync(path.join(appsRoot, app, "src/PlayArea.tsx"), "utf8");
}

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    vaultName: "OneGate Vault",
    workspaceHeroEyebrow: "Campaign owner",
    createPoolTitle: "Create reward pool",
    createPoolDescription: "Configure 1-50 GAS rewards.",
    createPool: "Create Pool",
    creatingPool: "Creating...",
    rewardMachineDraft: "Set amount and slots to charge the vault",
    rewardMachineReady: "Vault charged and ready",
    rewardRangeDefault: "1-50 GAS",
    rewardRange: "Reward range",
    rewardRouteCharge: "Charge",
    rewardRouteSplit: "Split",
    rewardRouteScan: "Scan",
    rewardRouteUnwrap: "Unwrap",
    rewardPlanTitle: "Reward plan",
    rewardPresetCta: "Choose a reward package",
    rewardPresetHint: "Pick a preset now. Fine-tune amount, slots, range, and expiry in Manage.",
    claimRangeSmall: "Small",
    claimRangeBalanced: "Balanced",
    claimRangeJackpot: "Jackpot",
    claimRangeHint: "Reward range",
    totalAmount: "Total GAS",
    decreaseTotalAmount: "Decrease total GAS",
    increaseTotalAmount: "Increase total GAS",
    maxClaims: "Claim slots",
    decreaseMaxClaims: "Decrease claim slots",
    increaseMaxClaims: "Increase claim slots",
    expiryHours: "Expiry hours",
    expiryHoursHint: "When the offer closes",
    rewardExpiryHours: "{hours}h",
    rewardSlotsCount: "{count} slots",
    rewardSlotsUnset: "— slots",
    rewardPoolUnset: "— GAS",
    claimPoolTitle: "Claim Reward",
    claimPoolDescription: "Enter your claim key to receive GAS.",
    claimReward: "Claim Reward",
    claimCongratsTitle: "Congratulations!",
    claimCongratsBody: "Reward paid.",
    claimAmountLabel: "Reward",
    claimKeyLabel: "Claim key",
    claimNetworkLabel: "Network",
    claimProgressSubmitting: "Submitting...",
    luckPercentLabel: "Luck",
    networkMainnet: "Mainnet",
    networkTestnet: "Testnet",
    viewOnExplorer: "View on explorer",
    manageExistingTitle: "Manage pools",
    managePoolShort: "Manage",
    poolControlsTitle: "Pool controls",
    poolControlsHint: "Inspect, top up, or refund.",
    poolIdLabel: "Pool ID",
    poolIdPlaceholder: "Pool id",
    inspectPool: "Inspect",
    refundPool: "Refund",
    topUpAmount: "Top-up amount",
    topUpPool: "Top up",
    gasCreditTitle: "GAS credit",
    gasCreditDescription: "Check or withdraw credit.",
    gasCredit: "Credit",
    checkGasCredit: "Check credit",
    withdrawGasCredit: "Withdraw",
    howItWorks: "How it works",
    oneGateReady: "OneGate ready",
    contractGuarded: "Server guarded",
    shareQr: "OneGate QR claim",
    safetyModel: "Safety model",
    oneGateFlow: "OneGate flow",
    distributionPathsTitle: "Two ways to distribute",
    pathOnChain: "On-chain pool.",
    docHowItWorks: "How it works.",
    docSafetyModel: "Safety model.",
    docOneGateFlow: "OneGate flow.",
  };
  let value = messages[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) value = value.replaceAll(`{${k}}`, String(v));
  return value;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    currentClaimKey: "",
    currentPoolId: "",
    currentRange: "1-50 GAS",
    lastTxid: "",
    lastClaimAmount: 0n,
    lastClaimKey: "",
    lastClaimLuckPercent: "",
    claimStatus: "",
    claimProgress: "",
    isClaiming: false,
    isCreating: false,
    isLoading: false,
    isFunding: false,
    isRefunding: false,
    isCreditLoading: false,
    isWithdrawingCredit: false,
    gasCredit: 0n,
    lastSuccessType: "",
    lastError: "",
    ...overrides,
  };
  return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, createObservable(v)]));
}

function claimLaunch(claimKey: string) {
  return parseMiniAppLaunchContext(
    `https://onegate.space/app/23?source=onegate&operation=claimOneGateVault&key=${claimKey}&network=testnet`,
    "miniapp-gas-lucky-pool",
  );
}
function creatorLaunch() {
  return parseMiniAppLaunchContext(
    "https://neomini.app/miniapps/gas-lucky-pool/index.html?network=testnet",
    "miniapp-gas-lucky-pool",
  );
}

describe("OneGate Vault PlayArea (v2 scene-driven)", () => {
  it("renders the creator workspace with the vault scene", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} launchContext={creatorLaunch()} />);
    expect(container.querySelector(".vault-scene")).toBeTruthy();
    expect(container.querySelector(".vault-scene__vault-art")?.getAttribute("src")).toContain("gas-vault-stage.webp");
    expect(container.querySelector(".vault-scene__stage-art")).toBeNull();
    expect(container.querySelector(".vault-scene__wash")).toBeNull();
    expect(container.querySelector(".vault-scene__chest")).toBeFalsy();
    expect(container.querySelector(".vault-controls__input")).toBeFalsy();
    expect(container.querySelector(".gas-pool-playstage--creator")).toBeTruthy();
    expect(container.querySelector(".vault-plan-card")).toBeTruthy();
    expect(container.querySelectorAll(".vault-plan-card__coin")).toHaveLength(3);
    expect(container.querySelector(".vault-stepper")).toBeFalsy();
    expect(container.querySelector(".vault-drawer__advanced")).toBeFalsy();
    expect(container.querySelector(".mx2-btn--primary")).toBeTruthy();
  });

  it("dispatches createPool from a reward plan card without a form-style amount input", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} launchContext={creatorLaunch()} />);

    const balancedPlan = container.querySelectorAll(".vault-plan-card")[1];
    fireEvent.click(balancedPlan);

    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith(
        "createPool",
        expect.objectContaining({
          totalAmount: "50",
          minClaim: "1",
          maxClaim: "5",
          maxClaims: "25",
          expiryHours: "72",
        }),
      ),
    );
  });

  it("renders the claim screen on a OneGate claim-key launch", () => {
    const { container } = render(
      <PlayArea t={t} state={state()} dispatch={vi.fn()} launchContext={claimLaunch("ogv_test_key_1234567890")} />,
    );
    // Claim screen shows the vault scene + claim-key readout.
    expect(container.querySelector(".vault-scene")).toBeTruthy();
    expect(container.querySelector(".vault-scene__vault-art")?.getAttribute("src")).toContain("gas-vault-stage.webp");
    expect(container.querySelector(".vault-scene__stage-art")).toBeNull();
    expect(container.querySelector(".vault-scene__wash")).toBeNull();
    expect(container.querySelector(".gas-pool-playstage--claim")).toBeTruthy();
    expect(container.textContent).toContain("Claim Reward");
  });

  it("dispatches claimPool on the claim screen", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea t={t} state={state()} dispatch={dispatch} launchContext={claimLaunch("ogv_test_key_1234567890")} />,
    );
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith("claimPool", expect.objectContaining({ claimKey: "ogv_test_key_1234567890" })),
    );
  });

  it("shows the success state when a claim is paid", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          lastSuccessType: "claim",
          claimStatus: "paid",
          lastTxid: "0xabc123",
          lastClaimAmount: 500000000n,
          lastClaimLuckPercent: "72",
        })}
        dispatch={vi.fn()}
        launchContext={claimLaunch("ogv_test_key_1234567890")}
      />,
    );
    expect(container.querySelector('.vault-scene[data-state="success"]')).toBeTruthy();
    expect(container.textContent).toContain("Congratulations");
  });

  it("keeps secondary creator tools behind drawer modes", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByText } = render(<PlayArea t={t} state={state()} dispatch={dispatch} launchContext={creatorLaunch()} />);

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.querySelector(".mx2-drawer--open")).toBeTruthy();
    expect(container.querySelectorAll(".vault-drawer-tabs__group .semi-radio")).toHaveLength(4);
    expect(container.querySelector(".vault-drawer-tabs__group .semi-radio-checked .vault-drawer-tab")?.textContent).toBe("Reward plan");
    expect(container.querySelector(".vault-drawer__advanced")).toBeTruthy();
    expect(container.querySelector(".vault-stepper")).toBeTruthy();
    expect(container.querySelector(".vault-drawer-panel--pool")).toBeFalsy();
    expect(container.querySelector(".vault-drawer__input")).toBeFalsy();
    expect(container.querySelector(".mx2-drawer__body h4")).toBeFalsy();

    fireEvent.click(getByText("Pool controls"));
    await waitFor(() => expect(container.querySelector(".vault-drawer-panel--pool")).toBeTruthy());
    expect(container.querySelector(".vault-drawer-tabs__group .semi-radio-checked .vault-drawer-tab")?.textContent).toBe("Pool controls");
    expect(container.querySelector(".vault-drawer__advanced")).toBeFalsy();
    expect(container.querySelector(".vault-drawer-field--pool input.semi-input")).toBeTruthy();
    expect(container.querySelector(".vault-drawer-field--topup input.semi-input")).toBeTruthy();

    fireEvent.change(container.querySelector(".vault-drawer-field--pool input") as HTMLInputElement, { target: { value: "42" } });
    fireEvent.click(getByText("Inspect"));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("loadPool", { poolId: "42" }));

    fireEvent.click(getByText("GAS credit"));
    await waitFor(() => expect(container.querySelector(".vault-drawer-panel--credit")).toBeTruthy());
    expect(container.querySelector(".vault-drawer-panel--pool")).toBeFalsy();
    fireEvent.click(getByText("Check credit"));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("loadGasCredit"));

    fireEvent.click(getByText("How it works"));
    await waitFor(() => expect(container.querySelector(".vault-drawer-panel--docs")).toBeTruthy());
    expect(container.textContent).toContain("Safety model.");
  });

  it("keeps motion backed by reduced-motion fallbacks", () => {
    const styles = playAreaStyles("gas-lucky-pool");
    const source = playAreaSource("gas-lucky-pool");
    expect(styles).toContain("@use \"@shared/styles/v2/motion\"");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toContain("vaultCoinFlight");
    expect(styles).not.toContain("vault-scene__chest");
    expect(styles).not.toContain("vault-scene__stage-art");
    expect(styles).not.toContain("vault-scene__wash");
    expect(styles).toMatch(/\.vault-scene__vault-shell\s*\{[\s\S]*aspect-ratio:\s*4\s*\/\s*3/);
    expect(styles).toMatch(/\.vault-scene__vault-shell\s*\{[\s\S]*overflow:\s*hidden/);
    expect(styles).toMatch(/\.vault-scene__vault-shell\s*\{[\s\S]*background:\s*var\(--mx2-surface-2\)/);
    expect(styles).toMatch(/\.vault-scene__vault-art\s*\{[\s\S]*object-fit:\s*contain/);
    expect(styles).toMatch(/\.vault-scene__vault-art\s*\{[\s\S]*object-position:\s*center/);
    expect(styles).toMatch(/\.vault-scene__vault-art\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.vault-scene__vault-art\s*\{[\s\S]*opacity:\s*1/);
    expect(styles).toMatch(/\.vault-scene__vault-art\s*\{[\s\S]*filter:\s*none/);
    expect(styles).toMatch(/\.vault-scene__vault-art\s*\{[\s\S]*transform:\s*none/);
    expect(styles).not.toMatch(/\.vault-scene__vault-art\s*\{[^}]*object-fit:\s*cover/);
    expect(styles).not.toMatch(/\.vault-scene__vault-art\s*\{[^}]*transform:\s*scale/);
    expect(styles).toMatch(/\.vault-scene\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.vault-scene\s*\{[\s\S]*box-shadow:\s*none/);
    expect(styles).toMatch(/\.vault-plan-card\s*\{[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\)/);
    expect(styles).toMatch(/\.vault-plan-card\s*\{[\s\S]*min-height:\s*78px/);
    expect(styles).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.gas-pool-playstage--creator \.vault-plan-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.gas-pool-playstage--creator \.vault-plan-card\s*\{[\s\S]*min-height:\s*84px/);
    expect(styles).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.gas-pool-playstage--creator \.mx2-score\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.gas-pool-playstage--creator \.mx2-action-rail__row\s*\{[\s\S]*display:\s*grid/);
    expect(styles).toMatch(/\.vault-plan-card__coin\s*\{[\s\S]*background:\s*#fffbeb/);
    expect(styles).toMatch(/\.vault-plan-card--active\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.vault-plan-card--active\s*\{[\s\S]*box-shadow:\s*inset 4px 0 0 #14b8a6/);
    expect(styles).toMatch(/\.vault-drawer-grid\s*\{[\s\S]*align-content:\s*start/);
    expect(styles).toMatch(/\.vault-drawer-tabs__group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.vault-drawer-tabs__group \.semi-radio-checked \.vault-drawer-tab\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.vault-controls__presets \.semi-radio-checked \.vault-preset\s*\{[\s\S]*background:\s*#0f766e/);
    expect(styles).toMatch(/\.vault-controls__presets \.semi-radio-checked \.vault-preset \*\s*\{[\s\S]*color:\s*#ffffff !important/);
    expect(styles).toMatch(/\.vault-controls__presets--range\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.vault-preset--range\s*\{[\s\S]*min-width:\s*0/);
    expect(styles).toMatch(/\.vault-drawer__chips \.semi-radio-checked \.vault-drawer__chip\s*\{[\s\S]*background:\s*#0f766e/);
    expect(styles).toMatch(/\.vault-drawer-panel\.mx2-open-panel\.semi-card\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.vault-drawer-field-row\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*0\.9fr\)\s*minmax\(0,\s*1\.1fr\)/);
    expect(styles).toMatch(/\.vault-drawer-field \.mx2-open-field__control\.semi-input-wrapper\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).not.toContain(".vault-drawer__input");
    expect(styles).not.toContain("blur(1px)");
    expect(styles).not.toContain("backdrop-filter");
    expect(styles).not.toMatch(/vault-plan-card[\s\S]*radial-gradient/);
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration:\s*0\.001ms/);
    expect(source).toContain("OpenUiSegmented");
    expect(source).not.toMatch(/<(input|textarea|select)\b/);
    expect(source).not.toContain('role="tab"');
    expect(source).not.toContain('role="tablist"');
    expect(source).not.toContain('role="radio"');
    expect(source).not.toContain('role="radiogroup"');
    expect(source).not.toContain("vault-preset--active");
    expect(source).not.toContain("vault-drawer__chip--active");
  });
});
