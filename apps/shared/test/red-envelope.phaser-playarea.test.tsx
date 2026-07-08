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

vi.mock("@framework/phaser", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@framework/phaser")>();
  return {
    ...actual,
    PhaserGameComponent: (props: unknown) => {
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
    remaining: "{remaining}/{total} left",
    safetyPanelCopy: "Claiming calls the Red Envelope contract directly and pays GAS atomically.",
    safetyPanelTitle: "Transaction safety",
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
    isLoading: false,
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
    expect(props.ariaLabel).toBe("Red Envelope packet game");
    expect(props.loadingLabel).toBe("Opening red envelope game");
    expect(props.config?.width).toBe(420);
    expect(props.config?.height).toBe(540);
    expect(props.state.envelopes).toEqual([
      { id: "42", totalAmount: 8, remainingAmount: 3.2, remainingPackets: 3, packetCount: 8, active: true, canOpen: true },
      { id: "31", remainingAmount: 1.1, remainingPackets: 2, packetCount: 6, active: false, expired: true, reclaimable: true },
    ]);
    expect(props.state.claims).toEqual([
      { id: "42:claimer", poolId: "42", holder: "0xabc1239999", amount: 0.42 },
    ]);
    expect(queryByText("Create")).toBeNull();
    expect(queryByText("Open envelope")).toBeNull();
    expect(queryAllByText("Red Envelope").length).toBeGreaterThan(0);
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
    expect(styles).toContain(".redenv-stage-hud");
    expect(styles).toContain(".redenv-ingame-drawer");
    expect(styles).toContain(".redenv-drawer__summary-grid");
    expect(styles).toContain(".redenv-share-card");
    expect(styles).toContain(".redenv-credit-card");
  });
});
