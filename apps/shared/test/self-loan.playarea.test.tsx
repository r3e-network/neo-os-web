import React from "react";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../self-loan/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string) { return k; }
function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, createObservable(v)])) as ObservableState;
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
describe("self-loan PlayArea (v2)", () => {
  it("renders the business-specific scene", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    expect(container.querySelector(".selfloan-scene")).toBeTruthy();
    expect(container.querySelector(".selfloan-scene__image")).toBeNull();
    expect(container.querySelector(".selfloan-scene__wash")).toBeNull();
    expect(container.querySelector(".selfloan-scene__position")).toBeTruthy();
    expect(container.querySelector(".selfloan-scene__meter")).toBeTruthy();
    expect(container.querySelector(".selfloan-desk")).toBeTruthy();
    expect(container.querySelectorAll(".selfloan-scene .mx2-coin").length).toBeGreaterThanOrEqual(5);
  });
  it("presents collateral as a DeFi asset control instead of a raw form block", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ neoBalance: "100", neoBalanceDisplay: "100" })} dispatch={dispatch} />);

    expect(container.querySelector(".selfloan-vault-picker")).toBeTruthy();
    expect(container.querySelector(".selfloan-amount-box")).toBeNull();
    expect(container.querySelectorAll(".selfloan-vault-picker .mx2-coin").length).toBeGreaterThanOrEqual(2);
    expect(container.querySelectorAll(".selfloan-vault-picker__steppers button")).toHaveLength(2);
    expect(container.querySelectorAll(".selfloan-quick-row button")).toHaveLength(4);

    fireEvent.click(container.querySelectorAll(".selfloan-vault-picker__steppers button")[1]);
    expect(dispatch).toHaveBeenCalledWith("setCollateralAmount", "1");
    fireEvent.click(container.querySelector(".selfloan-quick-row__max") as Element);
    expect(dispatch).toHaveBeenCalledWith("setCollateralAmount", "100");
  });
  it("keeps borrow submission on the primary action", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ collateralAmount: "10", selectedLtv: 3 })} dispatch={dispatch} />);
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    expect(dispatch).toHaveBeenCalledWith("borrow", { collateralAmount: "10", ltvTier: 3 });
  });
  it("updates collateral with quick actions without changing the contract payload path", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    fireEvent.click(container.querySelector(".selfloan-quick-row button") as Element);
    expect(dispatch).toHaveBeenCalledWith("setCollateralAmount", "10");
  });
  it("keeps NEO collateral as a whole-number input before borrow", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    const input = container.querySelector(".selfloan-amount-input") as HTMLInputElement;

    expect(input.inputMode).toBe("numeric");
    fireEvent.change(input, { target: { value: "12.75" } });
    expect(input.value).toBe("12");
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);

    expect(dispatch).toHaveBeenCalledWith("borrow", { collateralAmount: "12", ltvTier: 1 });
  });
  it("has reduced-motion and no global backdrop pollution", () => {
    const s = readFileSync(appScssPath("self-loan"), "utf8");
    expect(s).toMatch(/prefers-reduced-motion/);
    expect(s).not.toContain(".tool-scene__backdrop");
    expect(s).not.toContain(".oracle-console-scene__backdrop");
  });
  it("keeps the DeFi desk foreground clean over a quiet background", () => {
    const s = readFileSync(appScssPath("self-loan"), "utf8");
    const tokens = readFileSync(repoFilePath("apps/shared/styles/v2/_tokens.scss"), "utf8");
    const stage = readFileSync(repoFilePath("apps/shared/components-react/v2/Stage.tsx"), "utf8");

    expect(tokens).not.toMatch(/radial-gradient/);
    expect(tokens).toMatch(/--mx2-scene-bg:\s*#ffffff/);
    expect(stage).not.toMatch(/radial warm gradient/);
    expect(s).toMatch(/--mx2-scene-bg:\s*#ffffff/);
    expect(s).toMatch(/selfloan-scene\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/selfloan-scene__asset-row/);
    expect(s).toMatch(/selfloan-token-value/);
    expect(s).toMatch(/selfloan-scene__borrow-token/);
    expect(s).toMatch(/selfloan-vault-picker\s*\{[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\) auto/);
    expect(s).toMatch(/selfloan-vault-picker__field\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) auto/);
    expect(s).toMatch(/selfloan-quick-row\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*selfloan-scene\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*selfloan-scene__route\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).not.toMatch(/selfloan-scene__image|selfloan-scene__wash|var\(--mx2-scene-art-opacity/);
    expect(s).not.toMatch(/backdrop-filter/);
    expect(s).not.toMatch(/radial-gradient/);
    expect(s).not.toMatch(/--mx2-scene-bg:\s*linear-gradient/);
    expect(s).not.toMatch(/background:\s*rgba\(255,\s*255,\s*255,\s*0\.[0-8]/);
    expect(s).toMatch(/selfloan-scene__position[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/selfloan-scene__meter[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/selfloan-scene__route[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/selfloan-scene__meter-ring::before[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/self-loan-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 184px/);
    expect(s).not.toMatch(/--mx2-ease-standard/);
  });
  it("uses the shared official NEO and GAS token art for collateral and borrow resources", () => {
    const source = readFileSync(repoFilePath("apps/self-loan/src/PlayArea.tsx"), "utf8");

    expect(source).toContain('import { CoinArt, ParticleBurst } from "@shared/art";');
    expect(source).toContain('variant="neo"');
    expect(source).toContain('variant="gas"');
    expect(source).not.toMatch(/neo-icon|gas-icon|<svg|<circle/);
  });
});
