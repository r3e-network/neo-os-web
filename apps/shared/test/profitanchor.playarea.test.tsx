import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../profitanchor/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string) { return k; }
function state(o: Partial<Record<string, unknown>> = {}): ObservableState { return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, createObservable(v)])) as ObservableState; }
describe("profitanchor PlayArea (v2)", () => {
  it("renders the staking gauge without a decorative backdrop node", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    expect(container.children.length).toBeGreaterThan(0);
    expect(container.querySelector(".anchor-scene__gauge")).toBeTruthy();
    expect(container.querySelector(".anchor-ticket input")).toBeNull();
    expect(container.querySelectorAll(".anchor-ticket__presets button")).toHaveLength(4);
    expect(container.querySelector(".anchor-ticket__stepper output")?.textContent).toBe("1 NEO");
    expect(container.querySelector(".anchor-scene__backdrop")).toBeNull();
  });

  it("has reduced-motion", () => {
    const s = readFileSync(`${process.cwd()}/../profitanchor/src/PlayArea.scss`, "utf8");
    expect(s).toMatch(/prefers-reduced-motion/);
  });

  it("keeps the primary stake action tied to a visible whole-NEO stake plan", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    const output = container.querySelector(".anchor-ticket__stepper output") as HTMLOutputElement;
    const preset = Array.from(container.querySelectorAll<HTMLButtonElement>(".anchor-ticket__presets button")).find((button) => button.textContent === "5 NEO");

    expect(output.textContent).toBe("1 NEO");
    fireEvent.click(preset as HTMLButtonElement);
    expect(output.textContent).toBe("5 NEO");
    fireEvent.click(container.querySelector(".mx2-btn--primary") as HTMLButtonElement);

    expect(dispatch).toHaveBeenCalledWith("stakeNeo", { amount: "5" });
  });

  it("keeps custom amount entry tucked in the drawer and whole-number only", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    expect(container.querySelector(".anchor-ticket input")).toBeNull();

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as HTMLButtonElement);
    expect(container.querySelector(".anchor-drawer__field")).toBeNull();
    expect(container.querySelectorAll(".anchor-drawer__switcher button")).toHaveLength(3);
    expect(container.querySelectorAll(".anchor-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(container.querySelector(".anchor-drawer-field.mx2-open-field")).toBeTruthy();
    const input = container.querySelector(".anchor-drawer-input--amount input.semi-input") as HTMLInputElement;
    expect(input.inputMode).toBe("numeric");
    fireEvent.change(input, { target: { value: "6.5" } });
    expect(input.value).toBe("6");
    fireEvent.click(container.querySelector(".mx2-btn--primary") as HTMLButtonElement);

    expect(dispatch).toHaveBeenCalledWith("stakeNeo", { amount: "6" });
  });

  it("keeps drawer actions functional inside designed Open UI panels", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as HTMLButtonElement);
    let buttons = Array.from(container.querySelectorAll<HTMLButtonElement>(".anchor-drawer .mx2-btn"));

    fireEvent.click(buttons.find((button) => button.textContent === "withdrawNeo") as HTMLButtonElement);
    fireEvent.click(container.querySelectorAll<HTMLButtonElement>(".anchor-drawer__switcher button")[1]);
    expect(container.querySelectorAll(".anchor-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    buttons = Array.from(container.querySelectorAll<HTMLButtonElement>(".anchor-drawer .mx2-btn"));
    fireEvent.click(buttons.find((button) => button.textContent === "claimRewards") as HTMLButtonElement);
    fireEvent.click(buttons.find((button) => button.textContent === "recoverNeoCredit") as HTMLButtonElement);
    fireEvent.click(buttons.find((button) => button.textContent === "refreshAnchor") as HTMLButtonElement);

    expect(dispatch).toHaveBeenCalledWith("withdrawNeo", { amount: "1" });
    expect(dispatch).toHaveBeenCalledWith("claimRewards");
    expect(dispatch).toHaveBeenCalledWith("recoverNeoCredit");
    expect(dispatch).toHaveBeenCalledWith("refreshAnchor");
  });

  it("keeps the staking scene foreground-led and clean", () => {
    const s = readFileSync(`${process.cwd()}/../profitanchor/src/PlayArea.scss`, "utf8");
    const source = readFileSync(`${process.cwd()}/../profitanchor/src/PlayArea.tsx`, "utf8");

    expect(s).toMatch(/\.anchor-scene\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.profitanchor-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 168px/);
    expect(s).toMatch(/\.anchor-ticket__presets\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.anchor-ticket__stepper output\s*\{[\s\S]*place-items:\s*center/);
    expect(s).toMatch(/\.anchor-drawer__switcher\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.anchor-drawer__panel\.mx2-open-panel\.semi-card\s*\{[\s\S]*border-radius:\s*20px/);
    expect(s).toMatch(/\.anchor-drawer__amount-layout\s*\{[\s\S]*grid-template-columns:\s*minmax\(220px,\s*0\.7fr\) minmax\(0,\s*1fr\)/);
    expect(s).not.toMatch(/\.anchor-drawer__field/);
    expect(s).not.toMatch(/\.anchor-ticket__stepper input/);
    expect(s).not.toMatch(/anchor-scene__backdrop|var\(--mx2-scene-wash|background-image:\s*url/);
    expect(source).not.toContain("anchor-scene__backdrop");
  });
});
