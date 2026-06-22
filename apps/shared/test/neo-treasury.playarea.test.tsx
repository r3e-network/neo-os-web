import React from "react";
import { readFileSync } from "node:fs";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import { BLOCKCHAIN_CONSTANTS } from "../constants";
import { parseMiniAppLaunchContext } from "../utils/launch-params";
import PlayArea from "../../neo-treasury/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const RECIPIENT = "NZeAarn3UMCqNsTymTMF2Pn6X7Yw3GhqDv";

function t(key: string) {
  const messages: Record<string, string> = {
    title: "Neo Treasury",
    docSubtitle: "Foundation wallet transparency",
    docDescription: "Treasury balances and payouts",
    treasuryInfo: "Treasury Info",
    sidebarTotalUsd: "Total USD",
    tokenNeo: "NEO",
    tokenGas: "GAS",
    treasuryLiveStatus: "Live balance status",
    treasuryLiveSynced: "Live balances synced",
    treasuryLiveLoading: "Reading public chain data",
    treasuryLivePending: "Live data pending",
    treasurySyncedHint: "Totals are assembled from public balances.",
    treasuryPendingHint: "Public balances load independently.",
    operationsTitle: "Treasury operations",
    operationsEyebrow: "Connected wallet",
    operationsGuardrail: "Policy boundary",
    disbursementTitle: "Disbursement console",
    disbursementBoundary: "Submit a real NEP-17 transfer.",
    policyTitle: "Treasury control path",
    policyCopy: "Separate oversight from execution.",
    policyStep1: "Review public balances",
    policyStep2: "Prepare payout intent",
    policyStep3: "Sign and verify txid",
    wallet: "Wallet",
    walletRequired: "Wallet required",
    walletConnected: "Wallet connected",
    connectWallet: "Connect Wallet",
    network: "Network",
    networkMainnet: "Neo N3 Mainnet",
    networkTestnet: "Neo N3 Testnet",
    status: "Status",
    asset: "Asset",
    assetGasHint: "Fee token, fine-grained",
    assetGasMeta: "8 decimals",
    assetNeoHint: "Governance token",
    assetNeoMeta: "Whole units",
    amount: "Amount",
    recipient: "Recipient",
    memo: "Memo",
    memoDetails: "Memo / reference",
    amountPresets: "Amount presets",
    reviewTitle: "Transfer review",
    reviewAsset: "Asset",
    reviewAmount: "Amount",
    reviewRecipient: "Recipient",
    intentTitle: "Signing intent",
    intentReady: "NEP-17 transfer ready",
    intentWaiting: "Waiting for payout details",
    intentWaitingCopy: "Enter payout details to preview the signing intent.",
    intentIssue: "Fix payout details",
    intentContract: "Native contract",
    intentFixed8: "Fixed amount",
    intentRecipientHash: "Recipient Hash160",
    intentSigner: "Signer",
    intentSignerConnect: "Connect on submit",
    submitDisbursement: "Sign Disbursement",
    connectAndSignDisbursement: "Connect & Sign Disbursement",
    disbursementDraftReady: "Draft ready",
    disbursementSubmitted: "Transfer submitted",
    treasuryFlowAsset: "Asset ready",
    treasuryFlowChecks: "Payout readiness checks",
    treasuryFlowDraft: "Draft in progress",
    treasuryFlowError: "Fix payout details",
    treasuryFlowIdle: "Connect or draft a payout",
    treasuryFlowReady: "Ready for wallet review",
    treasuryFlowRecipient: "Recipient",
    treasuryFlowSignature: "Wallet signature",
    treasuryFlowSigning: "Awaiting wallet signature",
    treasuryFlowSource: "Source wallet",
    treasuryFlowSubtitle: "Review the source wallet, asset, recipient, and signing state before the wallet opens.",
    treasuryFlowTitle: "Treasury payout route",
    lastTx: "Last tx",
    treasuryWatchlist: "Watched treasury groups",
    treasuryGroup: "Treasury group",
    addresses: "addresses",
    walletList: "Wallet List",
    treasuryReadOnlyRoute: "Transparency and payout route",
    step1: "Fetch live chain balances",
    step2: "View treasury balance",
    step4: "Sign a controlled payout",
    feature3Desc: "Connected wallet spend only.",
    refreshData: "Refresh Data",
    refreshing: "Refreshing...",
    lastUpdated: "Last updated",
    treasuryStale: "Showing cached data",
    treasuryWalletsUnreachable: "{count} wallets unreachable",
    treasuryPriceFeedUnavailable: "Price feed unavailable — USD totals hidden",
    treasuryWatchlistNetwork: "Watchlist data: Mainnet",
    currencySymbol: "$",
    loading: "Loading...",
    retry: "Retry",
  };
  return messages[key] ?? key;
}

// Mirror the interpolating `t` the host provides so {count} resolves like prod.
function ti(key: string, params?: Record<string, string | number>) {
  const raw = t(key);
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}

function launch(url: string) {
  return parseMiniAppLaunchContext(url, "miniapp-neo-treasury");
}

function baseState(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    loading: false,
    error: "",
    data: null,
    address: "",
    disbursementSubmitting: false,
    disbursementStatus: "Draft ready",
    disbursementError: "",
    lastTxid: "",
    lastIntent: null,
    totalUsdDisplay: "Unavailable",
    totalNeoDisplay: "Unavailable",
    totalGasDisplay: "Unavailable",
    founderCount: 0,
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
    launchContext: launch("https://neomini.app/miniapps/neo-treasury/index.html"),
    ...overrides,
  };
}

afterEach(() => cleanup());

describe("Neo Treasury PlayArea", () => {
  it("prefills disbursement fields from launch params and dispatches submit", async () => {
    const dispatch = vi.fn(async () => undefined);
    const { container } = render(
      <PlayArea
        {...props({
          dispatch,
          launchContext: launch(
            `https://neomini.app/miniapps/neo-treasury/index.html?network=testnet&operation=submitDisbursement&asset=GAS&amount=0.1&recipient=${RECIPIENT}&memo=ops`,
          ),
        })}
      />,
    );

    expect((screen.getByLabelText("Amount") as HTMLInputElement).value).toBe("0.1");
    expect((screen.getByLabelText("Recipient") as HTMLInputElement).value).toBe(RECIPIENT);
    expect((screen.getByLabelText("Memo") as HTMLTextAreaElement).value).toBe("ops");
    expect(screen.getByText("NEP-17 transfer ready")).toBeTruthy();
    expect(screen.getByText("10000000")).toBeTruthy();
    expect(screen.getByTitle(BLOCKCHAIN_CONSTANTS.GAS_HASH)).toBeTruthy();
    expect(screen.getByText("Connect on submit")).toBeTruthy();
    expect(container.querySelector(".treasury-flow-stage--ready")).toBeTruthy();
    expect(container.querySelector('.treasury-flow-stage__media source[srcset="./banner.avif"]')).toBeTruthy();
    expect(container.querySelector('.treasury-flow-transfer img[src="./logo.jpg"]')).toBeTruthy();
    expect(container.querySelector(".treasury-flow-transfer.is-ready")).toBeTruthy();
    expect(container.querySelectorAll(".treasury-flow-checks .is-ready").length).toBe(3);

    fireEvent.click(screen.getByRole("button", { name: /Sign Disbursement/ }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("submitDisbursement", {
        asset: "GAS",
        amount: "0.1",
        recipient: RECIPIENT,
        memo: "ops",
      });
    });
  });

  it("switches the payout asset with the visual asset cards before submit", async () => {
    const dispatch = vi.fn(async () => undefined);
    render(
      <PlayArea
        {...props({
          dispatch,
          launchContext: launch(
            `https://neomini.app/miniapps/neo-treasury/index.html?network=testnet&operation=submitDisbursement&asset=GAS&amount=1&recipient=${RECIPIENT}`,
          ),
        })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Governance token/ }));

    expect(screen.getByText("Whole units")).toBeTruthy();
    expect(screen.getAllByText("1 NEO").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole("button", { name: /Sign Disbursement/ }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("submitDisbursement", {
        asset: "NEO",
        amount: "1",
        recipient: RECIPIENT,
        memo: "",
      });
    });
  });

  it("keeps wallet connection available as a dedicated frontend action", async () => {
    const dispatch = vi.fn(async () => undefined);
    render(<PlayArea {...props({ dispatch })} />);

    fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("connectWallet");
    });
  });

  it("blocks signing before wallet invocation when payout details are invalid", () => {
    render(
      <PlayArea
        {...props({
          launchContext: launch(
            "https://neomini.app/miniapps/neo-treasury/index.html?network=testnet&operation=submitDisbursement&asset=GAS&amount=0.1&recipient=bad-recipient",
          ),
        })}
      />,
    );

    expect(screen.getAllByText("Fix payout details").length).toBeGreaterThan(0);
    expect(screen.getByText(/Recipient must be a valid Neo N3 address or Hash160/)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: /Sign Disbursement/ }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  function liveData(overrides: Record<string, unknown> = {}) {
    return {
      totalUsd: 5000,
      totalNeo: 100,
      totalGas: 50,
      lastUpdated: 0,
      prices: { neo: 5, gas: 1 },
      failedCount: 0,
      categories: [
        {
          name: "Da Hongfei",
          totalNeo: 100,
          totalGas: 50,
          totalUsd: 5000,
          failedCount: 0,
          wallets: [
            { label: "Da Wallet 1", address: "NgebdUkFxSbzLMruXopuBw4aKsXX8sTyxw", neo: 100, gas: 50 },
          ],
        },
      ],
      ...overrides,
    };
  }

  it("shows the amber cached signal (not 'live synced') when serving stale data", () => {
    render(
      <PlayArea
        {...props({
          t: ti,
          state: baseState({ data: liveData(), stale: true }),
        })}
      />,
    );

    expect(screen.getByText(/Showing cached data/)).toBeTruthy();
    expect(screen.queryByText(/Live balances synced/)).toBeNull();
  });

  it("warns when wallets are unreachable and marks the failed row with an em-dash", () => {
    render(
      <PlayArea
        {...props({
          t: ti,
          state: baseState({
            data: liveData({
              failedCount: 1,
              categories: [
                {
                  name: "Da Hongfei",
                  totalNeo: 0,
                  totalGas: 0,
                  totalUsd: 0,
                  failedCount: 1,
                  wallets: [
                    { label: "Da Wallet 1", address: "Nfail", neo: 0, gas: 0, failed: true },
                  ],
                },
              ],
            }),
          }),
        })}
      />,
    );

    expect(screen.getAllByText(/1 wallets unreachable/).length).toBeGreaterThan(0);
    // The failed wallet row shows em-dashes, not "0 NEO / 0 GAS".
    expect(screen.getByText("— / —")).toBeTruthy();
  });

  it("hides USD totals with a notice when the price feed is unavailable", () => {
    render(
      <PlayArea
        {...props({
          t: ti,
          state: baseState({
            data: liveData({
              totalUsd: null,
              prices: null,
              categories: [
                {
                  name: "Da Hongfei",
                  totalNeo: 100,
                  totalGas: 50,
                  totalUsd: null,
                  failedCount: 0,
                  wallets: [],
                },
              ],
            }),
          }),
        })}
      />,
    );

    expect(screen.getByText(/Price feed unavailable/)).toBeTruthy();
  });

  it("labels the watchlist data source as mainnet", () => {
    render(
      <PlayArea {...props({ t: ti, state: baseState({ data: liveData() }) })} />,
    );
    expect(screen.getByText("Watchlist data: Mainnet")).toBeTruthy();
  });

  it("keeps treasury payout motion explicit and reduced-motion safe", () => {
    const css = readFileSync(
      `${process.cwd()}/../neo-treasury/src/PlayArea.scss`,
      "utf8",
    );

    expect(css).toContain("@keyframes treasury-flow-sweep");
    expect(css).toContain("@keyframes treasury-flow-line");
    expect(css).toContain("@keyframes treasury-flow-transfer-ready");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(".treasury-flow-stage--ready");
    expect(css).toContain("animation: none");
  });
});
