import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import { defaultProfitCandidates } from "../utils/anchor-agents";
import PlayArea from "../../custom-anchor/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

/** 21 distinct valid compressed candidate keys for register tests. */
const TEST_CANDIDATES = Array.from({ length: 21 }, (_, index) => `02${String(index + 1).padStart(64, "0")}`);

function t(key: string) {
  const messages: Record<string, string> = {
    actionPanelBody: "Enter the custom anchor id and submit wallet transactions.",
    actionPanelLabel: "Wallet actions",
    actionPanelTitle: "Stake, redeem, or claim",
    adminRoute: "Admin route",
    adminRouteBody: "Agent movement stays outside the user flow.",
    agentCount: "Agents",
    agentModelBody: "Every custom anchor owns 21 deterministic AA agents.",
    anchorAppId: "Anchor appId",
    anchorAwaitingLaunch: "Open a OneGate anchor link",
    anchorFlowAction: "Choose action",
    anchorFlowOpen: "Open anchor",
    anchorFlowSign: "Sign wallet tx",
    anchorFlowTitle: "Anchor transaction flow",
    anchorLinked: "Anchor linked",
    anchorMissing: "Waiting for anchor",
    anchorStatus: "Anchor status",
    anchorWorkspaceBody: "User actions stay scoped to the anchor appId.",
    anchorWorkspaceLabel: "Transaction route",
    anchorWorkspaceTitle: "Anchor routing workspace",
    claimAction: "Claim GAS",
    invalidAmount: "NEO is indivisible. Enter a positive whole number.",
    invalidAnchorId: "Anchor appId must look like custom-anchor:slug:nonce.",
    lastTxid: "Last tx",
    launchSource: "Launch source",
    neoAmount: "NEO amount",
    noAnchorBody: "Scan a link or enter the anchor appId.",
    noAnchorTitle: "Open an anchor link",
    notAvailable: "Not available",
    pendingRewards: "Claimable GAS",
    readyForAnchor: "Ready for",
    refreshStatus: "Refresh status",
    rewardReserve: "Reward reserve",
    routingDetails: "Routing details",
    safetyRail: "Safety rail",
    safetyRailBody: "Funds remain scoped by anchor appId.",
    stakeAction: "Stake NEO",
    title: "Custom Anchor",
    totalStaked: "Total staked",
    userRoute: "User route",
    userRouteBody: "Stake, redeem, or claim from the same anchor.",
    userStake: "Your stake",
    withdrawAction: "Redeem NEO",
    workflowReady: "Ready",
    registerCandidatesLabel: "Council candidates (21 public keys)",
    registerCandidatesHint: "One compressed public key per line — exactly 21.",
    registerCandidatesPlaceholder: "02abc...",
    registerCandidatesUseDefault: "Use default candidate set",
    registerCandidatesCount: "{count}/21 valid candidate keys",
    registerCandidatesInvalid: "Enter exactly 21 compressed public keys.",
    noAgentsTitle: "0/21 agents provisioned",
    noAgentsBody: "This anchor has no AA agents yet.",
    noAgentsConfirm: "Stake anyway",
    noAgentsConfirmActive: "Confirmed — staking enabled",
    anchorNotRegisteredBadge: "Not registered",
  };
  return messages[key] ?? key;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values = {
    anchorAppId: "custom-anchor:team:nonce",
    // mode 1 = registered (trust); the not-registered notice only shows at 0.
    anchorMode: 1,
    totalStaked: "12",
    rewardReserve: "3.5",
    userStake: "2",
    pendingRewards: "0.1",
    agentCount: 21,
    lastTxid: "0xabc",
    workflowStatus: "Ready",
    lastError: "",
    isLoading: false,
    neoCredit: "0",
    gasCredit: "0",
    discoveredAnchors: [],
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("Custom Anchor PlayArea", () => {
  it("renders the wallet action workflow instead of a read-only explanation", () => {
    render(<PlayArea t={t} state={state()} dispatch={vi.fn(async () => undefined)} status={null} services={{} as never} setStatus={vi.fn()} clearStatus={vi.fn()} loadError={null} retryLoad={vi.fn()} launchContext={{ params: {} } as never} />);

    expect(screen.getByRole("region", { name: "Stake, redeem, or claim" })).toBeTruthy();
    expect(screen.getByLabelText("Anchor appId")).toBeTruthy();
    expect(screen.getByLabelText("NEO amount")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Stake NEO" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Redeem NEO" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Claim GAS" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Refresh status" })).toBeTruthy();
  });

  it("dispatches stake, redeem, claim, and refresh with the selected anchor", async () => {
    const dispatch = vi.fn(async () => undefined);
    render(<PlayArea t={t} state={state()} dispatch={dispatch} status={null} services={{} as never} setStatus={vi.fn()} clearStatus={vi.fn()} loadError={null} retryLoad={vi.fn()} launchContext={{ params: {} } as never} />);

    fireEvent.change(screen.getByLabelText("Anchor appId"), {
      target: { value: "custom-anchor:dao:round1" },
    });
    fireEvent.change(screen.getByLabelText("NEO amount"), {
      target: { value: "5" },
    });

    fireEvent.click(screen.getByRole("button", { name: "Stake NEO" }));
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("stake", {
        anchorAppId: "custom-anchor:dao:round1",
        amount: "5",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Redeem NEO" }));
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("withdraw", {
        anchorAppId: "custom-anchor:dao:round1",
        amount: "5",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Claim GAS" }));
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("claimRewards", {
        anchorAppId: "custom-anchor:dao:round1",
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Refresh status" }));
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("refreshAnchor", {
        anchorAppId: "custom-anchor:dao:round1",
      });
    });
  });

  it("seeds the anchor input EMPTY (example shown as placeholder only), so the money buttons stay disabled", () => {
    render(<PlayArea t={t} state={state({ anchorAppId: "" })} dispatch={vi.fn(async () => undefined)} status={null} services={{} as never} setStatus={vi.fn()} clearStatus={vi.fn()} loadError={null} retryLoad={vi.fn()} launchContext={{ params: {} } as never} />);

    const input = screen.getByLabelText("Anchor appId") as HTMLInputElement;
    // No pre-filled fake id — the example is only a placeholder.
    expect(input.value).toBe("");
    expect(input.placeholder).toBe("custom-anchor:team:nonce");
    // With an empty (invalid) id the stake button is disabled.
    expect((screen.getByRole("button", { name: "Stake NEO" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("surfaces a 'not registered' notice when getAppMode resolved to 0", () => {
    render(<PlayArea t={t} state={state({ anchorMode: 0 })} dispatch={vi.fn(async () => undefined)} status={null} services={{} as never} setStatus={vi.fn()} clearStatus={vi.fn()} loadError={null} retryLoad={vi.fn()} launchContext={{ params: {} } as never} />);

    expect(screen.getByText("anchorNotRegistered")).toBeTruthy();
  });

  it("registers a new anchor with the chosen mode AND the 21 council candidates", async () => {
    const dispatch = vi.fn(async () => undefined);
    render(<PlayArea t={t} state={state()} dispatch={dispatch} status={null} services={{} as never} setStatus={vi.fn()} clearStatus={vi.fn()} loadError={null} retryLoad={vi.fn()} launchContext={{ params: {} } as never} />);

    fireEvent.change(screen.getByLabelText("registerAnchorAppId"), {
      target: { value: "custom-anchor:newteam:001" },
    });
    // Provisioning requires exactly 21 valid candidate keys before the register
    // button enables — fill them in.
    fireEvent.change(screen.getByLabelText("Council candidates (21 public keys)"), {
      target: { value: TEST_CANDIDATES.join("\n") },
    });
    fireEvent.click(screen.getByRole("button", { name: "registerAction" }));
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("register", {
        anchorAppId: "custom-anchor:newteam:001",
        mode: 1,
        candidates: TEST_CANDIDATES,
      });
    });
  });

  it("keeps the register button disabled until exactly 21 valid candidates are entered", () => {
    render(<PlayArea t={t} state={state()} dispatch={vi.fn(async () => undefined)} status={null} services={{} as never} setStatus={vi.fn()} clearStatus={vi.fn()} loadError={null} retryLoad={vi.fn()} launchContext={{ params: {} } as never} />);

    fireEvent.change(screen.getByLabelText("registerAnchorAppId"), {
      target: { value: "custom-anchor:newteam:001" },
    });
    const registerButton = screen.getByRole("button", { name: "registerAction" }) as HTMLButtonElement;
    // Valid id but no candidates yet → still disabled.
    expect(registerButton.disabled).toBe(true);

    // Only 20 candidates → still disabled.
    fireEvent.change(screen.getByLabelText("Council candidates (21 public keys)"), {
      target: { value: TEST_CANDIDATES.slice(0, 20).join("\n") },
    });
    expect(registerButton.disabled).toBe(true);

    // All 21 → enabled.
    fireEvent.change(screen.getByLabelText("Council candidates (21 public keys)"), {
      target: { value: TEST_CANDIDATES.join("\n") },
    });
    expect(registerButton.disabled).toBe(false);
  });

  it("fills the default candidate set on demand and when switching to Profit mode", () => {
    render(<PlayArea t={t} state={state()} dispatch={vi.fn(async () => undefined)} status={null} services={{} as never} setStatus={vi.fn()} clearStatus={vi.fn()} loadError={null} retryLoad={vi.fn()} launchContext={{ params: {} } as never} />);

    const candidatesField = screen.getByLabelText("Council candidates (21 public keys)") as HTMLTextAreaElement;
    expect(candidatesField.value).toBe("");

    // The explicit "Use default candidate set" button fills 21 keys.
    fireEvent.click(screen.getByRole("button", { name: "Use default candidate set" }));
    expect(candidatesField.value).toBe(defaultProfitCandidates().join("\n"));
    expect(candidatesField.value.split("\n")).toHaveLength(21);
  });

  it("seeds default candidates when switching to Profit mode while the field is empty", () => {
    render(<PlayArea t={t} state={state()} dispatch={vi.fn(async () => undefined)} status={null} services={{} as never} setStatus={vi.fn()} clearStatus={vi.fn()} loadError={null} retryLoad={vi.fn()} launchContext={{ params: {} } as never} />);

    const candidatesField = screen.getByLabelText("Council candidates (21 public keys)") as HTMLTextAreaElement;
    expect(candidatesField.value).toBe("");
    fireEvent.click(screen.getByRole("radio", { name: "registerModeProfit" }));
    expect(candidatesField.value).toBe(defaultProfitCandidates().join("\n"));
  });

  it("lists discovered anchors and dispatches selectAnchor on Use", async () => {
    const dispatch = vi.fn(async () => undefined);
    render(
      <PlayArea
        t={t}
        state={state({
          discoveredAnchors: [{ appId: "custom-anchor:dao:round9", mode: 2 }],
        })}
        dispatch={dispatch}
        status={null}
        services={{} as never}
        setStatus={vi.fn()}
        clearStatus={vi.fn()}
        loadError={null}
        retryLoad={vi.fn()}
        launchContext={{ params: {} } as never}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "discoverUse" }));
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("selectAnchor", "custom-anchor:dao:round9");
    });
  });

  it("hides the credit-recovery control when there is no reclaimable credit", () => {
    render(<PlayArea t={t} state={state({ neoCredit: "0", gasCredit: "0" })} dispatch={vi.fn(async () => undefined)} status={null} services={{} as never} setStatus={vi.fn()} clearStatus={vi.fn()} loadError={null} retryLoad={vi.fn()} launchContext={{ params: {} } as never} />);
    expect(screen.queryByRole("button", { name: "recoverGas" })).toBeNull();
  });

  it("shows a credit-recovery control and dispatches recoverCredit when credit exists", async () => {
    const dispatch = vi.fn(async () => undefined);
    render(<PlayArea t={t} state={state({ neoCredit: "0", gasCredit: "1.5" })} dispatch={dispatch} status={null} services={{} as never} setStatus={vi.fn()} clearStatus={vi.fn()} loadError={null} retryLoad={vi.fn()} launchContext={{ params: {} } as never} />);
    fireEvent.click(screen.getByRole("button", { name: "recoverGas" }));
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("recoverCredit", "GAS");
    });
  });

  // The 0/21 callout + stake-gate is the fallback for externally-created anchors
  // that were registered WITHOUT the standalone's agent provisioning. It must
  // keep blocking a stake until the user explicitly acknowledges the anchor
  // earns nothing yet.
  it("keeps the 0/21 stake-gate as a fallback for an externally-created anchor with no agents", async () => {
    const dispatch = vi.fn(async () => undefined);
    render(<PlayArea t={t} state={state({ anchorMode: 1, agentCount: 0 })} dispatch={dispatch} status={null} services={{} as never} setStatus={vi.fn()} clearStatus={vi.fn()} loadError={null} retryLoad={vi.fn()} launchContext={{ params: {} } as never} />);

    // The 0/21 callout is surfaced.
    expect(screen.getByText("0/21 agents provisioned")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Anchor appId"), {
      target: { value: "custom-anchor:ext:round3" },
    });
    fireEvent.change(screen.getByLabelText("NEO amount"), { target: { value: "5" } });

    // Stake stays blocked until the inert-anchor acknowledgement is checked.
    const stakeButton = screen.getByRole("button", { name: "Stake NEO" }) as HTMLButtonElement;
    expect(stakeButton.disabled).toBe(true);

    const confirm = screen.getByRole("checkbox") as HTMLInputElement;
    fireEvent.click(confirm);
    expect(stakeButton.disabled).toBe(false);

    fireEvent.click(stakeButton);
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("stake", {
        anchorAppId: "custom-anchor:ext:round3",
        amount: "5",
      });
    });
  });
});
