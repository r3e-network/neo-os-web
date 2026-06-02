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

function t(key: string) {
  const messages: Record<string, string> = {
    title: "Flash Loan",
    flashloanInfo: "Callback contract receives and repays in one transaction.",
    walletRequired: "Wallet required",
    walletConnected: "Wallet connected",
    requestLoanTitle: "Request Flash Loan",
    loanAmount: "Loan Amount",
    amountPlaceholder: "Enter amount in GAS",
    amountPresets: "Amount presets",
    callbackContract: "Callback Contract",
    callbackContractPlaceholder: "0x...",
    callbackMethod: "Callback Method",
    connectWallet: "Connect Wallet",
    connectAndSign: "Connect and Sign",
    signRequestFlashLoan: "Sign requestFlashLoan",
    loanCalculator: "Loan Calculator",
    minLoan: "Min Loan",
    maxLoan: "Max Loan",
    estimatedFee: "Estimated Fee",
    totalRepayment: "Total Repayment",
    borrow: "Borrow",
    execute: "Execute",
    repay: "Repay",
    noRequestYet: "No transaction yet.",
    statusLookup: "Loan Status Lookup",
    loanId: "Loan ID",
    loanIdPlaceholder: "Enter loan ID",
    checkStatus: "Check Status",
    recentLoans: "Recent Executions",
    noHistory: "No executions yet",
    poolBalance: "Pool Balance",
    totalLoans: "Loans Executed",
    totalVolume: "Total Volume (GAS)",
    totalFees: "Total Fees (GAS)",
    notAvailable: "Unavailable",
  };
  return messages[key] ?? key;
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
});
