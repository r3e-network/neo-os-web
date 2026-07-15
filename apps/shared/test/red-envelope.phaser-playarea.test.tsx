import React from "react";
import { fireEvent, cleanup, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

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
      return <div data-testid="red-envelope-phaser-host" />;
    },
  };
});

import PhaserPlayArea from "../../red-envelope/src/PhaserPlayArea";

afterEach(() => {
  cleanup();
  mocks.phaserGame.mockClear();
});

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    activeEnvelopes: "Active envelopes",
    appEyebrow: "Red Envelope",
    appSubtitle: "Open a lucky GAS packet or send one from the creator controls.",
    appTitle: "Red Envelope",
    availableEnvelopes: "Active envelopes",
    claimablePool: "Claimable pool",
    claimContractRoute: "claim -> atomic GAS payout",
    claimPanelTitle: "Recipient claim path",
    claimRedEnvelope: "Claim red envelope",
    claimTicketEmptyDesc: "Open a OneGate QR claim link or pick an open envelope below.",
    claimTicketPreparedDesc: "The ID is filled. Claiming will ask the contract to verify whether it can be opened.",
    chainReadUnavailable: "Network data is unavailable.",
    claimedGasLabel: "Claimed GAS",
    congratulations: "Lucky you!",
    contractRoute: "Contract route",
    copyShareLink: "Copy claim link",
    createdGasLabel: "Created GAS",
    depositPrepaidNoEnvelope: "Deposit is held as prepaid credit.",
    docDescription: "Red Envelope is claim-first. Recipients open a shared link and GAS pays to their wallet.",
    drawerSummaryLabel: "Envelope account summary",
    envelopeEmpty: "Envelope is empty",
    envelopeSent: "Envelope sent!",
    expired: "Expired",
    moreActions: "More actions",
    myEnvelopes: "My Envelopes",
    noActivity: "No recent claims",
    noActivityCopy: "Successful claims will appear here.",
    noPoolsCopy: "Create a GAS envelope or open a OneGate QR claim link.",
    opening: "Opening...",
    packetUnit: "packets",
    prepaidCreditLabel: "Prepaid credit",
    ready: "Ready",
    recentClaimsTitle: "Recent claims",
    reclaimEnvelope: "Reclaim",
    reclaimableTitle: "Reclaim expired envelopes",
    retryData: "Retry data",
    remaining: "{remaining}/{total} left",
    safetyPanelCopy: "Claiming calls the Red Envelope contract directly and pays GAS atomically.",
    safetyPanelTitle: "Transaction safety",
    sceneAriaLabel: "Interactive red-envelope game",
    sceneKeyboardHint: "Red-envelope game keyboard controls",
    sceneLoadingLabel: "Preparing the red-envelope table",
    sceneLoadError: "The red-envelope table could not load",
    sceneRetry: "Try again",
    sceneContinue: "Continue",
    sceneEnableSound: "Turn on red-envelope sounds",
    sceneMuteSound: "Mute red-envelope sounds",
    sceneOpen: "Open envelope",
    sceneOpening: "Opening...",
    sceneConnectWallet: "Connect wallet",
    sceneWorking: "Working...",
    scenePlanLucky: "Lucky 8",
    scenePlanParty: "Party 20",
    scenePlanFestival: "Festival 50",
    accessibleActionsTitle: "Keyboard actions",
    accessibleActionsHint: "Standard action buttons",
    closeDrawer: "Close envelope details",
    sendingRedEnvelope: "Sending packets...",
    shareHint: "Created envelope #{id}. Copy the claim link and send it to recipients.",
    shareReadyTitle: "OneGate share-ready",
    shareTitle: "Share this envelope",
    sidebarEnvelopes: "Envelopes",
    tokenGas: "GAS",
    withdrawCredit: "Withdraw credit",
  };
  let value = messages[key] ?? key;
  for (const [param, replacement] of Object.entries(params ?? {})) {
    value = value.replaceAll(`{${param}}`, String(replacement));
  }
  return value;
}

function launch(url = "https://neomini.app/miniapps/red-envelope/index.html?network=testnet") {
  return parseMiniAppLaunchContext(url, "miniapp-redenvelope");
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    claimCount: 1,
    claims: [
      { id: "42:claimer", poolId: "42", holder: "0xabc1239999", amount: 0.42 },
    ],
    envelopeCount: 2,
    envelopes: [
      { id: "42", totalAmount: 8, remainingAmount: 3.2, remainingPackets: 3, packetCount: 8, active: true, canOpen: true },
      { id: "31", remainingAmount: 1.1, remainingPackets: 2, packetCount: 6, active: false, expired: true, reclaimable: true },
    ],
    isCreating: false,
    isConnectingWallet: false,
    isLoading: false,
    isRecovering: false,
    appMode: "gamefi",
    walletConnected: true,
    paidActionsAvailable: true,
    createAvailable: true,
    pendingOperation: null,
    transactionNotice: "",
    lastCreatedEnvelopeId: "",
    lastError: "",
    luckyMessage: null,
    openingId: null,
    poolCount: 1,
    pools: [
      { id: "42", totalAmount: 8, remainingAmount: 3.2, remainingPackets: 3, packetCount: 8, active: true, canOpen: true },
    ],
    prepaidCredit: 0,
    serviceNotice: "",
    totalClaimed: 0.42,
    totalCreated: 8,
  };
  return Object.fromEntries(
    Object.entries({ ...base, ...overrides }).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("red-envelope Phaser playarea", () => {
  it("mounts the production packet game in Phaser without outer forms or primary actions", () => {
    const { container, queryAllByText, queryByText } = render(
      <PhaserPlayArea t={t} state={state()} dispatch={vi.fn()} launchContext={launch()} />,
    );

    expect(container.querySelector(".redenv-playstage")).toBeTruthy();
    expect(container.querySelector(".redenv-stage-shell")).toBeTruthy();
    expect(container.querySelector(".redenv-stage-hud")).toBeTruthy();
    expect(container.querySelector(".mx2-action-rail")).toBeNull();
    expect(container.querySelectorAll("form,input,textarea,select")).toHaveLength(0);
    expect(mocks.phaserGame).toHaveBeenCalledTimes(1);

    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      ariaLabel?: string;
      className?: string;
      config?: { width?: number; height?: number };
      loadingLabel?: string;
      state: Record<string, unknown>;
    };

    expect(props.className).toBe("redenv-phaser-canvas");
    expect(props.ariaLabel).toBe("Interactive red-envelope game");
    expect(props.loadingLabel).toBe("Preparing the red-envelope table");
    expect(props.config?.width).toBe(420);
    expect(props.config?.height).toBe(580);
    expect(props.state.envelopes).toEqual([
      { id: "42", totalAmount: 8, remainingAmount: 3.2, remainingPackets: 3, packetCount: 8, active: true, canOpen: true },
      { id: "31", remainingAmount: 1.1, remainingPackets: 2, packetCount: 6, active: false, expired: true, reclaimable: true },
    ]);
    expect(props.state.claims).toEqual([
      { id: "42:claimer", poolId: "42", holder: "0xabc1239999", amount: 0.42 },
    ]);
    expect(props.state.claimability).toEqual({ envelopeId: "42", canClaim: true });
    expect(props.state.walletConnected).toBe(true);
    expect(props.state.paidActionsAvailable).toBe(true);
    expect(props.state.appMode).toBe("gamefi");
    expect(queryByText("Create")).toBeNull();
    expect(queryByText("Open envelope")).toBeNull();
    expect(queryAllByText("Red Envelope")).toHaveLength(0);
    expect(container.querySelector(".redenv-sr-only")?.textContent).toContain("Red Envelope");
  });

  it("passes explicit disabled claimability instead of falling back to an ineligible envelope", () => {
    render(
      <PhaserPlayArea
        t={t}
        state={state({
          envelopes: [
            { id: "expired-first", active: false, expired: true, remainingPackets: 2 },
            { id: "claimed-active", active: true, ready: true, canOpen: false, remainingPackets: 2 },
          ],
          pools: [],
        })}
        dispatch={vi.fn()}
        launchContext={launch()}
      />,
    );

    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      state: Record<string, unknown>;
    };
    expect(props.state.claimability).toEqual({ envelopeId: "", canClaim: false });
  });

  it("does not leak a stale GameFi service notice into local packet play", () => {
    const { container } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          appMode: "guest",
          serviceNotice: "This network still uses the legacy contract.",
          transactionNotice: "Pending on-chain operation.",
          luckyMessage: { amount: 0.5, from: "Local" },
        })}
        dispatch={vi.fn()}
        launchContext={launch()}
      />,
    );

    const props = mocks.phaserGame.mock.calls.at(-1)?.[0] as {
      state: Record<string, unknown>;
    };
    expect(props.state.serviceNotice).toBe("");
    expect(container.querySelector(".redenv-sr-only")?.textContent).not.toContain("legacy contract");
    expect(container.querySelector(".redenv-sr-only")?.textContent).not.toContain("Pending on-chain");
    expect(container.querySelector(".redenv-sr-only")?.textContent).not.toContain("GAS");
  });

  it("does not substitute another pool when an explicit claim link is ineligible", () => {
    render(
      <PhaserPlayArea
        t={t}
        state={state()}
        dispatch={vi.fn()}
        launchContext={launch("https://neomini.app/miniapps/red-envelope/index.html?network=testnet&envelopeId=expired")}
      />,
    );

    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      state: Record<string, unknown>;
    };
    expect(props.state.claimability).toEqual({ envelopeId: "", canClaim: false });
  });

  it("keeps stale-host paid controls disabled even when an envelope is otherwise claimable", () => {
    render(
      <PhaserPlayArea
        t={t}
        state={state({ paidActionsAvailable: false, createAvailable: true })}
        dispatch={vi.fn()}
        launchContext={launch()}
      />,
    );

    const props = mocks.phaserGame.mock.calls[0]?.[0] as {
      state: Record<string, unknown>;
    };
    expect(props.state.paidActionsAvailable).toBe(false);
    expect(props.state.createAvailable).toBe(false);
    expect(props.state.claimability).toEqual({ envelopeId: "42", canClaim: false });
  });

  it("offers a keyboard primary action and a closable modal drawer", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const view = render(
      <PhaserPlayArea t={t} state={state()} dispatch={dispatch} launchContext={launch()} />,
    );

    fireEvent.keyDown(view.container.querySelector(".redenv-canvas-access") as HTMLElement, {
      key: "Enter",
    });
    expect(dispatch).toHaveBeenCalledWith("claimEnvelope", { envelopeId: "42" });

    fireEvent.click(view.getByText("My Envelopes"));
    expect(view.getByRole("dialog", { name: "My Envelopes" })).toBeTruthy();
    expect(view.getByRole("button", { name: "Close envelope details" })).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(view.queryByRole("dialog", { name: "My Envelopes" })).toBeNull();
  });

  it("keeps share and credit recovery in the in-stage drawer", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          lastCreatedEnvelopeId: "77",
          prepaidCredit: 0.75,
        })}
        dispatch={dispatch}
        launchContext={launch()}
      />,
    );

    fireEvent.click(getByText("My Envelopes"));

    fireEvent.click(getByText("Copy claim link"));
    expect(dispatch).toHaveBeenCalledWith("shareEnvelope", { envelopeId: "77" });

    fireEvent.click(getByText("Withdraw credit"));
    expect(dispatch).toHaveBeenCalledWith("withdrawCredit");
  });

  it("surfaces a secondary read-retry action without replacing the game", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { getByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({ serviceNotice: "Network data is unavailable." })}
        dispatch={dispatch}
        launchContext={launch()}
      />,
    );

    fireEvent.click(getByText("My Envelopes"));
    fireEvent.click(getByText("Retry data"));
    expect(dispatch).toHaveBeenCalledWith("retryEnvelopeData");
  });

  it("tucks pools, claims, reclaim, sharing, and contract safety into the drawer", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByText, getAllByText } = render(
      <PhaserPlayArea
        t={t}
        state={state({
          lastCreatedEnvelopeId: "77",
          prepaidCredit: 0.75,
        })}
        dispatch={dispatch}
        launchContext={launch("https://neomini.app/miniapps/red-envelope/index.html?network=testnet&envelopeId=42")}
      />,
    );

    expect(container.querySelector(".redenv-drawer__summary-grid")).toBeNull();

    fireEvent.click(getByText("My Envelopes"));
    expect(container.querySelector(".redenv-drawer__head")).toBeTruthy();
    expect(container.querySelector(".redenv-drawer__summary-grid")?.textContent).toContain("Claimable pool");
    expect(container.querySelector(".redenv-share-card")?.textContent).toContain("Created envelope #77");
    expect(container.querySelector(".redenv-credit-card")?.textContent).toContain("0.75 GAS");
    expect(container.querySelector(".redenv-drawer__panel-body")?.getAttribute("data-mode")).toBe("active");
    expect(container.querySelector(".redenv-drawer__panel-body")?.textContent).toContain("#42");

    fireEvent.click(getByText("Recent claims"));
    expect(container.querySelector(".redenv-drawer__panel-body")?.getAttribute("data-mode")).toBe("claims");
    expect(container.querySelector('.redenv-drawer-list__item[data-outcome="won"]')?.textContent).toContain("0.42 GAS");

    fireEvent.click(getByText("Reclaim"));
    expect(container.querySelector(".redenv-drawer__panel-body")?.getAttribute("data-mode")).toBe("reclaim");
    fireEvent.click(getAllByText("Reclaim").at(-1) as HTMLElement);
    expect(dispatch).toHaveBeenCalledWith("reclaimEnvelope", { envelopeId: "31" });

    fireEvent.click(getByText("Transaction safety"));
    expect(container.querySelector(".redenv-drawer__panel-body")?.getAttribute("data-mode")).toBe("safety");
    expect(container.querySelector(".redenv-route")?.textContent).toContain("claim -> atomic GAS payout");

    fireEvent.click(getAllByText("Copy claim link").at(-1) as HTMLElement);
    expect(dispatch).toHaveBeenCalledWith("shareEnvelope", { envelopeId: "77" });
  });

  it("keeps source guards for Phaser-first red envelope production UI", () => {
    const repoRoot = resolve(__dirname, "../../..");
    const wrapper = readFileSync(resolve(repoRoot, "apps/red-envelope/src/PhaserPlayArea.tsx"), "utf8");
    const scene = readFileSync(resolve(repoRoot, "apps/red-envelope/src/scenes/RedEnvelopeScene.ts"), "utf8");
    const main = readFileSync(resolve(repoRoot, "apps/red-envelope/src/main.tsx"), "utf8");
    const styles = readFileSync(resolve(repoRoot, "apps/red-envelope/src/PlayArea.scss"), "utf8");

    expect(wrapper).toContain("redenv-drawer__summary-grid");
    expect(wrapper).toContain("redenv-stage-hud");
    expect(wrapper).toContain("redenv-ingame-drawer");
    expect(wrapper).toContain("redenv-share-card");
    expect(wrapper).toContain("redenv-credit-card");
    expect(wrapper).toContain("redenv-drawer__panel-shell");
    expect(wrapper).not.toMatch(/primary:\s*\{/);
    expect(wrapper).not.toContain("score={score}");
    expect(wrapper).not.toMatch(/<(form|input|textarea|select)\b/);
    expect(scene).toContain("private activeMode: Mode = \"claim\"");
    expect(scene).toContain("Open a shared link or active pool.");
    expect(scene).toContain('this.val<Claimability>("claimability", undefined)');
    // The guard: opening an envelope must stay gated on the paid lane being
    // available AND the contract reporting this wallet claim-eligible AND an
    // envelope actually being selected — never on a subset. That is unchanged.
    // The clause was re-pinned (it used to also require `&& !this.busy` inline)
    // because the button now additionally lights up for a wallet-less visitor
    // to CONNECT: with no wallet they have not reached the paid gate yet, and
    // opening on "GameFi paused" over a dead button advertised the game as
    // broken to everyone who had not connected. `!this.busy` still guards the
    // whole expression one line up, and dispatchClaim re-checks the paid gate.
    expect(scene).toContain("paidAvailable && this.claimEnabled && Boolean(this.activeEnvelopeId)");
    expect(scene).toMatch(/const canClaim = !this\.busy/);
    // The connect affordance must never become a paid-action bypass.
    const dispatchClaimBody = scene.slice(
      scene.indexOf("private dispatchClaim(): void"),
      scene.indexOf("private playOpenAnimation(): void"),
    );
    expect(dispatchClaimBody).toContain("this.paidActionsEnabled");
    expect(scene).not.toContain("merged[0]?.id");
    const dispatchClaim = scene.slice(
      scene.indexOf("private dispatchClaim(): void"),
      scene.indexOf("private playOpenAnimation(): void"),
    );
    expect(dispatchClaim).not.toContain("playOpenAnimation");
    expect(scene).toContain("this.playOpenAnimation();");
    expect(scene).toContain("REDENV_ASSETS.claimCard");
    expect(scene).toContain("private playCreateAnimation(): void");
    expect(scene).toContain("private spawnRewardBurst(): void");
    const dispatchCreate = scene.slice(
      scene.indexOf("private dispatchCreate(): void"),
      scene.indexOf("private dispatchClaim(): void"),
    );
    expect(dispatchCreate).toContain('this.dispatch("connectWallet")');
    expect(dispatchCreate.indexOf('this.dispatch("connectWallet")')).toBeLessThan(
      dispatchCreate.indexOf('this.dispatch("createEnvelope"'),
    );
    expect(dispatchClaim).toContain('this.dispatch("connectWallet")');
    expect(dispatchClaim.indexOf('this.dispatch("connectWallet")')).toBeLessThan(
      dispatchClaim.indexOf('this.dispatch("claimEnvelope"'),
    );
    expect(main).toContain('actions.register("connectWallet"');
    expect(main).toContain("This action is deliberately terminal");
    expect(main).toContain('app.notify.info("connectWalletFirst")');
    expect(main).toContain("assertNewPaidActionEnabled");
    expect(styles).toContain(".redenv-stage-hud");
    expect(styles).toContain(".redenv-ingame-drawer");
    expect(styles).toContain(".redenv-drawer__summary-grid");
    expect(styles).toContain(".redenv-share-card");
    expect(styles).toContain(".redenv-credit-card");
  });
});
