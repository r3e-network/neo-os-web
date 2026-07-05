import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../gas-sponsor/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());

function t(k: string) { return k; }
function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, createObservable(v)])) as ObservableState;
}

function eligibleState(extra: Partial<Record<string, unknown>> = {}) {
  return state({
    gasBalance: "0.02",
    isEligible: true,
    serviceAvailable: true,
    fuelLevelPercent: 20,
    remainingQuota: "0.1",
    remainingQuotaDisplay: "0.1",
    dailyLimit: "0.1",
    usedQuota: "0.02",
    resetTime: "1h 30m",
    requestAmount: "0.01",
    maxRequestAmount: "0.08",
    quickAmounts: [0.001, 0.005, 0.01, 0.05],
    poolAddress: "NhWxcoEc9qtmnjsTLF1fVF6myJ5MZZhSMK",
    ...extra,
  });
}

describe("gas-sponsor PlayArea (v2)", () => {
  it("renders a clean quota desk instead of a loose form", () => {
    const { container } = render(<PlayArea t={t} state={eligibleState()} dispatch={vi.fn()} />);

    expect(container.querySelector(".mx2-stage")).toBeTruthy();
    expect(container.querySelector(".sponsor-desk")).toBeTruthy();
    expect(container.querySelector(".sponsor-station")).toBeTruthy();
    expect(container.querySelector<HTMLImageElement>(".sponsor-station__art")?.getAttribute("src")).toContain("gas-sponsor-refill-station.webp");
    expect(container.querySelector(".sponsor-fuel-cells__group.mx2-open-segmented.semi-radioGroup")).toBeTruthy();
    expect(container.querySelectorAll(".sponsor-fuel-cells__group .semi-radio").length).toBe(4);
    expect(container.querySelectorAll(".sponsor-fuel-cell").length).toBe(4);
    expect(container.querySelector(".sponsor-console__meta")).toBeTruthy();
    expect(container.querySelector(".sponsor-console input:not([type='radio'])")).toBeNull();
    expect(container.querySelector(".sponsor-tune__field input")).toBeNull();
    expect(container.querySelector(".mx2-score")).toBeNull();
    expect(screen.getAllByText("0.02 GAS").length).toBeGreaterThan(0);
    expect(container.textContent).not.toMatch(/⛽|🛢️/);
    expect(container.querySelector(".sponsor-request")).toBeNull();
    expect(container.querySelector(".sponsor-custom")).toBeNull();
  });

  it("dispatches the selected request amount", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={eligibleState()} dispatch={dispatch} />);

    fireEvent.click(container.querySelectorAll(".sponsor-fuel-cells__group .semi-radio")[1]);
    fireEvent.click(screen.getByText("Request Gas"));

    expect(dispatch).toHaveBeenCalledWith("requestSponsorship", "0.005");
  });

  it("keeps exact amount editing in the drawer", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={eligibleState()} dispatch={dispatch} />);

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.querySelector(".sponsor-drawer-tabs__group.mx2-open-segmented.semi-radioGroup")).toBeTruthy();
    expect(container.querySelectorAll(".sponsor-drawer-tabs__group .semi-radio")).toHaveLength(2);
    expect(container.querySelectorAll('.sponsor-drawer-tabs [role="tab"]')).toHaveLength(0);
    expect(container.querySelector(".sponsor-drawer__panel")?.getAttribute("data-mode")).toBe("tune");
    const input = container.querySelector(".sponsor-tune__field .mx2-open-field__control input.semi-input") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "0.02" } });
    expect(container.querySelector(".sponsor-console__head strong")?.textContent).toBe("0.02 GAS");
    fireEvent.click(screen.getByText("Request Gas"));

    expect(dispatch).toHaveBeenCalledWith("requestSponsorship", "0.02");
  });

  it("keeps the loading action label visible", () => {
    render(<PlayArea t={t} state={eligibleState({ isRequesting: true })} dispatch={vi.fn()} />);

    expect(screen.getByText("Requesting gas")).toBeTruthy();
  });

  it("imports v2 styles and removes legacy backdrop noise", () => {
    const fs = require("node:fs");
    const s = fs.readFileSync(`${process.cwd()}/../gas-sponsor/src/PlayArea.scss`, "utf8");
    const source = fs.readFileSync(`${process.cwd()}/../gas-sponsor/src/PlayArea.tsx`, "utf8");

    expect(s).toContain('@use "@shared/components-react/v2/v2" as *;');
    expect(s).toMatch(/prefers-reduced-motion/);
    expect(s).toMatch(/\.sponsor-desk\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.sponsor-station__art/);
    expect(s).toMatch(/\.sponsor-station\s*\{[\s\S]*grid-template-rows:\s*minmax\(188px,\s*auto\) auto/);
    expect(s).toMatch(/\.sponsor-station__art\s*\{[\s\S]*position:\s*relative/);
    expect(s).toMatch(/\.sponsor-station__art\s*\{[\s\S]*object-fit:\s*contain/);
    expect(s).toMatch(/\.sponsor-station__art\s*\{[\s\S]*opacity:\s*1/);
    expect(s).toMatch(/\.sponsor-station__art\s*\{[\s\S]*filter:\s*none/);
    expect(s).toMatch(/\.sponsor-station::after\s*\{[\s\S]*content:\s*none/);
    expect(s).toMatch(/\.sponsor-station__panel\s*\{[\s\S]*position:\s*relative/);
    expect(s).toMatch(/\.sponsor-console__meta\s*\{[\s\S]*justify-content:\s*space-between/);
    expect(s).toMatch(/\.sponsor-fuel-cells__group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.sponsor-fuel-cell\s*\{[\s\S]*min-height:\s*82px/);
    expect(s).toMatch(/\.sponsor-tune__field\.mx2-open-field\s*\{[\s\S]*grid-template-columns:\s*auto minmax\(92px,\s*1fr\)/);
    expect(s).toMatch(/\.sponsor-drawer-tabs__group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.sponsor-quota\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.gas-sponsor-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 184px/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.sponsor-station\s*\{[\s\S]*grid-template-columns:\s*104px minmax\(0,\s*1fr\)/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.sponsor-station\s*\{[\s\S]*grid-template-rows:\s*108px/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.sponsor-station__art\s*\{[\s\S]*min-height:\s*96px/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.sponsor-station__art\s*\{[\s\S]*object-fit:\s*contain/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.sponsor-station__panel\s*\{[\s\S]*grid-template-columns:\s*54px minmax\(0,\s*1fr\)/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.sponsor-fuel-cells__group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.sponsor-fuel-cell\s*\{[\s\S]*min-height:\s*48px/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.sponsor-drawer-tabs__group\.mx2-open-segmented\.semi-radioGroup,\n {2}\.sponsor-quota\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.gas-sponsor-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*min-height:\s*48px/);
    expect(s).not.toMatch(/\.gas-sponsor-play-area \.mx2-score/);
    expect(source).toContain("OpenUiSegmented");
    expect(source).toContain("OpenUiTextField");
    expect(source).not.toContain('role="tablist"');
    expect(source).not.toContain('role="tab"');
    expect(source).not.toContain("<input");
    expect(source).not.toContain("score={[");
    expect(source).not.toContain("sponsor-fine-tune");
    expect(s).not.toMatch(/\.sponsor-custom input/);
    expect(s).not.toMatch(/\.sponsor-request\s*\{/);
    expect(s).not.toContain("background: linear-gradient(180deg, #ffffff 0%, #f4fff8 100%)");
    expect(s).not.toMatch(/\.sponsor-station__art\s*\{[^}]*position:\s*absolute/);
    expect(s).not.toMatch(/\.sponsor-station__art\s*\{[^}]*object-fit:\s*cover/);
    expect(s).not.toMatch(/\.sponsor-station::after\s*\{[^}]*linear-gradient/);
    expect(s).not.toMatch(/AI-generated scene backdrop/);
    expect(s).not.toMatch(/__backdrop/);
  });
});
