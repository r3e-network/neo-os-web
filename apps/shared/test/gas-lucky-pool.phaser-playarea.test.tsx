import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";

import { createObservable, type ObservableState } from "../react/context";
import { parseMiniAppLaunchContext } from "../utils/launch-params";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const mocks = vi.hoisted(() => ({
  phaserGame: vi.fn(),
}));

vi.mock("@framework/phaser/LazyPhaserGameComponent", () => {
  return {
    LazyPhaserGameComponent: (props: unknown) => {
      mocks.phaserGame(props);
      return <div data-testid="gas-lucky-pool-phaser-host" />;
    },
  };
});

import PhaserPlayArea from "../../gas-lucky-pool/src/PhaserPlayArea";

afterEach(() => {
  cleanup();
  mocks.phaserGame.mockClear();
});

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    appEyebrow: "OneGate Vault",
    appTitle: "GAS Lucky Pool",
    appSubtitle: "Pack a vault, share the link, and let GAS land.",
    active: "Active",
    activePools: "Active pools",
    activityTab: "Activity",
    bestLuck: "Best luck",
    checkGasCredit: "Check credit",
    claimAmountLabel: "Reward",
    claimedAmount: "Claimed {amount} GAS",
    claimPoolDescription: "Scan or open a QR link.",
    claimPoolTitle: "Claim with OneGate",
    claimProgressPaid: "GAS received",
    claimProgressFailed: "Claim needs retry",
    claimProgressTitle: "Claim progress",
    claims: "Claims",
    closeDrawer: "Close guide",
    copied: "Copied",
    docHowItWorks: "Backend generates one-use claim keys.",
    docOneGateFlow: "OneGate injects the wallet and opens the dApp.",
    docSafetyModel: "The frontend never decides the reward amount.",
    drawerTitle: "Rules",
    gasCredit: "Credit",
    gasCreditDescription: "Recover stuck prepaid GAS.",
    gasCreditTitle: "Recover prepaid GAS",
    gasCreditWithdrawn: "GAS credit withdrawal submitted",
    howItWorks: "OneGate claim links route through the guarded backend and contract.",
    inspectClaim: "Check reward",
    inspectPool: "Inspect",
    luckPercentLabel: "Luck beat {percent}% of users.",
    oneGateFlow: "OneGate flow",
    perAddressOnce: "One claim per address",
    poolControlsHint: "Inspect, top up, or recover a pool.",
    poolCreated: "Pool creation submitted",
    poolIdLabel: "Pool ID",
    poolOverview: "Pool overview",
    refundCongratsBody: "Pool #{poolId} returned {amount} GAS.",
    refundPool: "Recover remaining GAS",
    remainingGas: "Remaining GAS",
    rewardRangeDefault: "1-5 GAS",
    rewardRange: "Reward range",
    safetyModel: "Safety model",
    serverPaysNote: "Verify payout on-chain after claiming.",
    shareLink: "Claim link",
    topUpAmount: "Top-up amount",
    topUpPool: "Add GAS",
    totalPools: "Total pools",
    transactionIdLabel: "Transaction ID",
    unknown: "Unknown",
    viewOnExplorer: "View on explorer",
    vaultCanvasAria: "OneGate GAS vault game",
    vaultCanvasLoading: "Opening vault",
    vaultPackStarter: "Starter",
    vaultPackParty: "Party",
    vaultPackJackpot: "Jackpot",
    guestActionDraw: "Draw",
    guestA11yControls: "Keyboard draw controls",
    guestCanvasAria: "Local lucky draw game",
    guestChooseTier: "Choose a luck tier",
    guestDrawResult: "You drew {amount} pts — {luck}% luck!",
    guestDrawerTitle: "Play & scores",
    gameFiMaintenanceShort: "GameFi validation in progress",
    claimLinkPreserved: "The claim link stays preserved and is not replaced by a local draw.",
    claimLinkHeldShort: "Claim link held · GameFi paused",
    guestUnit: "pts",
    withdrawGasCredit: "Withdraw credit",
  };
  let value = messages[key] ?? key;
  if (params) {
    for (const [paramKey, paramValue] of Object.entries(params)) {
      value = value.replaceAll(`{${paramKey}}`, String(paramValue));
    }
  }
  return value;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    claimProgress: "",
    claimStatus: "",
    currentClaimKey: "",
    currentPoolId: "",
    currentRange: "",
    isClaiming: false,
    isCreating: false,
    isCreditLoading: false,
    isFunding: false,
    isLoading: false,
    isRefunding: false,
    isWithdrawingCredit: false,
    lastClaimAmount: 0n,
    lastClaimKey: "",
    lastClaimLuckPercent: "",
    lastClaimPoolId: "",
    lastError: "",
    lastFundAmount: 0n,
    lastFundPoolId: "",
    lastRefundAmount: 0n,
    lastRefundPoolId: "",
    lastStatus: "legacy status should not leak",
    lastSuccessType: "",
    lastTxid: "",
    gasCredit: 0n,
    poolCount: 0,
    claimCount: 0,
    activePoolCount: 0,
    appMode: "gamefi",
    totalRemainingGas: 0,
    currentPool: null,
    recentPools: [],
    recentClaims: [],
    currentShareUrl: "",
    guestBest: 0,
    guestLast: 0,
    guestDraws: 0,
    guestBoard: [],
    a11yPlanIndex: 1,
    a11yPlanRevision: 0,
  };
  return Object.fromEntries(
    Object.entries({ ...base, ...overrides }).map(([key, value]) => [key, createObservable(value)]),
  );
}

function launch(url = "https://neomini.app/miniapps/gas-lucky-pool/index.html?network=testnet") {
  return parseMiniAppLaunchContext(url, "miniapp-gas-lucky-pool");
}

function appsRoot(): string {
  return process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
}

describe("gas-lucky-pool Phaser playarea", () => {
  it("mounts the production vault scene through Phaser with a creator-stage class", () => {
    const { container, queryByText } = render(
      <PhaserPlayArea t={t} state={state()} dispatch={vi.fn()} launchContext={launch()} />,
    );

    expect(container.querySelector(".gas-pool-playstage--creator")).toBeTruthy();
    expect(container.querySelector(".gas-pool-playstage--claim")).toBeFalsy();
    expect(container.querySelector(".gas-pool-stage-shell")).toBeTruthy();
    expect(container.querySelector(".gas-pool-stage-hud")).toBeTruthy();
    expect(container.querySelector(".mx2-score")).toBeNull();
    expect(container.querySelector(".mx2-action-rail__drawer-toggle")).toBeNull();
    expect(mocks.phaserGame).toHaveBeenCalledTimes(1);

    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      ariaLabel?: string;
      className?: string;
      config?: { width?: number; height?: number };
      loadingLabel?: string;
      state: Record<string, unknown>;
    };

    expect(props.className).toBe("gas-pool-phaser-canvas");
    expect(props.ariaLabel).toBe("OneGate GAS vault game");
    expect(props.loadingLabel).toBe("Opening vault");
    expect(props.config?.width).toBe(420);
    expect(props.config?.height).toBe(580);
    expect(props.state.currentRange).toBe("1-5 GAS");
    expect(props.state.lastStatus).toBeUndefined();
    expect(queryByText("Pack vault")).toBeNull();
  });

  it("uses the claim-stage class and passes claim context into the canvas", () => {
    const claimKey = "ogv_test_key_1234567890";
    const { container } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          claimProgress: "confirming",
          currentClaimKey: claimKey,
          currentRange: "1-3 GAS",
          isClaiming: true,
        })}
        dispatch={vi.fn()}
        launchContext={launch(`https://onegate.space/app/23?source=onegate&operation=claimOneGateVault&key=${claimKey}`)}
      />,
    );

    expect(container.querySelector(".gas-pool-playstage--claim")).toBeTruthy();

    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      state: Record<string, unknown>;
    };

    expect(props.state.currentClaimKey).toBe(claimKey);
    expect(props.state.currentRange).toBe("1-3 GAS");
    expect(props.state.claimProgress).toBe("confirming");
    expect(props.state.isClaiming).toBe(true);
  });

  it("provides a keyboard/screen-reader draw path and bridges each draw as a reveal nonce", () => {
    const guestState = state({ appMode: "guest", guestDraws: 3, guestLast: 2.5 });
    const dispatch = vi.fn(async (name: string, ...args: unknown[]) => {
      if (name !== "selectGuestPlan") return;
      const index = Number((args[0] as { index?: unknown } | undefined)?.index);
      guestState.a11yPlanIndex.set(index);
      guestState.a11yPlanRevision.set(guestState.a11yPlanRevision.get() + 1);
    });
    const { getByLabelText, getByRole } = render(
      <PhaserPlayArea
        t={t}
        state={guestState}
        dispatch={dispatch}
        launchContext={launch()}
      />,
    );

    const props = mocks.phaserGame.mock.calls.at(-1)?.[0] as {
      ariaLabel?: string;
      state: Record<string, unknown>;
    };
    expect(props.ariaLabel).toBe("Local lucky draw game");
    expect(props.state.guestDraws).toBe(3);

    fireEvent.click(getByLabelText("Starter · 1-3 pts"));
    expect(dispatch).toHaveBeenCalledWith("selectGuestPlan", { index: 0 });
    fireEvent.click(getByRole("button", { name: "Draw" }));

    expect(dispatch).toHaveBeenCalledWith(
      "createPool",
      expect.objectContaining({ minClaim: "1", maxClaim: "3", maxClaims: "10" }),
    );

    const scene = fs.readFileSync(
      path.join(appsRoot(), "gas-lucky-pool/src/scenes/GasLuckyPoolScene.ts"),
      "utf8",
    );
    expect(scene).toContain('this.dispatch("selectGuestPlan", { index })');
  });

  it("preserves a OneGate claim entitlement as a maintenance notice in local mode", () => {
    const { getByText, queryByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({ appMode: "guest", currentClaimKey: "ogv_test_key_1234567890" })}
        dispatch={vi.fn()}
        launchContext={launch()}
      />,
    );

    fireEvent.click(getByText("Play & scores"));
    expect(queryByText("Claim link held · GameFi paused")).toBeTruthy();
    expect(queryByText("GameFi validation in progress")).toBeTruthy();
    expect(queryByText("The claim link stays preserved and is not replaced by a local draw.")).toBeTruthy();
  });

  it("renders pool activity, credit recovery, and safety notes inside the drawer", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getAllByText, getByRole, getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          activePoolCount: 1,
          claimCount: 2,
          currentPoolId: "42",
          currentRange: "1-3 GAS",
          currentShareUrl: "https://onegate.space/app/23?key=ogv_test_key_1234567890&network=testnet",
          currentPool: {
            id: "42",
            creator: "Nowner111111111111111111111111111111",
            totalAmount: 2000000000n,
            minClaimAmount: 100000000n,
            maxClaimAmount: 300000000n,
            maxClaims: 10,
            claimedCount: 3,
            remainingAmount: 1200000000n,
            bestLuckAddress: "Nbest2222222222222222222222222222222",
            bestLuckAmount: 300000000n,
            expiryTime: Date.now() + 3600_000,
            active: true,
            status: "active",
          },
          gasCredit: 250000000n,
          poolCount: 3,
          recentPools: [
            {
              id: "42",
              creator: "Nowner111111111111111111111111111111",
              totalAmount: 2000000000n,
              minClaimAmount: 100000000n,
              maxClaimAmount: 300000000n,
              maxClaims: 10,
              claimedCount: 3,
              remainingAmount: 1200000000n,
              bestLuckAddress: "",
              bestLuckAmount: 0n,
              expiryTime: Date.now() + 3600_000,
              active: true,
              status: "active",
            },
          ],
          recentClaims: [
            {
              id: "42:Nclaimer",
              poolId: "42",
              claimer: "Nclaimer33333333333333333333333333333",
              amount: 250000000n,
            },
          ],
          totalRemainingGas: 12,
        })}
        dispatch={dispatch}
        launchContext={launch()}
      />,
    );

    fireEvent.click(getByText("Rules"));

    expect(container.querySelector(".gas-pool-ingame-drawer")).toBeTruthy();
    expect(container.querySelector(".mx2-drawer--open")).toBeNull();
    expect(container.querySelector(".gas-pool-drawer__summary")?.textContent).toContain("12.00 GAS");
    expect(container.querySelector(".gas-pool-current")?.textContent).toContain("#42");
    expect(container.querySelector(".gas-pool-current")?.textContent).toContain("12 GAS");
    expect(container.querySelector(".gas-pool-share")?.textContent).toContain("Copied");
    expect(container.querySelector(".gas-pool-list")?.textContent).toContain("Active");
    expect(container.querySelector(".gas-pool-list--claims")?.textContent).toContain("2.5 GAS");
    expect(container.querySelector(".gas-pool-drawer__credit")?.textContent).toContain("2.5 GAS");
    expect(container.textContent).toContain("The frontend never decides the reward amount.");
    expect(container.textContent).toContain("Verify payout on-chain after claiming.");
    expect(getByRole("button", { name: "Close guide" })).toBeTruthy();

    expect(container.querySelector(".gas-pool-drawer__actions")?.textContent).toContain("Inspect");
    expect(container.querySelector(".gas-pool-drawer__actions")?.textContent).toContain("Add GAS");
    expect(container.querySelector(".gas-pool-drawer__actions")?.textContent).toContain("Recover remaining GAS");

    fireEvent.click(getByText("Inspect"));
    fireEvent.click(getByText("Add GAS"));
    fireEvent.click(getByText("Recover remaining GAS"));
    fireEvent.click(getAllByText("Withdraw credit")[0].closest("button") ?? getAllByText("Withdraw credit")[0]);

    expect(dispatch).toHaveBeenCalledWith("loadPool", { poolId: "42" });
    expect(dispatch).toHaveBeenCalledWith("topUpPool", { poolId: "42", amount: "5" });
    expect(dispatch).toHaveBeenCalledWith("refundPool", { poolId: "42" });
    expect(dispatch).toHaveBeenCalledWith("withdrawGasCredit");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(container.querySelector(".gas-pool-ingame-drawer")).toBeNull();
  });

  it("surfaces claim result state and status recovery without relying on legacy status text", () => {
    render(
      <PhaserPlayArea
        t={t}
        state={state({
          claimStatus: "paid",
          currentClaimKey: "ogv_test_key_1234567890",
          lastClaimAmount: 500000000n,
          lastClaimKey: "ogv_test_key_1234567890",
          lastClaimLuckPercent: "72",
          lastSuccessType: "claim",
          lastTxid: "0xabc123",
        })}
        dispatch={vi.fn()}
        launchContext={launch("https://onegate.space/app/23?source=onegate&operation=claimOneGateVault&key=ogv_test_key_1234567890")}
      />,
    );

    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      state: Record<string, unknown>;
    };

    expect(props.state.lastClaimAmount).toBe(500000000n);
    expect(props.state.lastSuccessType).toBe("claim");
    expect(props.state.lastError).toBe("");
    expect(props.state.lastStatus).toBeUndefined();
  });

  it("keeps the Phaser wrapper from regressing to a one-line rules drawer or form shell", () => {
    const wrapper = fs.readFileSync(path.join(appsRoot(), "gas-lucky-pool/src/PhaserPlayArea.tsx"), "utf8");
    const main = fs.readFileSync(path.join(appsRoot(), "gas-lucky-pool/src/main.tsx"), "utf8");
    const scene = fs.readFileSync(path.join(appsRoot(), "gas-lucky-pool/src/scenes/GasLuckyPoolScene.ts"), "utf8");
    const styles = fs.readFileSync(path.join(appsRoot(), "gas-lucky-pool/src/PlayArea.scss"), "utf8");

    expect(wrapper).toContain("gas-pool-drawer__summary");
    expect(wrapper).toContain("gas-pool-drawer__actions");
    expect(wrapper).toContain("gas-pool-stage-shell");
    expect(wrapper).toContain("gas-pool-stage-hud");
    expect(wrapper).toContain("gas-pool-ingame-drawer");
    expect(wrapper).toContain("actions={{}}");
    expect(wrapper).toContain("recentPools");
    expect(wrapper).toContain("topUpPool");
    expect(wrapper).toContain("withdrawGasCredit");
    expect(wrapper).toContain("docSafetyModel");
    expect(wrapper).not.toContain("primaryAction");
    expect(wrapper).not.toContain("secondaryActions");
    expect(wrapper).not.toContain("secondary:");
    expect(wrapper).not.toContain("score={");
    expect(wrapper).not.toContain("drawerToggleLabel=");
    expect(wrapper).not.toContain("drawer={{");
    expect(wrapper).not.toContain("drawer={{ children: <p>{t(\"howItWorks\")}</p> }}");
    expect(wrapper).not.toMatch(/<form\b|<textarea\b|<select\b/);
    expect(wrapper).not.toContain("lastStatus");
    expect(main).toContain("export const GAS_LUCKY_GUEST_LOCAL_ENABLED = true");
    expect(main).toContain("export const GAS_LUCKY_ONEGATE_CLAIM_ENABLED = false");
    expect(main).toContain("export const GAS_LUCKY_RANGE_POOL_ENABLED = false");
    expect(main).toContain("paidLaneEnabled: GAS_LUCKY_GAMEFI_ENABLED");
    expect(main).toContain("oneGateClaimEnabled: GAS_LUCKY_ONEGATE_CLAIM_ENABLED");
    expect(main).toContain("guest.enter({ preserveClaimContext: isClaimLaunch })");
    expect(main).toContain('ctx.setStatus(ctx.t("gameFiMaintenanceBody"), "warning")');
    expect(main.match(/!GAS_LUCKY_RANGE_POOL_ENABLED/g)?.length ?? 0).toBeGreaterThanOrEqual(8);
    expect(main).toContain("!GAS_LUCKY_ONEGATE_CLAIM_ENABLED");
    expect(scene).toContain("officialGasTokenPhaserUrl");
    expect(scene).toContain('"./onegate-logo.webp"');
    expect(scene).toContain("guestDraws");
    expect(scene).toContain("rewardEventKey");
    expect(scene).toContain('button.setVisible(!isGuest)');
    expect(scene).toContain("protected onReducedMotionChange(enabled: boolean)");
    expect(scene).toContain("private fitCameraToHost()");
    expect(styles).toContain(".gas-pool-stage-shell");
    expect(styles).toContain(".gas-pool-stage-hud");
    expect(styles).toContain(".gas-pool-ingame-drawer");
    expect(styles).toContain(".gas-pool-a11y-controls");
    expect(styles).not.toContain("min-height: 626px");
    expect(styles).not.toContain(".mx2-action-rail__drawer-toggle");
  });
});
