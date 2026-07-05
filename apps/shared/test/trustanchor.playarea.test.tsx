import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../trustanchor/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string) { return k; }
function state(o: Partial<Record<string, unknown>> = {}): ObservableState { return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, createObservable(v)])) as ObservableState; }
describe("trustanchor PlayArea (v2)", () => {
  it("renders the trust network without a decorative backdrop node", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    expect(container.children.length).toBeGreaterThan(0);
    expect(container.querySelector<HTMLImageElement>(".trust-stage-card__image")?.getAttribute("src")).toContain("trustanchor-stage.webp");
    expect(container.querySelector(".trust-stage-card")).toBeTruthy();
    expect(container.querySelector(".trust-console")).toBeTruthy();
    expect(container.querySelector(".trust-ticket")).toBeTruthy();
    expect(container.querySelector(".trust-ticket input")).toBeNull();
    expect(container.querySelectorAll(".trust-ticket__presets button")).toHaveLength(4);
    expect(container.querySelector(".trust-ticket__amount output")?.textContent).toBe("1 NEO");
    expect(container.querySelector(".trust-scene__network")).toBeTruthy();
    expect(container.querySelector(".trust-scene__backdrop")).toBeNull();
  });

  it("keeps the primary stake action tied to a visible whole-NEO stake plan", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    const output = container.querySelector(".trust-ticket__amount output") as HTMLOutputElement;
    const preset = Array.from(container.querySelectorAll<HTMLButtonElement>(".trust-ticket__presets button")).find((button) => button.textContent === "5 NEO");
    const btn = container.querySelector(".mx2-btn--primary") as HTMLButtonElement;

    expect(output.textContent).toBe("1 NEO");
    fireEvent.click(preset as HTMLButtonElement);
    expect(output.textContent).toBe("5 NEO");
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(dispatch).toHaveBeenCalledWith("stakeNeo", { amount: "5" });
  });

  it("keeps custom amount entry tucked in the drawer and whole-number only", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    expect(container.querySelector(".trust-ticket input")).toBeNull();

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as HTMLButtonElement);
    expect(container.querySelector(".trust-drawer__field")).toBeNull();
    expect(container.querySelectorAll(".trust-drawer__switcher button")).toHaveLength(3);
    expect(container.querySelectorAll(".trust-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(container.querySelector(".trust-drawer-field.mx2-open-field")).toBeTruthy();
    const input = container.querySelector(".trust-drawer-input--amount input.semi-input") as HTMLInputElement;

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
    let buttons = Array.from(container.querySelectorAll<HTMLButtonElement>(".trust-drawer .mx2-btn"));

    fireEvent.click(buttons.find((button) => button.textContent === "withdrawNeo") as HTMLButtonElement);
    fireEvent.click(container.querySelectorAll<HTMLButtonElement>(".trust-drawer__switcher button")[1]);
    expect(container.querySelectorAll(".trust-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    buttons = Array.from(container.querySelectorAll<HTMLButtonElement>(".trust-drawer .mx2-btn"));
    fireEvent.click(buttons.find((button) => button.textContent === "claimRewards") as HTMLButtonElement);
    fireEvent.click(buttons.find((button) => button.textContent === "recoverNeoCredit") as HTMLButtonElement);
    fireEvent.click(buttons.find((button) => button.textContent === "refreshAnchor") as HTMLButtonElement);

    expect(dispatch).toHaveBeenCalledWith("withdrawNeo", { amount: "1" });
    expect(dispatch).toHaveBeenCalledWith("claimRewards");
    expect(dispatch).toHaveBeenCalledWith("recoverNeoCredit");
    expect(dispatch).toHaveBeenCalledWith("refreshAnchor");
  });

  it("has reduced-motion", () => {
    const s = readFileSync(`${process.cwd()}/../trustanchor/src/PlayArea.scss`, "utf8");
    expect(s).toMatch(/prefers-reduced-motion/);
  });

  it("keeps the trust network foreground-led and clean", () => {
    const s = readFileSync(`${process.cwd()}/../trustanchor/src/PlayArea.scss`, "utf8");
    const source = readFileSync(`${process.cwd()}/../trustanchor/src/PlayArea.tsx`, "utf8");

    expect(s).toMatch(/\.trust-scene\s*\{[\s\S]*background:\s*transparent/);
    expect(s).toMatch(/\.trust-scene\s*\{[\s\S]*grid-template-columns:\s*minmax\(260px,\s*0\.72fr\) minmax\(380px,\s*1\.28fr\)/);
    expect(s).toMatch(/\.trust-scene\s*\{[\s\S]*align-items:\s*start/);
    expect(s).toMatch(/\.trust-stage-card\s*\{[\s\S]*grid-template-columns:\s*112px minmax\(0,\s*1fr\)/);
    expect(s).toMatch(/\.trust-stage-card\s*\{[\s\S]*align-self:\s*start/);
    expect(s).toMatch(/\.trust-stage-card__image\s*\{[\s\S]*width:\s*112px/);
    expect(s).toMatch(/\.trust-stage-card__image\s*\{[\s\S]*height:\s*112px/);
    expect(s).toMatch(/\.trust-stage-card__image\s*\{[\s\S]*object-fit:\s*cover/);
    expect(s).toMatch(/\.trust-console\s*\{[\s\S]*grid-template-rows:\s*auto auto auto auto auto/);
    expect(s).toMatch(/\.trust-ticket__amount\s*\{[\s\S]*grid-template-columns:\s*42px minmax\(0,\s*1fr\) 42px/);
    expect(s).toMatch(/\.trust-ticket__presets\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.trust-ticket__amount output\s*\{[\s\S]*place-items:\s*center/);
    expect(s).toMatch(/\.trust-drawer__switcher\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.trust-drawer__panel\.mx2-open-panel\.semi-card\s*\{[\s\S]*border-radius:\s*20px/);
    expect(s).toMatch(/\.trust-drawer__amount-layout\s*\{[\s\S]*grid-template-columns:\s*minmax\(220px,\s*0\.7fr\) minmax\(0,\s*1fr\)/);
    expect(s).not.toMatch(/\.trust-drawer__field/);
    expect(s).not.toMatch(/\.trust-ticket__amount input/);
    expect(s).toMatch(/\.trust-scene__status\s*\{[\s\S]*background:\s*transparent/);
    expect(s).toMatch(/\.trust-scene__core\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.trust-stage-card\s*\{[\s\S]*order:\s*2/);
    expect(s).toMatch(/\.trust-console\s*\{[\s\S]*order:\s*1/);
    expect(s).toMatch(/\.trustanchor-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 168px/);
    expect(s).not.toMatch(/trust-scene__backdrop|var\(--mx2-scene-wash|background-image:\s*url|radial-gradient|linear-gradient|backdrop-filter/);
    expect(source).not.toContain("trust-scene__backdrop");
  });
});
