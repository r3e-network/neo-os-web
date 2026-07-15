import React from "react";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../self-loan/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());

function t(key: string) { return key; }

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    loan: null,
    isConnected: true,
    hasActiveLoan: false,
    collateralAmount: "10",
    selectedLtv: 2,
    selectedLtvPercent: 30,
    ltvOptions: [
      { tier: 1, percent: 20, label: "Conservative", desc: "20% LTV" },
      { tier: 2, percent: 30, label: "Balanced", desc: "30% LTV" },
      { tier: 3, percent: 40, label: "Maximum", desc: "40% LTV" },
    ],
    platformStats: { platformFeeBps: 50 },
    neoPrice: 5,
    neoPriceBase: 500000000n,
    poolGas: 500,
    poolDisplay: "500 GAS",
    neoBalance: 100,
    gasBalance: 50,
    neoBalanceDisplay: "100",
    gasBalanceDisplay: "50",
    marketStatus: "ready",
    balancesStatus: "ready",
    positionStatus: "ready",
    recoveryStatus: "ready",
    marketReady: true,
    borrowDataReady: true,
    manageDataReady: true,
    hasCollateralCredit: false,
    hasRepayCredit: false,
    collateralCredit: 0,
    repayCredit: 0,
    isLoading: false,
    isRefreshing: false,
    isBorrowing: false,
    isRepaying: false,
    isAddingCollateral: false,
    isProcessing: false,
    ...overrides,
  };
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, createObservable(value)])) as ObservableState;
}

function appScssPath(app: string) {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return path.join(appsRoot, app, "src/PlayArea.scss");
}

function repoFilePath(...segments: string[]) {
  const repoRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..", "..")
    : process.cwd();
  const direct = path.join(repoRoot, ...segments);
  if (existsSync(direct)) return direct;
  return path.resolve(process.cwd(), ...segments);
}

describe("self-loan production position desk", () => {
  it("renders a position, LTV band, and verified market snapshot", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    expect(container.querySelector(".selfloan-scene")).toBeTruthy();
    expect(container.querySelector(".selfloan-position")).toBeTruthy();
    expect(container.querySelector(".selfloan-risk")).toBeTruthy();
    expect(container.querySelector(".selfloan-market")).toBeTruthy();
    expect(container.querySelector(".selfloan-desk")).toBeTruthy();
    expect(container.querySelectorAll(".selfloan-scene .mx2-coin").length).toBeGreaterThanOrEqual(3);
  });

  it("uses one asset composer instead of a generic form wall", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    expect(container.querySelector(".selfloan-composer")).toBeTruthy();
    expect(container.querySelector(".selfloan-asset-input")).toBeTruthy();
    expect(container.querySelectorAll(".selfloan-quick-row button")).toHaveLength(4);
    expect(container.querySelectorAll(".selfloan-tier-grid button")).toHaveLength(3);
    expect(container.querySelector("textarea")).toBeNull();
    expect(container.querySelector("select")).toBeNull();

    fireEvent.click(container.querySelectorAll(".selfloan-quick-row button")[3]);
    expect(dispatch).toHaveBeenCalledWith("setCollateralAmount", "100");
  });

  it("opens a transaction review before any borrow dispatch", () => {
    const dispatch = vi.fn().mockResolvedValue("confirmed");
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);

    expect(container.querySelector(".selfloan-review")).toBeTruthy();
    expect(container.querySelectorAll(".selfloan-review__steps li")).toHaveLength(2);
    expect(dispatch).not.toHaveBeenCalledWith("borrow", expect.anything());
  });

  it("updates whole-number NEO through focused controls", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    const input = container.querySelector(".selfloan-asset-input input") as HTMLInputElement;

    expect(input.inputMode).toBe("numeric");
    fireEvent.change(input, { target: { value: "12.75" } });
    expect(input.value).toBe("12");
    expect(dispatch).toHaveBeenCalledWith("setCollateralAmount", "12");
  });

  it("fails closed into a retry action when live data is unavailable", () => {
    const dispatch = vi.fn().mockResolvedValue(true);
    const { container } = render(<PlayArea t={t} state={state({ marketStatus: "error", marketReady: false, borrowDataReady: false, readError: "unavailable" })} dispatch={dispatch} />);

    expect(container.querySelector('.selfloan-notice[data-tone="error"]')).toBeTruthy();
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    expect(dispatch).toHaveBeenCalledWith("refresh");
    expect(container.querySelector(".selfloan-review")).toBeNull();
  });

  it("keeps the warm DeFi foreground clean, responsive, and motion-safe", () => {
    const styles = readFileSync(appScssPath("self-loan"), "utf8");
    expect(styles).toMatch(/--mx2-scene-bg:\s*#fffdf8/);
    expect(styles).toMatch(/selfloan-scene\s*\{[\s\S]*background:\s*#fffdf8/);
    expect(styles).toMatch(/selfloan-position\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/selfloan-asset-input\s*\{[\s\S]*grid-template-columns:\s*auto minmax\(0, 1fr\) auto/);
    expect(styles).toMatch(/selfloan-quick-row\s*\{[\s\S]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*680px\)/);
    expect(styles).toMatch(/prefers-reduced-motion/);
    expect(styles).not.toMatch(/radial-gradient|backdrop-filter|selfloan-scene__image|selfloan-scene__wash/);
    expect(styles).toMatch(/self-loan-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 210px/);
  });

  it("uses shared official NEO and GAS token art", () => {
    const source = readFileSync(repoFilePath("apps/self-loan/src/PlayArea.tsx"), "utf8");
    expect(source).toContain('import { CoinArt, ParticleBurst } from "@shared/art";');
    expect(source).toContain('variant="neo"');
    expect(source).toContain('variant="gas"');
    expect(source).not.toMatch(/neo-icon|gas-icon|<svg|<circle/);
  });

  // A visitor with no wallet is the FIRST person this desk ever meets. That
  // first paint used to be a red "Live data unavailable / Writes are disabled"
  // alert over eighteen em-dashes, describing a failure that had not happened:
  // loadRuntime treated "no wallet has named a network" as a network mismatch.
  // These pin the reframed pre-connect surface.
  describe("pre-wallet first paint", () => {
    function preWalletState() {
      return state({
        isConnected: false,
        runtimeStatus: "awaiting-wallet",
        marketStatus: "awaiting-wallet",
        balancesStatus: "awaiting-wallet",
        positionStatus: "awaiting-wallet",
        recoveryStatus: "awaiting-wallet",
        marketReady: false,
        borrowDataReady: false,
        manageDataReady: false,
        runtimeCompatible: false,
        collateralAmount: "",
        neoPrice: 0,
        neoPriceBase: 0n,
        poolDisplay: "notAvailable",
        neoBalanceDisplay: "notAvailable",
        gasBalanceDisplay: "notAvailable",
        readError: "",
      });
    }

    it("raises no error alert when no wallet has named a network", () => {
      const { container } = render(
        <PlayArea t={t} state={preWalletState()} dispatch={vi.fn()} />,
      );
      expect(container.querySelector('[role="alert"][data-tone="error"]')).toBeNull();
      expect(container.textContent).not.toContain("criticalDataUnavailable");
      expect(container.textContent).not.toContain("dataUnavailableTitle");
    });

    it("renders no em-dash voids, only honest zero-state copy", () => {
      const { container } = render(
        <PlayArea t={t} state={preWalletState()} dispatch={vi.fn()} />,
      );
      // The em-dash grid is the defect itself: one dead character standing in
      // for "loading", "needs a wallet" and "type an amount" alike.
      expect(container.textContent).not.toContain("—");
      expect(container.querySelectorAll('[data-phase="unavailable"]').length).toBeGreaterThan(0);
    });

    it("keeps the primary action live so the visitor can connect", () => {
      const { container } = render(
        <PlayArea t={t} state={preWalletState()} dispatch={vi.fn()} />,
      );
      const primary = container.querySelector<HTMLButtonElement>(".mx2-btn--primary");
      expect(primary).not.toBeNull();
      expect(primary?.disabled).toBe(false);
      expect(primary?.textContent).toContain("connectWallet");
    });

    it("still raises the alert for a genuine read failure", () => {
      const { container } = render(
        <PlayArea
          t={t}
          state={state({ isConnected: true, marketStatus: "error", marketReady: false })}
          dispatch={vi.fn()}
        />,
      );
      expect(container.querySelector('[role="alert"][data-tone="error"]')).not.toBeNull();
    });
  });
});
