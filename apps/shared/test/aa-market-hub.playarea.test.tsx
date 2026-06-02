import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import { parseMiniAppLaunchContext } from "../utils/launch-params";
import PlayArea from "../../aa-market-hub/src/PlayArea";
import type { MarketListing } from "../../aa-market-hub/src/utils/aa-market";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

const MARKET_HASH = "0x8dbd4cf6fc47afc013e7fd7128d028db2985bddf";
const AA_CORE_HASH = "0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2";
const ACCOUNT_ID_HASH = "0x1111111111111111111111111111111111111111";

function t(key: string) {
  const messages: Record<string, string> = {
    marketHeroTitle: "AA address market",
    hubSummary: "Trade deterministic AA addresses through escrow.",
    marketMetricsLabel: "Market overview",
    marketMetricListings: "Listings",
    marketMetricActive: "Active",
    selectedListingLabel: "Selected",
    notAvailable: "Not available",
    marketStepsLabel: "Trading steps",
    marketStepConnect: "Connect wallet",
    marketStepConnectDesc: "Connect a wallet before writes.",
    marketStepLoad: "Load market",
    marketStepLoadDesc: "Read listings from the selected market.",
    marketStepSettlement: "Settle safely",
    marketStepSettlementDesc: "Settle with AA shell transfer.",
    marketBoardLabel: "Live board",
    marketBoardTitle: "Listings",
    emptyStateTitle: "Market required",
    emptyStateEnterHash: "Enter a market hash.",
    emptyStateNoListingsTitle: "No listings",
    emptyStateNoListings: "No listings found.",
    walletConnected: "Wallet connected",
    walletNotConnected: "Wallet not connected",
    marketHash: "Market Hash",
    marketHashHint: "Required before loading listings or creating a market order.",
    marketHashPlaceholder: "0x...",
    connectWallet: "Connect Wallet",
    loadListings: "Load listings",
    createListingTitle: "Create listing",
    createListingMarketRequired: "Paste a market contract hash first.",
    createListingWalletRequired: "Connect a wallet before creating a listing.",
    aaContractInput: "AA Contract Hash",
    aaContractHint: "Defaults to the canonical AA core for the current network.",
    aaContractHashPlaceholder: "0x...",
    accountIdInput: "Account ID Hash",
    accountIdHint: "Paste the 20-byte Account ID hash.",
    accountIdHashPlaceholder: "0x...",
    priceInput: "Price (GAS)",
    pricePlaceholder: "18",
    titleInput: "Title",
    titlePlaceholder: "AA service package",
    metadataInput: "Metadata",
    metadataPlaceholder: "Optional metadata URI",
    createListingCta: "Create Listing",
    manageListingTitle: "Manage listing",
    noListingSelected: "Select a listing to manage it.",
    walletAndMarket: "Wallet & Market",
    walletLabel: "Wallet",
    notConnected: "not connected",
    tokenGas: "GAS",
    untitledListing: "Untitled listing",
    priceLabel: "Price",
    aaContractLabel: "AA Contract",
    accountIdLabel: "Account ID",
    sellerLabel: "Seller",
    buyerLabel: "Buyer",
    metadataLabel: "Metadata",
    viewMetadata: "View metadata",
    myPendingPayment: "My Pending",
    pendingRefund: "pending refund",
    mine: "mine",
    selectListing: "Select",
    selected: "Selected",
    selectListingHint: "Select a listing to manage it.",
    newPriceInput: "New Price (GAS)",
    newPriceHint: "Only the seller can update the price or cancel the listing.",
    newPricePlaceholder: "2",
    updatePriceCta: "Update Price",
    cancelListingCta: "Cancel Listing",
    newBackupOwnerInput: "New Backup Owner",
    newBackupOwnerHint: "Defaults to your connected wallet.",
    newBackupOwnerPlaceholder: "Neo address or 0x...",
    buyListingCta: "Buy Listing",
    refundPendingCta: "Refund Pending Payment",
  };
  return messages[key] ?? key;
}

function launch(url: string) {
  return parseMiniAppLaunchContext(url, "miniapp-aa-market-hub");
}

function baseState(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    listings: [],
    isLoading: false,
    isSubmitting: false,
    isWalletConnecting: false,
    marketHash: "",
    aaContractHash: AA_CORE_HASH,
    accountIdHash: "",
    priceGas: "",
    listingTitle: "",
    metadataUri: "",
    walletAddress: "",
    selectedListingId: "",
    selectedListing: null,
    selectedListingHasPendingRefund: false,
    canCreateListing: false,
    canManageSelectedListing: false,
    canBuySelectedListing: false,
    totalListingsDisplay: 0,
    activeListingsDisplay: 0,
    marketHashDisplay: "Not available",
    walletDisplay: "Not available",
    selectedListingDisplay: "Not available",
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      createObservable(value),
    ]),
  );
}

function listing(overrides: Partial<MarketListing> = {}): MarketListing {
  return {
    id: "7",
    aaContractHash: AA_CORE_HASH,
    accountIdHash: ACCOUNT_ID_HASH,
    sellerScriptHash: "2222222222222222222222222222222222222222",
    buyerScriptHash: "",
    seller: "0x2222222222222222222222222222222222222222",
    buyer: "",
    priceRaw: "1800000000",
    priceGas: "18",
    title: "AA service package",
    metadataUri: "ipfs://aa-service",
    statusCode: 1,
    status: "active",
    createdAt: "1",
    updatedAt: "2",
    myPendingPayment: "0",
    isMine: false,
    ...overrides,
  };
}

describe("AA Market Hub PlayArea launch flow", () => {
  it("prefills create-listing fields from the host action URL and dispatches all required contract inputs", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    render(
      <PlayArea
        t={t}
        state={baseState({ walletAddress: "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3" })}
        dispatch={dispatch}
        launchContext={launch(
          `https://neomini.app/miniapps/aa-market-hub?operation=prepareMiniAppOperation&network=testnet&marketHash=${MARKET_HASH}&aaContractHash=${AA_CORE_HASH}&accountIdHash=${ACCOUNT_ID_HASH}&priceGas=18&listingTitle=AA%20service%20package&metadataUri=ipfs%3A%2F%2Faa-service`,
        )}
      />,
    );

    expect((screen.getByLabelText("Market Hash") as HTMLInputElement).value).toBe(
      MARKET_HASH,
    );
    expect(
      (screen.getByLabelText("AA Contract Hash") as HTMLInputElement).value,
    ).toBe(AA_CORE_HASH);
    expect(
      (screen.getByLabelText("Account ID Hash") as HTMLInputElement).value,
    ).toBe(ACCOUNT_ID_HASH);
    expect((screen.getByLabelText("Price (GAS)") as HTMLInputElement).value).toBe(
      "18",
    );
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(
      "AA service package",
    );
    expect((screen.getByLabelText("Metadata") as HTMLTextAreaElement).value).toBe(
      "ipfs://aa-service",
    );

    fireEvent.click(screen.getByRole("button", { name: "Create Listing" }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        "createListing",
        MARKET_HASH,
        AA_CORE_HASH,
        ACCOUNT_ID_HASH,
        "18",
        "AA service package",
        "ipfs://aa-service",
      );
    });
  });

  it("uses runtime state defaults when no host launch params are present", () => {
    render(
      <PlayArea
        t={t}
        state={baseState({
          marketHash: MARKET_HASH,
          aaContractHash: AA_CORE_HASH,
        })}
        dispatch={vi.fn()}
        launchContext={launch("https://neomini.app/miniapps/aa-market-hub")}
      />,
    );

    expect((screen.getByLabelText("Market Hash") as HTMLInputElement).value).toBe(
      MARKET_HASH,
    );
    expect(
      (screen.getByLabelText("AA Contract Hash") as HTMLInputElement).value,
    ).toBe(AA_CORE_HASH);
  });

  it("does not offer create-listing submission before the embedded wallet is connected", () => {
    render(
      <PlayArea
        t={t}
        state={baseState()}
        dispatch={vi.fn()}
        launchContext={launch(
          `https://neomini.app/miniapps/aa-market-hub?marketHash=${MARKET_HASH}&aaContractHash=${AA_CORE_HASH}&accountIdHash=${ACCOUNT_ID_HASH}&priceGas=18`,
        )}
      />,
    );

    expect(
      screen.getByText("Connect a wallet before creating a listing."),
    ).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Create Listing" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("dispatches wallet and market loading actions from the operation panel", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    render(
      <PlayArea
        t={t}
        state={baseState()}
        dispatch={dispatch}
        launchContext={launch(
          `https://neomini.app/miniapps/aa-market-hub?marketHash=${MARKET_HASH}`,
        )}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));
    fireEvent.click(screen.getByRole("button", { name: "Load listings" }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("connectWallet");
      expect(dispatch).toHaveBeenCalledWith("loadListings", MARKET_HASH);
    });
  });

  it("keeps create-listing disabled for GAS prices that the contract parser rejects", () => {
    render(
      <PlayArea
        t={t}
        state={baseState({ walletAddress: "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3" })}
        dispatch={vi.fn()}
        launchContext={launch(
          `https://neomini.app/miniapps/aa-market-hub?marketHash=${MARKET_HASH}&aaContractHash=${AA_CORE_HASH}&accountIdHash=${ACCOUNT_ID_HASH}&priceGas=1e3`,
        )}
      />,
    );

    expect(
      (screen.getByRole("button", { name: "Create Listing" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("selects a listing from the live board", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    render(
      <PlayArea
        t={t}
        state={baseState({
          marketHash: MARKET_HASH,
          listings: [listing()],
          totalListingsDisplay: 1,
          activeListingsDisplay: 1,
        })}
        dispatch={dispatch}
        launchContext={launch("https://neomini.app/miniapps/aa-market-hub")}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Select" }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("selectListing", "7");
    });
  });

  it("dispatches seller management actions for the selected listing", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const selectedListing = listing({ isMine: true });

    render(
      <PlayArea
        t={t}
        state={baseState({
          marketHash: MARKET_HASH,
          walletAddress: "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3",
          listings: [selectedListing],
          selectedListingId: selectedListing.id,
          selectedListing,
          canManageSelectedListing: true,
          totalListingsDisplay: 1,
          activeListingsDisplay: 1,
        })}
        dispatch={dispatch}
        launchContext={launch("https://neomini.app/miniapps/aa-market-hub")}
      />,
    );

    fireEvent.change(screen.getByLabelText("New Price (GAS)"), {
      target: { value: "21.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Price" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancel Listing" }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("updatePrice", "21.5");
      expect(dispatch).toHaveBeenCalledWith("cancelSelected");
    });
  });

  it("dispatches buyer settlement and pending refund actions for the selected listing", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const selectedListing = listing({
      buyerScriptHash: "3333333333333333333333333333333333333333",
      buyer: "0x3333333333333333333333333333333333333333",
      myPendingPayment: "200000000",
    });

    render(
      <PlayArea
        t={t}
        state={baseState({
          marketHash: MARKET_HASH,
          walletAddress: "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3",
          listings: [selectedListing],
          selectedListingId: selectedListing.id,
          selectedListing,
          selectedListingHasPendingRefund: true,
          canBuySelectedListing: true,
          totalListingsDisplay: 1,
          activeListingsDisplay: 1,
        })}
        dispatch={dispatch}
        launchContext={launch("https://neomini.app/miniapps/aa-market-hub")}
      />,
    );

    fireEvent.change(screen.getByLabelText("New Backup Owner"), {
      target: { value: "0x4444444444444444444444444444444444444444" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buy Listing" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Refund Pending Payment" }),
    );

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        "buySelected",
        "0x4444444444444444444444444444444444444444",
      );
      expect(dispatch).toHaveBeenCalledWith("refundSelected");
    });
  });
});
