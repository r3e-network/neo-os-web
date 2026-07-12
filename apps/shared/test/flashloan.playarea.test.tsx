import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../flashloan/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    eyebrow: "Flash Loan",
    requestLoanTitle: "Request a flash loan",
    flowNote: "Atomic borrow, execute, repay in one transaction.",
    flashloanHeroImageAlt: "Bright DeFi liquidity desk with GAS flowing through an atomic flash-loan route",
    poolBalance: "Pool balance",
    estimatedFee: "Estimated fee",
    totalRepayment: "Total repayment",
    protocolFee: "protocol fee",
    walletRequired: "Wallet required",
    walletConnected: "Connected",
    connectAndSign: "Connect & sign",
    connectToRecover: "Connect to recover",
    signRequestFlashLoan: "Sign requestFlashLoan",
    requestLoan: "Request loan",
    requesting: "Requesting...",
    loanRequested: "Loan executed",
    confirmingOnChain: "Confirming on-chain...",
    checkingOnChain: "Checking on-chain...",
    transactionIdLabel: "Tx",
    actionInProgressShort: "Financial action in progress",
    actionInProgress: "Another financial action is already in progress.",
    otherFinancialActionPending: "Resolve the other submitted financial action first.",
    otherActionPendingShort: "Resolve pending action",
    liquidityConfirmationPending: "Liquidity confirmation pending.",
    amountPlaceholder: "Amount (GAS)",
    callbackContractPlaceholder: "Contract hash or address",
    callbackSocketLabel: "Callback socket",
    callbackSocketReady: "Socket target locked",
    callbackFormatReady: "Address and method accepted",
    callbackMethodRequired: "Method name required",
    callbackSocketOpen: "Socket awaiting contract",
    callbackSocketHint: "Target receives principal and must repay inside this transaction.",
    executionSetup: "Execution setup",
    executionSetupHint: "Set the callback target in this drawer before signing.",
    customAmount: "Custom",
    exactAmount: "Exact amount",
    requestTicketEyebrow: "Execution ticket",
    requestTicketTitle: "Flash-loan execution ticket",
    loanPackageProbe: "Callback probe",
    loanPackageRoute: "Route rehearsal",
    loanPackageScale: "Scale execution",
    loanAmount: "Loan amount",
    amountPresets: "Amount presets",
    capitalRouteTitle: "Atomic capital route",
    capitalRouteHint: "Follow principal, callback execution, and repayment guard before signing.",
    simulationEyebrow: "Preflight model",
    simulationTitle: "Atomic route simulation",
    simulationReady: "Route checks ready",
    simulationPrincipal: "Principal out",
    simulationCallback: "Callback",
    simulationRepayment: "Required back",
    simulationDisclaimer: "Local preflight model, not a successful loan.",
    atomicRevertRiskTitle: "Atomic revert boundary",
    atomicRevertRisk: "Return principal and {fee}% fee or the transaction faults.",
    poolReservoir: "Pool reservoir",
    poolBalanceNote: "Available liquidity for flash loans",
    readinessWallet: "Wallet",
    readinessWalletReady: "Connected",
    readinessWalletAction: "Connect before signing",
    readinessCallback: "Callback",
    readinessCallbackReady: "Contract target set",
    readinessCallbackMissing: "Socket awaiting contract",
    readinessRepayment: "Repayment guard",
    readinessRepaymentGuard: "Principal + fee must return in one tx",
    callbackPrerequisite: "Every loan needs a callback contract.",
    toolsDockTitle: "Liquidity & tools",
    liquidityTitle: "Provide liquidity",
    liquidityInfo: "Earn fees from flash-loan repayments.",
    yourLiquidity: "Your liquidity",
    feesEarned: "Fees earned",
    providerShare: "Provider share",
    protocolShare: "Protocol share",
    liquidityAmountPlaceholder: "Amount to deposit (GAS)",
    receiptIdPlaceholder: "Deposit receipt id",
    deposit: "Deposit",
    withdraw: "Withdraw",
    statusLookup: "Loan lookup",
    statusLookupEyebrow: "On-chain lookup",
    statusHint: "Enter a loan ID to fetch its on-chain status.",
    statusLabel: "Status",
    loanId: "Loan ID",
    loanIdPlaceholder: "Loan id",
    checkStatus: "Check status",
    recentLoans: "Recent loans",
    recentLoansEyebrow: "History",
    sidebarRecentLoans: "Recent loans",
    noHistory: "No loans yet.",
    contractInfo: "Contract parameters",
    minLoan: "Min loan",
    maxLoan: "Max loan",
    cooldown: "Cooldown",
    minutes: " min",
    dailyLimit: "Daily limit",
    liquidityAmount: "Amount",
    liquidityFeeShareNote: "Liquidity providers earn {share}% of each fee ({protocol}% is protocol revenue).",
    receiptIdLabel: "Payment Receipt ID",
    callbackMethodFixed: "Callback method is fixed to onFlashLoan for safety.",
    callbackMethod: "Callback method",
    callbackMethodPlaceholder: "execute",
    callbackMethodSignature: "method(borrower, amount, fee, loanId)",
    callbackRiskTitle: "Callback compatibility",
    callbackRiskTestnet: "Testnet execute harness verified.",
    callbackRiskMainnet: "Verify the mainnet callback.",
    verifiedHarnessTitle: "Verified testnet callback harness",
    verifiedHarnessHint: "execute simulated HALT",
    useVerifiedHarness: "Use harness",
    callbackInvocationSummary: "Call {method}(borrower, amount, fee, loanId)",
    callbackSetupRequired: "Configure callback",
    readinessContract: "Contract & pool",
    eligibilityReady: "Eligible · {remaining} left",
    eligibilityBlocked: "Eligibility blocked",
    eligibilityChecking: "Checking eligibility",
    poolInsufficient: "Pool insufficient",
    contractUnavailable: "Contract unavailable",
    chainContextMismatch: "Wallet network mismatch",
    contractPaused: "Contract paused",
    contractStatusReady: "Ready",
    contractStatusChecking: "Checking",
    contractStatusPaused: "Paused",
    contractStatusUnavailable: "Unavailable",
    contractParametersVerified: "Read from deployed contract",
    mainnet: "Mainnet",
    testnet: "Testnet",
    atomicExecutionHint: "Atomic execution",
    notConfigured: "Not configured",
    liquidityConfirmationReview: "Liquidity needs review.",
    liquidityPaymentPending: "Prepaid GAS is still being verified.",
    paymentConfirmationTitle: "Confirming prepaid GAS",
    depositUnavailableTitle: "Deposits unavailable",
    paymentHubUnavailable: "Mainnet PaymentHub is not configured.",
    liquidityResumeRequired: "Resume {amount} GAS without paying again.",
    resumeLiquidityTitle: "Resume deposit",
    resumeLiquidityDeposit: "Resume deposit — no new payment",
    amount: "Amount",
    borrow: "Borrow",
    execute: "Execute",
    repay: "Repay",
    flashloanFormIncomplete: "Choose capital and connect the callback socket before signing.",
    statusPending: "Pending",
    statusSuccess: "Success",
    statusFailed: "Failed",
  };
  let value = messages[key] ?? key;
  if (params) for (const [k, v] of Object.entries(params)) value = value.replaceAll(`{${k}}`, String(v));
  return value;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    isLoading: false,
    isLookupLoading: false,
    writeOperation: "",
    address: "",
    poolBalance: 12.5,
    poolBalanceFixed8: "1250000000",
    validationError: "",
    serviceNotice: "",
    pendingRequestTxid: "",
    pendingLiquidityTxid: "",
    pendingLiquidityStage: "",
    pendingLiquidityAmount: "",
    loanDetails: null,
    recentLoans: [],
    lastRequest: null,
    contractStats: {
      minLoan: 1, minLoanFixed8: "100000000",
      maxLoan: 100000, maxLoanFixed8: "10000000000000", feeBasisPoints: 9,
      cooldownMs: 300000, maxDailyLoans: 10, providerFeeShare: 80,
    },
    providerStats: {
      currentBalance: 0,
      currentBalanceFixed8: "0",
      totalDeposited: 0,
      totalDepositedFixed8: "0",
      totalFeesEarned: 0,
      totalFeesEarnedFixed8: "0",
    },
    depositCapability: { status: "ready", reason: "" },
    writeCapability: { status: "ready", reason: "" },
    contractHealth: { status: "ready", checkedAt: Date.now() },
    borrowerEligibility: {
      verified: true,
      canBorrow: true,
      maxAvailableLoan: 12.5,
      maxAvailableLoanFixed8: "1250000000",
      cooldownRemaining: 0,
      dailyLoansRemaining: 10,
    },
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(base).map(([k, v]) => [k, createObservable(v)]),
  );
}

function launchParams(params: Record<string, string> = {}) {
  return {
    appId: "miniapp-flashloan",
    network: "testnet" as const,
    params,
    path: "/miniapps/flashloan/index.html",
    query: "",
  };
}

describe("Flash Loan PlayArea (v2 scene-driven)", () => {
  it("renders a DeFi execution desk with the primary request action", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} launchContext={launchParams()} />);

    expect(container.querySelector(".flash-scene")).toBeTruthy();
    expect(container.querySelector(".flash-scene__art")).toBeNull();
    expect(container.querySelector(".flash-ticket")).toBeTruthy();
    expect(container.querySelector(".flash-callback-socket")).toBeTruthy();
    expect(container.querySelector(".flash-callback-socket__port")).toBeTruthy();
    expect(container.querySelector(".flash-callback-socket__copy")).toBeTruthy();
    expect(container.querySelector(".flash-callback-socket__target")).toBeTruthy();
    expect(container.querySelector(".flash-input--contract")).toBeNull();
    expect(container.textContent).toContain("Socket awaiting contract");
    expect(container.textContent).not.toContain("Add callback contract");
    expect((container.querySelector(".flash-route__visual img") as HTMLImageElement)?.src).toContain("flashloan-desk.webp");
    expect(container.querySelectorAll(".flash-route__step").length).toBe(4);
    expect(container.querySelector(".flash-simulation")).toBeTruthy();
    expect(container.querySelectorAll(".flash-simulation .mx2-coin").length).toBe(2);
    expect(container.textContent).toContain("Local preflight model, not a successful loan.");
    expect(container.querySelectorAll(".flash-readiness__item").length).toBe(3);
    // Primary action.
    expect(container.querySelector(".mx2-btn--primary")).toBeTruthy();
  });

  it("keeps the amount form hidden behind a custom ticket affordance", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} launchContext={launchParams()} />);

    expect(container.querySelector(".flash-ticket__field")).toBeNull();
    expect(container.querySelector(".flash-ticket__preset[data-selected='true'] strong")?.textContent).toContain("1 GAS");

    fireEvent.click(screen.getByText("Custom"));
    expect(container.querySelector(".flash-ticket__field")).toBeTruthy();
  });

  it("prefills from launch params and dispatches requestLoan", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ address: "Ndb1n4zzgW9h1yW7rS7Pqz4CkL8xF9m2Aa" })}
        dispatch={dispatch}
        launchContext={launchParams({ amount: "10", callbackContract: "0x1234567890abcdef1234567890abcdef12345678" })}
      />,
    );

    expect(container.querySelector(".flash-callback-socket[data-ready='true']")).toBeTruthy();
    expect(container.textContent).toContain("Address and method accepted");

    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith("requestLoan", {
        amount: "10",
        callbackContract: "0x1234567890abcdef1234567890abcdef12345678",
        callbackMethod: "execute",
      }),
    );
  });

  it("keeps malformed callback targets out of the wallet action and marks the socket inline", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ address: "Ndb1n4zzgW9h1yW7rS7Pqz4CkL8xF9m2Aa" })}
        dispatch={vi.fn()}
        launchContext={launchParams({ callbackContract: "not-a-contract" })}
      />,
    );

    expect(container.querySelector('.flash-callback-socket[data-invalid="true"]')).toBeTruthy();
    expect((container.querySelector(".mx2-btn--primary") as HTMLButtonElement).disabled).toBe(true);
  });

  it("locks the execution ticket while a submitted request is still unconfirmed", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          address: "Ndb1n4zzgW9h1yW7rS7Pqz4CkL8xF9m2Aa",
          pendingRequestTxid: "0xpending",
        })}
        dispatch={vi.fn()}
        launchContext={launchParams({ callbackContract: "0x1234567890abcdef1234567890abcdef12345678" })}
      />,
    );

    expect((container.querySelector(".mx2-btn--primary") as HTMLButtonElement).disabled).toBe(true);
    expect(container.querySelector(".mx2-btn--primary")?.textContent).toContain("Confirming on-chain");
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>(".flash-ticket__preset")).every((button) => button.disabled)).toBe(true);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(screen.getByRole("tab", { name: /Provide liquidity/ }));
    expect(container.textContent).toContain("Resolve the other submitted financial action first.");
    expect(Array.from(container.querySelectorAll<HTMLButtonElement>(".flash-drawer__lp-actions button")).every((button) => button.disabled)).toBe(true);
  });

  it("keeps the exact pending transaction visible without treating it as success", () => {
    const txid = `0x${"a".repeat(64)}`;
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          address: "Ndb1n4zzgW9h1yW7rS7Pqz4CkL8xF9m2Aa",
          pendingRequestTxid: txid,
          serviceNotice: "Waiting for authoritative readback.",
        })}
        dispatch={vi.fn()}
        launchContext={launchParams({ callbackContract: "0x1234567890abcdef1234567890abcdef12345678" })}
      />,
    );

    const proof = container.querySelector(".flash-scene__status .flash-txid") as HTMLElement;
    expect(proof.textContent).toContain("0xaaaaaaaa");
    expect(proof.title).toBe(txid);
    expect(container.textContent).toContain("Waiting for authoritative readback.");
    expect(container.textContent).not.toContain("Loan executed");
  });

  it("does not animate the loan route for a different financial operation", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          address: "Ndb1n4zzgW9h1yW7rS7Pqz4CkL8xF9m2Aa",
          isLoading: true,
          writeOperation: "deposit",
        })}
        dispatch={vi.fn()}
        launchContext={launchParams({ callbackContract: "0x1234567890abcdef1234567890abcdef12345678" })}
      />,
    );

    expect(container.querySelector(".flash-scene")?.getAttribute("data-state")).toBe("ready");
    expect(container.querySelector(".mx2-btn--primary")?.textContent).toContain("Financial action in progress");
    expect(container.querySelector(".mx2-btn--primary")?.textContent).not.toContain("Requesting");
  });

  it("fails closed when live contract state is not ready", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          address: "Ndb1n4zzgW9h1yW7rS7Pqz4CkL8xF9m2Aa",
          contractHealth: { status: "unavailable", checkedAt: Date.now() },
        })}
        dispatch={vi.fn()}
        launchContext={launchParams({ callbackContract: "0x1234567890abcdef1234567890abcdef12345678" })}
      />,
    );

    expect((container.querySelector(".mx2-btn--primary") as HTMLButtonElement).disabled).toBe(true);
    expect(container.textContent).toContain("Contract unavailable");
  });

  it("edits callback setup from the drawer and dispatches requestLoan", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ address: "Ndb1n4zzgW9h1yW7rS7Pqz4CkL8xF9m2Aa" })}
        dispatch={dispatch}
        launchContext={launchParams()}
      />,
    );

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.querySelector(".flash-drawer__panel--setup")).toBeTruthy();
    const callbackInput = container.querySelector(".flash-drawer__field--callback input") as HTMLInputElement;
    fireEvent.change(callbackInput, { target: { value: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" } });
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith("requestLoan", {
        amount: "1",
        callbackContract: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        callbackMethod: "execute",
      }),
    );
  });

  it("lets testnet users bind the verified callback resource without typing hashes", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state()}
        dispatch={vi.fn()}
        launchContext={launchParams()}
      />,
    );

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(screen.getByRole("button", { name: /Verified testnet callback harness/ }));
    expect((container.querySelector(".flash-drawer__field--callback input") as HTMLInputElement).value)
      .toBe("0x7aa01290d33f6b2313a7efd6acde58f3e64b636f");
    expect((container.querySelector(".flash-drawer__field--callback-method input") as HTMLInputElement).value)
      .toBe("execute");
  });

  it("does not invent a mainnet callback method or expose the testnet harness", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state()}
        dispatch={vi.fn()}
        launchContext={{ ...launchParams(), network: "mainnet" as const }}
      />,
    );

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.querySelector(".flash-harness-card")).toBeNull();
    expect((container.querySelector(".flash-drawer__field--callback-method input") as HTMLInputElement).value).toBe("");
  });

  it("shows mainnet as readable while disabling its unconfigured receipt-deposit lane", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          address: "0x2222222222222222222222222222222222222222",
          depositCapability: { status: "unavailable", reason: "payment-hub-unavailable" },
          providerStats: { currentBalance: 1, totalDeposited: 1, totalFeesEarned: 0 },
        })}
        dispatch={vi.fn()}
        launchContext={{ ...launchParams(), network: "mainnet" as const }}
      />,
    );

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(screen.getByRole("tab", { name: /Provide liquidity/ }));
    const amount = container.querySelector(".flash-drawer__panel--liquidity .flash-drawer__field input") as HTMLInputElement;
    fireEvent.change(amount, { target: { value: "1" } });
    const [deposit, withdraw] = Array.from(container.querySelectorAll<HTMLButtonElement>(".flash-drawer__lp-actions button"));
    expect(container.textContent).toContain("Mainnet PaymentHub is not configured.");
    expect(screen.queryByText("Payment Receipt ID")).toBeNull();
    expect(deposit.disabled).toBe(true);
    expect(withdraw.disabled).toBe(false);
  });

  it("connects the wallet when no address is set", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} launchContext={launchParams()} />);

    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    expect(dispatch).toHaveBeenCalledWith("connectWallet");
  });

  it("dispatches deposit/withdraw liquidity from the drawer", async () => {
    const dispatch = vi.fn().mockResolvedValue(true);
    const { container } = render(
      <PlayArea t={t} state={state()} dispatch={dispatch} launchContext={launchParams()} />,
    );

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.querySelector(".mx2-drawer--open")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: /Provide liquidity/ }));

    const liquidityInput = container.querySelector(".flash-drawer__panel--liquidity .flash-drawer__field input") as HTMLInputElement;
    fireEvent.change(liquidityInput, { target: { value: "5" } });

    const buttons = container.querySelectorAll(".flash-drawer__lp-actions button");
    fireEvent.click(buttons[0]); // deposit
    expect(dispatch).toHaveBeenCalledWith("provideLiquidity", { amount: "5", receiptId: undefined });
    await waitFor(() => expect(liquidityInput.value).toBe(""));
  });

  it("preserves liquidity input when the wallet action fails", async () => {
    const dispatch = vi.fn().mockResolvedValue(false);
    const { container } = render(
      <PlayArea t={t} state={state()} dispatch={dispatch} launchContext={launchParams()} />,
    );

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(screen.getByRole("tab", { name: /Provide liquidity/ }));
    const liquidityInput = container.querySelector(".flash-drawer__panel--liquidity .flash-drawer__field input") as HTMLInputElement;
    fireEvent.change(liquidityInput, { target: { value: "5" } });
    fireEvent.click(container.querySelectorAll(".flash-drawer__lp-actions button")[0]);

    await waitFor(() => expect(dispatch).toHaveBeenCalled());
    expect(liquidityInput.value).toBe("5");
  });

  it("keeps malformed and over-balance liquidity actions out of the wallet", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ providerStats: { currentBalance: 2, totalDeposited: 2, totalFeesEarned: 0 } })}
        dispatch={vi.fn()}
        launchContext={launchParams()}
      />,
    );

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(screen.getByRole("tab", { name: /Provide liquidity/ }));
    const liquidityInput = container.querySelector(".flash-drawer__panel--liquidity .flash-drawer__field input") as HTMLInputElement;
    const [deposit, withdraw] = Array.from(container.querySelectorAll<HTMLButtonElement>(".flash-drawer__lp-actions button"));

    fireEvent.change(liquidityInput, { target: { value: "1abc" } });
    expect(deposit.disabled).toBe(true);
    expect(withdraw.disabled).toBe(true);

    fireEvent.change(liquidityInput, { target: { value: "3" } });
    expect(deposit.disabled).toBe(false);
    expect(withdraw.disabled).toBe(true);

    fireEvent.change(liquidityInput, { target: { value: "2" } });
    expect(deposit.disabled).toBe(false);
    expect(withdraw.disabled).toBe(false);
  });

  it("locks liquidity controls while a provider-balance change is unconfirmed", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ pendingLiquidityTxid: "0xpending-liquidity" })}
        dispatch={vi.fn()}
        launchContext={launchParams()}
      />,
    );
    const primary = container.querySelector(".mx2-action-rail .mx2-btn--primary") as HTMLButtonElement;
    expect(primary.disabled).toBe(false);
    expect(primary.textContent).toContain("Connect to recover");

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(screen.getByRole("tab", { name: /Provide liquidity/ }));
    const liquidityInput = container.querySelector(".flash-drawer__panel--liquidity .flash-drawer__field input") as HTMLInputElement;
    expect(liquidityInput.disabled).toBe(true);
    expect(container.textContent).toContain("Liquidity confirmation pending.");
  });

  it("offers a finalize-only recovery after a testnet payment was broadcast", () => {
    const dispatch = vi.fn().mockResolvedValue(true);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          pendingLiquidityTxid: `0x${"d".repeat(64)}`,
          pendingLiquidityStage: "resume",
          pendingLiquidityAmount: "1",
        })}
        dispatch={dispatch}
        launchContext={launchParams()}
      />,
    );

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(screen.getByRole("tab", { name: /Provide liquidity/ }));
    expect(container.textContent).toContain("Resume 1 GAS without paying again.");
    fireEvent.click(screen.getByRole("button", { name: /Resume deposit — no new payment/ }));
    expect(dispatch).toHaveBeenCalledWith("resumePendingLiquidity");
  });

  it("dispatches loan lookup from the drawer", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea t={t} state={state()} dispatch={dispatch} launchContext={launchParams()} />,
    );

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(screen.getByRole("tab", { name: /Loan lookup/ }));
    const lookupInput = container.querySelector(".flash-drawer__lookup .flash-drawer__field input") as HTMLInputElement;
    fireEvent.change(lookupInput, { target: { value: "2" } });
    fireEvent.click(container.querySelector(".flash-drawer__lookup button") as Element);
    expect(dispatch).toHaveBeenCalledWith("lookupLoan", "2");
  });

  it("keeps lookup loading separate from financial execution", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ isLookupLoading: true })}
        dispatch={vi.fn()}
        launchContext={launchParams()}
      />,
    );

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(screen.getByRole("tab", { name: /Loan lookup/ }));
    const input = container.querySelector(".flash-drawer__lookup input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "2" } });
    const button = container.querySelector(".flash-drawer__lookup button") as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toContain("Checking on-chain");
    expect(container.querySelector(".flash-scene")?.getAttribute("data-state")).toBe("ready");
  });

  it("renders recent loans inside the drawer", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ recentLoans: [{ id: 1, amount: "10", fee: "0.009", status: "success" }] })}
        dispatch={vi.fn()}
        launchContext={launchParams()}
      />,
    );

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(screen.getByRole("tab", { name: /Recent loans/ }));
    expect(container.textContent).toContain("#1");
  });

  it("uses designed Open UI panels for the flash-loan tools drawer", () => {
    const { container } = render(
      <PlayArea t={t} state={state()} dispatch={vi.fn()} launchContext={launchParams()} />,
    );

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);

    expect(container.querySelector(".flash-drawer")).toBeTruthy();
    expect(container.querySelectorAll(".flash-drawer__tabs [role='tab']")).toHaveLength(5);
    expect(container.querySelectorAll(".flash-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(container.querySelector(".flash-drawer__panel--setup")).toBeTruthy();
    expect(container.querySelector(".flash-setup-summary")).toBeTruthy();
    expect(container.querySelectorAll(".flash-drawer__field.mx2-open-field .mx2-open-field__control input.semi-input")).toHaveLength(2);
    expect(container.querySelector(".flash-drawer__input")).toBeNull();
    expect(container.querySelector(".flash-drawer h4")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: /Provide liquidity/ }));
    expect(container.querySelectorAll(".flash-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(container.querySelector(".flash-drawer__lp-stats")).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: /Contract parameters/ }));
    expect(container.querySelectorAll(".flash-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(container.querySelector(".flash-drawer__params-grid")).toBeTruthy();
  });

  it("keeps motion and low-noise DeFi hierarchy backed by tests", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const stylePath = [
      path.resolve(process.cwd(), "apps/flashloan/src/PlayArea.scss"),
      path.resolve(process.cwd(), "../flashloan/src/PlayArea.scss"),
    ].find((candidate) => fs.existsSync(candidate));
    expect(stylePath).toBeTruthy();
    const styles = fs.readFileSync(stylePath, "utf8");
    expect(styles).toContain("@use \"@shared/styles/v2/motion\"");
    expect(styles).toMatch(/--mx2-stage-floor:\s*#ffffff/);
    expect(styles).toMatch(/flash-scene\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/flash-scene__workspace[\s\S]*grid-template-areas/);
    expect(styles).toMatch(/flash-ticket__preset-grid[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/flash-route__visual\s*\{[\s\S]*background:\s*#f8fffb/);
    expect(styles).toMatch(/flash-route__visual img\s*\{[\s\S]*object-fit:\s*cover/);
    expect(styles).toMatch(/flash-route__visual img\s*\{[^}]*filter:\s*none/);
    expect(styles).not.toMatch(/backdrop-filter/);
    expect(styles).not.toMatch(/gradient/);
    expect(styles).not.toMatch(/flash-scene__art/);
    expect(styles).not.toMatch(/flash-scene::before/);
    expect(styles).not.toMatch(/flash-scene::after/);
    expect(styles).not.toMatch(/background-image:\s*url/);
    expect(styles).not.toMatch(/background:\s*rgba\(255,\s*255,\s*255,\s*0\.[0-8]/);
    expect(styles).toMatch(/flash-pool,[\s\S]*flash-ticket,[\s\S]*flash-route,[\s\S]*flash-simulation,[\s\S]*flash-readiness__item[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/flashloan-play-area \.mx2-action-rail__row \.mx2-btn--primary[\s\S]*flex:\s*0 0 196px/);
    expect(styles).toMatch(/flash-callback-socket\s*\{[\s\S]*grid-template-areas/);
    expect(styles).toMatch(/flash-callback-socket__row[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\)/);
    expect(styles).toMatch(/\.flash-drawer__tabs\s*\{[\s\S]*grid-template-columns:\s*repeat\(5,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.flash-drawer__tabs button\s*\{[\s\S]*grid-template-areas:/);
    expect(styles).toMatch(/\.flash-setup-summary\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.flash-drawer__panel\.mx2-open-panel\.semi-card\s*\{[\s\S]*border-radius:\s*20px/);
    expect(styles).toMatch(/\.flash-drawer__lp-stats\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.flash-drawer__field-row\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.flash-drawer__lookup\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto/);
    expect(styles).toMatch(/\.flash-drawer__notice\.mx2-open-notice\.semi-banner\s*\{[\s\S]*min-height:\s*76px/);
    const mobileBlock = styles.match(/@media \(max-width:\s*640px\)\s*\{[\s\S]*$/)?.[0] ?? "";
    expect(mobileBlock).toMatch(/\.flash-scene__workspace\s*\{[\s\S]*grid-template-areas:\s*"ticket"\s*"pool"\s*"route"\s*"simulation"\s*"readiness"/);
    expect(mobileBlock).toMatch(/\.flash-simulation__ledger\s*\{[\s\S]*gap:\s*5px/);
    expect(mobileBlock).toMatch(/\.flash-ticket__preset-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(mobileBlock).toMatch(/\.flash-route__visual\s*\{[\s\S]*height:\s*96px/);
    expect(mobileBlock).toMatch(/\.flash-route__steps\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(mobileBlock).toMatch(/\.flash-readiness\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(mobileBlock).toMatch(/\.flash-pool\s*\{[\s\S]*display:\s*grid/);
    expect(mobileBlock).toMatch(/\.flashloan-play-area \.mx2-score\s*\{[\s\S]*display:\s*none/);
    expect(mobileBlock).toMatch(/\.flashloan-play-area \.mx2-action-rail\s*\{[\s\S]*position:\s*fixed/);
    expect(mobileBlock).toMatch(/\.flash-drawer__tabs\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(mobileBlock).toMatch(/\.flash-drawer,[\s\S]*\.flash-drawer__lookup\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(mobileBlock).not.toMatch(/font-size:\s*(?:8|9)px/);
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]*animation-duration:\s*0\.001ms/);
    expect(styles).not.toMatch(/\.flash-drawer__input/);
    expect(styles).not.toMatch(/\.flash-drawer__panel h4/);
  });
});
