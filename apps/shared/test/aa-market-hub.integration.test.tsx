import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../aa-market-hub/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const WALLET = "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32";
const MARKET = "0x8dbd4cf6fc47afc013e7fd7128d028db2985bddf";
const ACCOUNT = "0x0102030405060708090a0b0c0d0e0f1011121314";

afterEach(() => cleanup());

function t(key: string) {
  return key;
}

function state(values: Partial<Record<string, unknown>> = {}): ObservableState {
  const defaults: Record<string, unknown> = {
    mode: "explore",
    network: "testnet",
    marketHash: MARKET,
    aaContractHash: "0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2",
    listings: [],
    dataSource: "chain",
    pendingOperation: null,
  };
  return Object.fromEntries(
    Object.entries({ ...defaults, ...values }).map(([key, value]) => [key, createObservable(value)]),
  ) as ObservableState;
}

function primary(container: HTMLElement): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(".mx2-btn--primary");
  expect(button).not.toBeNull();
  return button!;
}

describe("aa-market-hub production dispatch contract", () => {
  it("refreshes wallet-free discovery without exposing a host market-hash argument", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    expect(primary(container).textContent).toContain("refreshMarket");
    fireEvent.click(primary(container));

    expect(dispatch).toHaveBeenCalledWith("loadListings");
    expect(dispatch).not.toHaveBeenCalledWith("loadListings", expect.anything());
  });

  it("switches into the seller studio through the explicit mode action", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("radio", { name: "sellAnAddress" }));

    expect(dispatch).toHaveBeenCalledWith("setMode", "sell");
  });

  it("publishes the designed listing resource with business fields only", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          mode: "sell",
          walletAddress: WALLET,
          canCreateListing: true,
          accountIdHash: `  ${ACCOUNT}  `,
          priceGas: " 1.5 ",
          listingTitle: " Fresh AA shell ",
          metadataUri: " ipfs://fresh-shell ",
        })}
        dispatch={dispatch}
      />,
    );

    expect(container.querySelector(".aa-market-builder")).toBeTruthy();
    expect(container.querySelector(".aa-market-preview")).toBeTruthy();
    expect(primary(container).textContent).toContain("publishListing");
    fireEvent.click(primary(container));

    expect(dispatch).toHaveBeenCalledWith(
      "createListing",
      ACCOUNT,
      "1.5",
      "Fresh AA shell",
      "ipfs://fresh-shell",
    );
    expect(dispatch).not.toHaveBeenCalledWith(
      "createListing",
      expect.stringMatching(/^0x[0-9a-f]{40}$/i),
      expect.stringMatching(/^0x[0-9a-f]{40}$/i),
      expect.anything(),
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it("routes a canonical listing purchase through the selected business action", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const listing = {
      id: "7",
      title: "Fresh AA shell",
      priceGas: "1.5",
      status: "active",
      isCanonicalAA: true,
      pendingPaymentKnown: true,
      myPendingPayment: "0",
      accountIdHash: ACCOUNT,
    };
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          walletAddress: WALLET,
          listings: [listing],
          selectedListing: listing,
          canBuySelectedListing: true,
        })}
        dispatch={dispatch}
      />,
    );

    expect(primary(container).textContent).toContain("buyForGas");
    fireEvent.click(primary(container));

    expect(dispatch).toHaveBeenCalledWith("buySelected", WALLET);
  });

  it("makes pending recovery the single primary action", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          pendingOperation: { kind: "buy", txid: `0x${"ab".repeat(32)}` },
          transactionNotice: "transactionPending",
        })}
        dispatch={dispatch}
      />,
    );

    expect(primary(container).textContent).toContain("checkConfirmation");
    fireEvent.click(primary(container));

    expect(dispatch).toHaveBeenCalledWith("recoverPending");
  });
});
