import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import { parseMiniAppLaunchContext } from "../utils/launch-params";
import PlayArea from "../../flashloan/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const CALLBACK = "0x1111111111111111111111111111111111111111";

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    title: "Flash Loan",
    eyebrow: "Atomic liquidity",
    flashloanInfo: "Callback contract receives and repays in one transaction.",
    walletRequired: "Wallet required",
    walletConnected: "Wallet connected",
    requestLoanEyebrow: "Atomic liquidity",
    requestLoanTitle: "Request Flash Loan",
    loanAmount: "Loan Amount",
    amountPlaceholder: "Enter amount in GAS",
    amountPresets: "Amount presets",
    callbackContract: "Callback Contract",
    callbackContractPlaceholder: "0x...",
    callbackMethod: "Callback Method",
    callbackPrerequisite: "Every loan needs an onFlashLoan callback contract.",
    viewCallbackExample: "View onFlashLoan example",
    connectWallet: "Connect Wallet",
    connectAndSign: "Connect and Sign",
    signRequestFlashLoan: "Sign requestFlashLoan",
    loanCalculatorEyebrow: "Calculator",
    loanCalculator: "Loan Calculator",
    minLoan: "Min Loan",
    maxLoan: "Max Loan",
    cooldownLabel: "Cooldown",
    cooldownValue: "{minutes} min between loans",
    dailyLimitLabel: "Daily Limit",
    dailyLimitValue: "{count} loans / day",
    estimatedFee: "Estimated Fee",
    totalRepayment: "Total Repayment",
    borrow: "Borrow",
    execute: "Execute",
    repay: "Repay",
    noRequestYet: "No transaction yet.",
    liquidityEyebrow: "Provide liquidity",
    liquidityTitle: "Provide Liquidity",
    liquidityInfo: "Deposit GAS to back flash loans and earn fees.",
    liquidityAmount: "Amount",
    liquidityAmountPlaceholder: "Enter GAS amount",
    yourLiquidity: "Your Liquidity",
    feesEarned: "Fees Earned",
    deposit: "Deposit",
    withdraw: "Withdraw",
    receiptIdLabel: "Payment Receipt ID",
    receiptIdPlaceholder: "Receipt ID from your GAS transfer",
    statusLookupEyebrow: "On-chain lookup",
    statusLookup: "Loan Status Lookup",
    loanId: "Loan ID",
    loanIdPlaceholder: "Enter loan ID",
    checkStatus: "Check Status",
    recentLoansEyebrow: "History",
    recentLoans: "Recent Executions",
    noHistory: "No executions yet",
    poolBalance: "Pool Balance",
    totalLoans: "Loans Executed",
    totalVolume: "Total Volume (GAS)",
    totalFees: "Total Fees (GAS)",
    statusLabel: "Status",
    feeShort: "Fee",
    amount: "Amount",
    latestTx: "Latest Tx",
    borrower: "Borrower",
    notAvailable: "Unavailable",
  };
  const raw = messages[key] ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? ""));
}

function launch(url: string) {
  return parseMiniAppLaunchContext(url, "miniapp-flashloan");
}

function baseState(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    isLoading: false,
    address: "",
    poolBalance: 12.5,
    totalLoans: 2,
    totalVolume: 10,
    totalFees: 0.009,
    validationError: "",
    serviceNotice: "",
    loanDetails: null,
    recentLoans: [],
    lastRequest: null,
    contractStats: {
      minLoan: 1,
      maxLoan: 100000,
      feeBasisPoints: 9,
      cooldownMs: 300000,
      maxDailyLoans: 10,
    },
    providerStats: {
      currentBalance: 0,
      totalDeposited: 0,
      totalFeesEarned: 0,
    },
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      createObservable(value),
    ]),
  );
}

function props(
  overrides: Partial<React.ComponentProps<typeof PlayArea>> = {},
): React.ComponentProps<typeof PlayArea> {
  return {
    t,
    state: baseState(),
    dispatch: vi.fn(async () => undefined),
    services: {} as never,
    status: null,
    setStatus: vi.fn(),
    clearStatus: vi.fn(),
    loadError: null,
    retryLoad: vi.fn(async () => undefined),
    launchContext: launch("https://neomini.app/miniapps/flashloan/index.html"),
    ...overrides,
  };
}

afterEach(() => cleanup());

describe("Flashloan PlayArea", () => {
  it("prefills request fields from launch params and dispatches requestLoan", async () => {
    const dispatch = vi.fn(async () => undefined);
    render(
      <PlayArea
        {...props({
          dispatch,
          launchContext: launch(
            `https://neomini.app/miniapps/flashloan/index.html?network=testnet&operation=requestLoan&amount=1&callbackContract=${CALLBACK}`,
          ),
        })}
      />,
    );

    expect((screen.getByLabelText("Loan Amount") as HTMLInputElement).value).toBe("1");
    expect((screen.getByLabelText("Callback Contract") as HTMLInputElement).value).toBe(CALLBACK);

    fireEvent.click(screen.getByRole("button", { name: "Connect and Sign" }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("requestLoan", {
        amount: "1",
        callbackContract: CALLBACK,
        callbackMethod: "onFlashLoan",
      });
    });
  });

  it("keeps wallet connection as a visible frontend action", async () => {
    const dispatch = vi.fn(async () => undefined);
    render(<PlayArea {...props({ dispatch })} />);

    fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("connectWallet");
    });
  });

  it("renders a service notice banner when stats reads fail", () => {
    render(
      <PlayArea
        {...props({
          state: baseState({
            serviceNotice: "Live pool stats are temporarily unavailable.",
          }),
        })}
      />,
    );

    expect(
      screen.getByText("Live pool stats are temporarily unavailable."),
    ).toBeTruthy();
  });

  it("does not render the service notice banner when stats are healthy", () => {
    render(<PlayArea {...props()} />);
    expect(screen.queryByText(/temporarily unavailable/i)).toBeNull();
  });

  it("dispatches provideLiquidity from the LP surface on testnet (no receipt id)", async () => {
    const dispatch = vi.fn(async () => undefined);
    render(
      <PlayArea
        {...props({
          dispatch,
          launchContext: launch(
            "https://neomini.app/miniapps/flashloan/index.html?network=testnet",
          ),
        })}
      />,
    );

    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "5" } });
    fireEvent.click(screen.getByRole("button", { name: "Deposit" }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("provideLiquidity", {
        amount: "5",
        receiptId: undefined,
      });
    });
  });

  it("dispatches withdrawLiquidity with the entered amount", async () => {
    const dispatch = vi.fn(async () => undefined);
    render(<PlayArea {...props({ dispatch })} />);

    fireEvent.change(screen.getByLabelText("Amount"), { target: { value: "2" } });
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("withdrawLiquidity", { amount: "2" });
    });
  });
});
