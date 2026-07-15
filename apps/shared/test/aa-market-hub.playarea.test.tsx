import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../aa-market-hub/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const WALLET = "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32";
const MARKET = "0x8dbd4cf6fc47afc013e7fd7128d028db2985bddf";
const AA_CORE = "0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2";
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
    aaContractHash: AA_CORE,
    walletAddress: WALLET,
    walletDisplay: "NR3E4D8N…Nih32",
    listings: [],
    dataSource: "chain",
    pendingOperation: null,
  };
  return Object.fromEntries(
    Object.entries({ ...defaults, ...values }).map(([key, value]) => [key, createObservable(value)]),
  ) as ObservableState;
}

function listing(overrides: Record<string, unknown> = {}) {
  return {
    id: "7",
    title: "Fresh AA shell",
    priceRaw: "150000000",
    priceGas: "1.5",
    status: "active",
    isMine: false,
    isCanonicalAA: true,
    pendingPaymentKnown: true,
    myPendingPayment: "0",
    accountIdHash: ACCOUNT,
    seller: "0xaabbccddeeff00112233445566778899aabbccdd",
    metadataUri: "ipfs://fresh-aa",
    ...overrides,
  };
}

describe("aa-market-hub designed marketplace", () => {
  it("renders real escrow art, a product shelf, and a focused checkout", () => {
    const first = listing();
    const second = listing({
      id: "8",
      title: "Plugin-ready account",
      accountIdHash: "0x14131211100f0e0d0c0b0a090807060504030201",
      priceGas: "2",
    });
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          listings: [first, second],
          selectedListing: first,
          totalListingsDisplay: 2,
          activeListingsDisplay: 2,
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".aa-market-scene")).toBeTruthy();
    expect(container.querySelector<HTMLImageElement>(".aa-market-hero__image")?.src).toContain(
      "market-escrow-desk.webp",
    );
    expect(container.querySelector(".aa-market-hero")).toBeTruthy();
    expect(container.querySelector(".aa-market-workbench")).toBeTruthy();
    expect(container.querySelector(".aa-market-listings")).toBeTruthy();
    expect(container.querySelectorAll(".aa-market-listing")).toHaveLength(2);
    expect(container.querySelector(".aa-market-checkout")?.textContent).toContain("Fresh AA shell");
    expect(container.querySelector(".aa-market-checkout")?.textContent).toContain("1.5");
  });

  it("selects product cards and keeps non-canonical inventory visibly unavailable", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const unverified = listing({ id: "9", title: "Unverified shell", isCanonicalAA: false });
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ listings: [unverified], selectedListing: unverified })}
        dispatch={dispatch}
      />,
    );

    const product = screen.getByRole("button", { name: /Unverified shell/ });
    expect(product.classList.contains("is-unavailable")).toBe(true);
    fireEvent.click(product);
    expect(dispatch).toHaveBeenCalledWith("selectListing", "9");
    expect(container.querySelector(".aa-market-checkout")?.textContent).toContain("nonCanonicalListing");
    expect(container.querySelector<HTMLButtonElement>(".mx2-btn--primary")?.textContent).toContain("refreshMarket");
  });

  it("uses a seller studio and live asset preview instead of a host parameter sheet", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          mode: "sell",
          accountIdHash: ACCOUNT,
          priceGas: "10",
          listingTitle: "Treasury-ready AA",
          metadataUri: "ipfs://treasury-aa",
          canCreateListing: true,
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".aa-market-workbench--sell")).toBeTruthy();
    expect(container.querySelector(".aa-market-builder")).toBeTruthy();
    expect(container.querySelector(".aa-market-preview")?.textContent).toContain("Treasury-ready AA");
    expect(container.querySelector(".aa-market-preview")?.textContent).toContain("10");
    expect(container.querySelectorAll(".aa-market-price-presets button")).toHaveLength(3);
    expect(container.querySelector<HTMLInputElement>(`input[value="${MARKET}"]`)).toBeNull();
    expect(container.querySelector<HTMLInputElement>(`input[value="${AA_CORE}"]`)).toBeNull();

    const advanced = container.querySelector<HTMLDetailsElement>(".aa-market-advanced");
    expect(advanced).toBeTruthy();
    fireEvent.click(advanced!.querySelector("summary")!);
    expect(advanced?.textContent).toContain("aaContractLabel");
    expect(advanced?.textContent).toContain("marketHash");
  });

  it("keeps listing management and trust evidence in three secondary drawer panels", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const mine = listing({ isMine: true });
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          listings: [mine],
          selectedListing: mine,
          canManageSelectedListing: true,
          cancelConfirmationId: "7",
          nextPriceGas: "2",
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle")!);
    const drawer = container.querySelector(".aa-market-drawer");
    expect(drawer).toBeTruthy();
    expect(drawer?.querySelectorAll(".aa-market-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(3);
    expect(drawer?.querySelector(".aa-market-trust-list")?.textContent).toContain("canonicalMarket");
    expect(drawer?.querySelector<HTMLInputElement>(`input[value="${MARKET}"]`)).toBeNull();
    expect(drawer?.querySelector<HTMLInputElement>(`input[value="${AA_CORE}"]`)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "confirmCancellation" }));
    expect(dispatch).toHaveBeenCalledWith("cancelSelected");
  });

  it("surfaces durable pending confirmation without hiding the transaction", () => {
    const txid = `0x${"ab".repeat(32)}`;
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          transactionNotice: "transactionPending",
          pendingOperation: { kind: "buy", txid, createdAt: Date.now() },
        })}
        dispatch={vi.fn()}
      />,
    );

    const feedback = container.querySelector(".aa-market-feedback.is-pending");
    expect(feedback).toBeTruthy();
    expect(feedback?.textContent).toContain("transactionPending");
    expect(feedback?.textContent).toContain("checkConfirmation");
    expect(container.querySelector<HTMLButtonElement>(".mx2-btn--primary")?.textContent).toContain("checkConfirmation");
  });
});

describe("aa-market-hub visual production locks", () => {
  it("uses a bright high-contrast responsive marketplace composition", () => {
    const styles = readFileSync(`${process.cwd()}/../aa-market-hub/src/PlayArea.scss`, "utf8");
    const source = readFileSync(`${process.cwd()}/../aa-market-hub/src/PlayArea.tsx`, "utf8");

    expect(styles).toMatch(/\.aa-market-scene\s*\{[\s\S]*?background:\s*transparent/);
    expect(styles).toMatch(/\.aa-market-layout\s*\{[\s\S]*?grid-template-columns:/);
    expect(styles).toMatch(/\.aa-market-hero,[\s\S]*?\.aa-market-workbench\s*\{[\s\S]*?background:\s*#fff/);
    expect(styles).toMatch(/\.aa-market-hero__image\s*\{[\s\S]*?object-fit:\s*cover/);
    // Renamed from __shade: shared v2.scss zeroes `.mx2-stage__scene
    // [class$="__shade"]` with opacity:0 !important, so the old name silently
    // killed this scrim at runtime and left the white hero copy at ~2:1 over
    // bright art. The gradient must still bottom out opaque enough to carry
    // that copy, so pin the final stop rather than just the class.
    expect(styles).toMatch(
      /\.aa-market-hero__legibility\s*\{[\s\S]*?rgba\(9,\s*38,\s*30,\s*0\.9\)/,
    );
    expect(styles).not.toMatch(/\.aa-market-hero__shade\s*\{/);
    expect(styles).toMatch(/\.aa-market-hero__copy\s*\{[\s\S]*?color:\s*#fff/);
    expect(styles).toMatch(/\.aa-market-listing\s*\{[\s\S]*?background:\s*#fbfefc/);
    expect(styles).toMatch(/\.aa-market-checkout\s*\{[\s\S]*?background:\s*var\(--market-cream\)/);
    expect(styles).toMatch(/\.aa-market-preview\s*\{[\s\S]*?linear-gradient/);
    expect(styles).toMatch(/\.aa-market-drawer\s*\{[\s\S]*?grid-template-columns:\s*repeat\(3,/);
    expect(styles).toMatch(/\.aa-market-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*?flex:\s*0 0 194px/);
    expect(styles).toMatch(/@media \(max-width:\s*620px\)[\s\S]*?\.aa-market-listings\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
    expect(styles).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)/);

    expect(source).toMatch(/className="aa-market-hero__image"[\s\S]*?src="\.\/market-escrow-desk\.webp"/);
    expect(source).toMatch(/dispatch\("loadListings"\)/);
    expect(source).not.toMatch(/dispatch\("loadListings",/);
    expect(source).not.toMatch(/setMarketInput|syncMarketInput|marketHashPlaceholder/);
    expect(source).not.toMatch(/market-scene__backdrop|market-scene__route|market-scene__shelf/);
  });
});
