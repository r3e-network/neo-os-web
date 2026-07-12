import React from "react";
import fs from "node:fs";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../neo-pay/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string) { return k; }
function state(o: Partial<Record<string, unknown>> = {}): ObservableState { return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, createObservable(v)])) as ObservableState; }

function sharedRoot() {
  return process.cwd().endsWith("/apps/shared")
    ? process.cwd()
    : `${process.cwd()}/apps/shared`;
}

function stylesheet() {
  return fs.readFileSync(`${sharedRoot()}/../neo-pay/src/PlayArea.scss`, "utf8") as string;
}

function source() {
  return fs.readFileSync(`${sharedRoot()}/../neo-pay/src/PlayArea.tsx`, "utf8") as string;
}

function messages() {
  return fs.readFileSync(`${sharedRoot()}/composables/neo-pay/messages.ts`, "utf8") as string;
}

describe("neo-pay PlayArea (v2)", () => {
  it("renders a single-ticket stream terminal instead of a flat questionnaire", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".neopay-scene")).toBeTruthy();
    expect(container.querySelector(".neopay-terminal")).toBeTruthy();
    expect((container.querySelector(".neopay-terminal__art") as HTMLImageElement)?.src).toContain("payment-stream-desk.webp");
    expect(container.querySelector(".neopay-stream")).toBeTruthy();
    expect(container.querySelector(".neopay-stream__rail")).toBeTruthy();
    expect(container.querySelector(".neopay-terminal__status")?.textContent).toContain("streamDraftIdle");
    expect(container.querySelector(".neopay-ticket-board")).toBeTruthy();
    expect(container.querySelector(".neopay-ticket-board__hero")).toBeTruthy();
    expect(container.querySelector(".neopay-ticket-board__details")).toBeTruthy();
    expect(container.querySelector(".neopay-ticket")).toBeNull();
    expect(container.querySelector(".neopay-focus-card")).toBeNull();
    expect(container.querySelector(".mx2-score")).toBeNull();
    expect(container.querySelector(".neopay-desk")).toBeNull();
    expect(container.querySelector(".neopay-route-card")).toBeNull();
    expect(container.querySelector<HTMLInputElement>(".neopay-input--amount .semi-input")?.placeholder).toBe("0");
    expect(container.querySelector("#neopay-recipient")).toBeTruthy();
    expect(container.querySelectorAll(".neopay-token-option")).toHaveLength(2);
    expect(container.querySelectorAll(".neopay-preset-option")).toHaveLength(3);
    expect(container.querySelector(".neopay-duration-stepper")).toBeTruthy();
    expect(container.querySelectorAll(".neopay-ticket__review span")).toHaveLength(3);
    expect(container.querySelector(".neo-pay-playstage")).toBeTruthy();
    expect(Array.from(container.querySelectorAll(".mx2-action-rail__row .mx2-btn--ghost")).some((button) => button.textContent === "refresh")).toBe(false);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.querySelectorAll(".neopay-drawer-tabs__group .semi-radio")).toHaveLength(4);
    expect(container.querySelector(".mx2-drawer--open .neopay-drawer__section h4")?.textContent).toBe("streamMetadata");
    expect(container.querySelector(".neopay-drawer__refresh")).toBeTruthy();
    expect(container.querySelector(".mx2-drawer--open .semi-card.mx2-open-panel")).toBeTruthy();
    expect(container.querySelector(".mx2-drawer--open #neopay-drawer-duration")).toBeTruthy();
    expect(container.querySelector(".mx2-drawer--open .neopay-duration-custom")).toBeNull();
    expect(container.querySelector(".neopay-steps")).toBeNull();
    const tabs = container.querySelectorAll(".neopay-drawer-tab");
    fireEvent.click(tabs[1]);
    expect(container.querySelector(".neopay-steps")).toBeTruthy();
    fireEvent.click(tabs[2]);
    expect(container.querySelector(".neopay-empty")?.textContent).toBe("noCreatedStreams");
    fireEvent.click(tabs[3]);
    expect(container.querySelector(".neopay-empty")?.textContent).toBe("noBeneficiaryStreams");
  });

  it("keeps the play area background quiet and the foreground controls dominant", () => {
    const s = stylesheet();
    const playAreaSource = source();
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(playAreaSource).toContain("OpenUiProvider");
    expect(playAreaSource).toContain("OpenUiLiteProvider");
    expect(playAreaSource).toContain("OpenUiSegmented");
    expect(playAreaSource).toContain("OpenUiTextField");
    expect(playAreaSource).toContain("neopay-ticket-board");
    expect(playAreaSource).not.toContain("focusMode");
    expect(playAreaSource).not.toContain("neopay-mode-tabs");
    expect(playAreaSource).not.toMatch(/<(input|textarea|select)\b/);
    expect(playAreaSource).not.toContain('role="tab"');
    expect(playAreaSource).not.toContain('role="tablist"');
    expect(playAreaSource).not.toContain('role="radio"');
    expect(playAreaSource).not.toContain('role="radiogroup"');
    expect(container.querySelector(".neopay-scene__image")).toBeNull();
    expect(container.querySelector(".neopay-scene__shade")).toBeNull();
    expect(s).toMatch(/\.neo-pay-play-area\s*\{[\s\S]*--mx2-stage-floor:\s*#ffffff;/);
    expect(s).toMatch(/\.neo-pay-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 240px;/);
    expect(s).toMatch(/\.neo-pay-play-area \.mx2-stage__scene\s*\{[\s\S]*display:\s*block;/);
    expect(s).toMatch(/\.neopay-scene\s*\{[\s\S]*width:\s*min\(100%,\s*760px\);/);
    expect(s).toMatch(/\.neopay-scene\s*\{[\s\S]*border:\s*0;/);
    expect(s).toMatch(/\.neopay-scene\s*\{[\s\S]*background:\s*transparent;/);
    expect(s).toMatch(/\.neopay-terminal\s*\{[\s\S]*width:\s*min\(100%,\s*760px\);/);
    expect(s).toMatch(/\.neopay-terminal\s*\{[\s\S]*background:\s*#ffffff;/);
    expect(s).toMatch(/\.neopay-ticket-board\s*\{[\s\S]*min-height:\s*280px;/);
    expect(s).toMatch(/\.neopay-ticket-board__hero\s*\{[\s\S]*grid-template-columns:\s*166px minmax\(0,\s*1fr\);/);
    expect(s).toMatch(/\.neopay-ticket-board__details\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(250px,\s*0\.86fr\);/);
    expect(s).toMatch(/\.neopay-terminal__art\s*\{[\s\S]*object-fit:\s*contain;/);
    expect(s).toMatch(/\.neopay-stream__rail\s*\{[\s\S]*filter:\s*none;/);
    expect(s).toMatch(/\.neopay-stream__rail\s*\{[\s\S]*pointer-events:\s*none;/);
    expect(s).not.toMatch(/gradient/);
    expect(s).not.toMatch(/font-size:\s*clamp/);
    expect(s).toMatch(/\.neopay-input\.mx2-open-field__control\s*\{[\s\S]*border:\s*0;/);
    expect(s).toMatch(/\.neopay-input--amount \.semi-input\s*\{[\s\S]*font-size:\s*34px;/);
    expect(s).toMatch(/\.neopay-token-option\.is-active,[\s\S]*\.neopay-preset-option\.is-active,[\s\S]*background:\s*var\(--mx2-brand-light\);/);
    expect(s).toMatch(/\.neopay-ticket__review\s*\{[\s\S]*display:\s*flex;/);
    expect(s).toMatch(/\.neopay-drawer-tabs__group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/);
    expect(s).toMatch(/\.neopay-drawer-tabs__group \.semi-radio > input\s*\{[\s\S]*opacity:\s*0;/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.neopay-ticket-board__hero\s*\{[\s\S]*grid-template-columns:\s*92px minmax\(0,\s*1fr\);/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.neopay-ticket-board__details\s*\{[\s\S]*grid-template-columns:\s*1fr;/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.neo-pay-play-area \.mx2-score\s*\{[\s\S]*display:\s*none;/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.neo-pay-play-area \.mx2-action-rail__row\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) 104px;/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.neo-pay-play-area \.mx2-action-rail\s*\{[\s\S]*position:\s*fixed/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.neopay-ticket__review span:first-of-type\s*\{[\s\S]*display:\s*none;/);
    expect(s).not.toContain("backdrop-filter");
    expect(s).not.toMatch(/neopay-ticket\s*\{/);
    expect(s).not.toMatch(/\.neopay-duration-custom/);
    expect(s).not.toMatch(/grid-template-columns:\s*minmax\(360px,\s*1fr\) minmax\(300px,\s*390px\)/);
    expect(s).not.toMatch(/\.neopay-ticket__amount-row\s*\{[^}]*grid-template-columns:\s*1fr;/);
  });

  it("uses product-state copy instead of form-like empty-state prompts", () => {
    const m = messages();

    expect(m).toContain('reviewStream: { en: "Draft release schedule"');
    expect(m).toContain('streamDraftIdle: { en: "Stream ticket draft"');
    expect(m).toContain('amountModeHint: { en: "Pick the value to stream"');
    expect(m).toContain('neoWholeUnitHint: { en: "NEO is indivisible; use whole-token amounts only."');
    expect(m).not.toContain("Complete stream details");
    expect(m).not.toContain("Add recipient and amount");
    expect(m).not.toContain("Set the recipient, amount, and duration above");
  });

  it("keeps a fractional NEO amount visible but blocks it instead of silently truncating value", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    const assetButtons = container.querySelectorAll(".neopay-token-option");
    fireEvent.click(assetButtons[1]);

    const input = container.querySelector<HTMLInputElement>(".neopay-input--amount .semi-input")!;
    expect(input.inputMode).toBe("numeric");

    fireEvent.change(input, { target: { value: "1.5" } });
    fireEvent.change(container.querySelector("#neopay-recipient") as HTMLInputElement, {
      target: { value: "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq" },
    });
    expect(input.value).toBe("1.5");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(container.querySelector(".neopay-amount-console__hint")?.textContent).toBe("neoWholeUnitHint");
    expect((container.querySelector(".mx2-btn--primary") as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(input, { target: { value: "2" } });
    expect(input.getAttribute("aria-invalid")).toBeNull();
    expect((container.querySelector(".mx2-btn--primary") as HTMLButtonElement).disabled).toBe(false);
  });

  it("keeps the wallet action disabled for an invalid recipient and marks the route inline", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    fireEvent.change(container.querySelector("#neopay-amount") as HTMLInputElement, { target: { value: "5" } });
    fireEvent.change(container.querySelector("#neopay-recipient") as HTMLInputElement, { target: { value: "not-an-address" } });

    expect(container.querySelector('.neopay-recipient-card[data-state="invalid"]')).toBeTruthy();
    expect((container.querySelector(".mx2-btn--primary") as HTMLButtonElement).disabled).toBe(true);
  });

  it("locks the draft but keeps an explicit recovery action for an earlier transaction", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ pendingCreateTxid: "0xbatch", serviceNotice: "confirmation pending" })}
        dispatch={dispatch}
      />,
    );

    expect(container.querySelector(".neopay-scene")?.getAttribute("data-state")).toBe("signing");
    const primary = container.querySelector(".mx2-btn--primary") as HTMLButtonElement;
    expect(primary.disabled).toBe(false);
    expect(primary.textContent).toContain("checkTransaction");
    fireEvent.click(primary);
    expect(dispatch).toHaveBeenCalledWith("recoverTransaction");
    expect(container.querySelector(".neopay-ticket__notice")?.textContent).toContain("confirmation pending");
  });

  it("keeps stream creation primary and makes an available claim secondary", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const stream = {
      id: "9",
      creator: "0x1111111111111111111111111111111111111111",
      beneficiary: "0x2222222222222222222222222222222222222222",
      asset: "0xd2a4cff31913016155e38e474a2c06d08be276cf",
      assetSymbol: "GAS" as const,
      totalAmount: 300_000_000n,
      releasedAmount: 100_000_000n,
      remainingAmount: 200_000_000n,
      rateAmount: 100_000_000n,
      intervalSeconds: 86_400n,
      intervalDays: 1,
      status: "active" as const,
      claimable: 100_000_000n,
      title: "Payroll",
      notes: "",
    };
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ beneficiaryStreams: [stream], allStreams: [stream], operationBusy: false, recoveryStorageHealthy: true })}
        dispatch={dispatch}
      />,
    );

    expect(container.querySelector(".mx2-btn--primary")?.textContent).toContain("createStream");
    const claim = Array.from(container.querySelectorAll<HTMLButtonElement>(".mx2-action-rail__row .mx2-btn--ghost"))
      .find((button) => button.textContent?.includes("claimAvailable"));
    expect(claim).toBeTruthy();
    fireEvent.click(claim!);
    expect(dispatch).toHaveBeenCalledWith("claimStream", "9");
  });

  it("turns unavailable transaction recovery into the primary repair action", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ recoveryStorageHealthy: false, operationBusy: false })}
        dispatch={dispatch}
      />,
    );

    const primary = container.querySelector(".mx2-btn--primary") as HTMLButtonElement;
    expect(primary.textContent).toContain("restoreRecoveryStorage");
    fireEvent.click(primary);
    expect(dispatch).toHaveBeenCalledWith("refreshRecoveryStorage");
    expect(container.querySelector(".neopay-ticket__notice")?.textContent).toContain("neoPayRecoveryStorageUnavailable");
  });

  it("has reduced-motion", () => {
    expect(stylesheet()).toMatch(/prefers-reduced-motion/);
  });
});
