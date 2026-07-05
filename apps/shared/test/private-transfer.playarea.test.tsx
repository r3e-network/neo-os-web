import React from "react";
import fs from "node:fs";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../private-transfer/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string) { return k; }
function state(o: Partial<Record<string, unknown>> = {}): ObservableState { return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, createObservable(v)])) as ObservableState; }

function source() {
  return fs.readFileSync(`${process.cwd()}/../private-transfer/src/PlayArea.tsx`, "utf8") as string;
}

function stylesheet() {
  return fs.readFileSync(`${process.cwd()}/../private-transfer/src/PlayArea.scss`, "utf8") as string;
}

describe("private-transfer PlayArea (v2)", () => {
  it("renders a foreground-led privacy sealing device without emoji locks", () => {
    const { container } = render(<PlayArea t={t} state={state({ requestCount: 1, lastDigest: "0x1234567890abcdef", lastSecretRef: "secret-ref-1234567890", lastNullifier: "0xabc" })} dispatch={vi.fn()} />);

    expect(container.querySelector(".pt-scene")).toBeTruthy();
    expect(container.querySelector(".pt-seal-device")).toBeTruthy();
    expect(container.querySelector(".pt-packet-console")).toBeTruthy();
    expect(container.querySelector(".pt-transfer-packet")).toBeTruthy();
    expect(container.querySelector(".pt-transfer-packet__seal")).toBeTruthy();
    expect(container.querySelector(".pt-transfer-packet__seal img")?.getAttribute("src")).toContain("private-transfer-stage.webp");
    expect(container.querySelectorAll(".pt-packet-console .pt-compose-input .semi-input")).toHaveLength(2);
    expect(container.querySelectorAll(".pt-compose-slot")).toHaveLength(2);
    expect(container.querySelectorAll(".pt-asset-switch__group .semi-radio")).toHaveLength(2);
    expect(container.querySelectorAll(".pt-amount-presets__group .semi-radio")).toHaveLength(3);
    expect(container.querySelector(".pt-vault-card")).toBeTruthy();
    expect(container.querySelector(".pt-vault-card__art img")?.getAttribute("src")).toContain("private-transfer-stage.webp");
    expect(container.querySelector(".pt-packet-console__head strong")?.textContent).not.toBe("validationHint");
    expect(container.querySelector(".pt-packet-console__head strong")?.textContent).toBe("packetSealed");
    expect(container.querySelector(".pt-seal-device__body small")?.textContent).not.toBe("summaryPending");
    expect(container.querySelector(".pt-scene__intent")).toBeTruthy();
    expect(container.querySelector(".pt-drawer__memo")).toBeFalsy();
    expect(container.querySelector(".pt-scene")?.firstElementChild).toBe(container.querySelector(".pt-vault-card"));
    expect(container.querySelector(".pt-vault-card")?.nextElementSibling).toBe(container.querySelector(".pt-packet-console"));
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.querySelector(".pt-drawer__memo")).toBeTruthy();
    expect(container.querySelectorAll(".pt-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(3);
    expect(container.querySelector(".pt-drawer__notice.mx2-open-notice.semi-banner")).toBeTruthy();
    expect(container.querySelector(".pt-drawer__memo.mx2-open-field .mx2-open-field__control input.semi-input")).toBeTruthy();
    expect(container.querySelector(".pt-drawer__review")).toBeNull();
    expect(container.querySelector(".pt-drawer__summary")).toBeNull();
    expect(container.querySelector(".pt-drawer h4")).toBeNull();
    expect(container.querySelector(".pt-scene__backdrop")).toBeFalsy();
    expect(container.textContent).not.toMatch(/🔒|🔓|🔑/);
  });

  it("keeps private transfer styling clean and motion guarded", () => {
    const s = stylesheet();
    const playAreaSource = source();
    const config = fs.readFileSync(`${process.cwd()}/../private-transfer/src/appConfig.ts`, "utf8");
    expect(playAreaSource).toContain("OpenUiProvider");
    expect(playAreaSource).toContain("OpenUiSegmented");
    expect(playAreaSource).toContain("OpenUiTextField");
    expect(playAreaSource).not.toMatch(/<(input|textarea|select)\b/);
    expect(playAreaSource).not.toContain('role="radio"');
    expect(playAreaSource).not.toContain('role="radiogroup"');
    expect(s).toMatch(/prefers-reduced-motion/);
    expect(s).toMatch(/\.private-transfer-play-area \.mx2-stage__scene\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.private-transfer-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 156px/);
    expect(s).toMatch(/\.pt-scene\s*\{[^}]*background:\s*transparent/);
    expect(s).toMatch(/\.pt-scene\s*\{[^}]*grid-template-columns:\s*minmax\(540px,\s*1\.18fr\) minmax\(320px,\s*0\.82fr\)/);
    expect(s).toMatch(/\.pt-packet-console\s*\{[\s\S]*background:\s*var\(--mx2-brand-light\)/);
    expect(s).toMatch(/\.pt-transfer-packet\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.pt-transfer-packet\s*\{[\s\S]*grid-template-areas:\s*[\s\S]*"seal body"[\s\S]*"route route"/);
    expect(s).toMatch(/\.pt-transfer-packet__seal img\s*\{[\s\S]*object-fit:\s*cover/);
    expect(s).toMatch(/\.pt-transfer-packet__seal img\s*\{[\s\S]*filter:\s*none/);
    expect(s).toMatch(/\.pt-compose-strip\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(s).toMatch(/\.pt-compose-strip\s*\{[\s\S]*background:\s*#f7faf8/);
    expect(s).toMatch(/\.pt-compose-slot\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.pt-compose-slot--recipient\s*\{[\s\S]*background:\s*var\(--mx2-surface-2\)/);
    expect(s).toMatch(/\.pt-amount-desk\s*\{[\s\S]*border:\s*1px solid var\(--mx2-brand-subtle\)/);
    expect(s).toMatch(/\.pt-asset-switch__group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.pt-asset-option\s*\{[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\)/);
    expect(s).toMatch(/\.pt-asset-switch__group \.semi-radio-checked \.pt-asset-option\s*\{[\s\S]*box-shadow:/);
    expect(s).toMatch(/\.pt-asset-switch__group \.semi-radio-checked \.pt-asset-option\[data-asset="neo"\]\s*\{[\s\S]*color:\s*#047857/);
    expect(s).toMatch(/\.pt-compose-input--amount\s*\{[\s\S]*height:\s*46px/);
    expect(s).toMatch(/\.pt-compose-input--amount \.semi-input\s*\{[\s\S]*font-size:\s*28px/);
    expect(s).toMatch(/\.pt-amount-presets__group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.pt-vault-card__art img\s*\{[\s\S]*object-fit:\s*cover/);
    expect(s).toMatch(/\.pt-vault-card\s*\{[\s\S]*grid-template-rows:\s*minmax\(230px,\s*auto\) auto/);
    expect(s).toMatch(/\.pt-vault-card__art img\s*\{[\s\S]*width:\s*100%/);
    expect(s).toMatch(/\.pt-vault-card__art img\s*\{[\s\S]*height:\s*clamp\(230px,\s*28vw,\s*316px\)/);
    expect(s).toMatch(/\.pt-vault-card__art img\s*\{[\s\S]*opacity:\s*1/);
    expect(s).toMatch(/\.pt-vault-card__art img\s*\{[\s\S]*filter:\s*none/);
    expect(s).toMatch(/\.pt-seal-device\s*\{[\s\S]*box-shadow:\s*none/);
    expect(s).toMatch(/\.pt-scene__intent\s*\{[\s\S]*width:\s*fit-content/);
    expect(s).toMatch(/\.pt-scene__status\s*\{[\s\S]*justify-self:\s*start/);
    expect(s).toMatch(/\.pt-drawer\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.pt-drawer__panel\.mx2-open-panel\.semi-card\s*\{[\s\S]*border-radius:\s*20px/);
    expect(s).toMatch(/\.pt-drawer__notice\.mx2-open-notice\.semi-banner\s*\{[\s\S]*grid-column:\s*1 \/ -1/);
    expect(s).toMatch(/\.pt-drawer__panel--crypto \.pt-drawer__facts\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.private-transfer-play-area \.mx2-stage\s*\{[\s\S]*padding:\s*14px 14px 16px/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.pt-packet-console\s*\{[\s\S]*order:\s*1/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.pt-vault-card\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.pt-scene__intent\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.pt-scene__route\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.pt-compose-input--amount\s*\{[\s\S]*height:\s*40px/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.pt-compose-input--amount \.semi-input\s*\{[\s\S]*font-size:\s*22px/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.pt-drawer,[\s\S]*\.pt-drawer__panel--crypto \.pt-drawer__facts\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(s).not.toMatch(/pt-intent-card|pt-transfer-packet__rail|pt-field|pt-scene__backdrop|pt-scene-art|pt-drawer__review|pt-drawer__summary|linear-gradient|var\(--mx2-ink-soft|🔒|🔓|🔑/);
    expect(config).not.toContain("Add a valid recipient and positive amount");
    expect(config).toContain("Recipient and {asset} amount are still local draft slots.");
  });

  it("switches to NEO as a compact asset control and keeps the amount whole-number only", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    const assetButtons = container.querySelectorAll(".pt-asset-option");
    fireEvent.click(assetButtons[1]);

    const amountInput = container.querySelector<HTMLInputElement>("input[placeholder='1']");
    expect(amountInput).toBeTruthy();
    expect(amountInput?.inputMode).toBe("numeric");

    fireEvent.change(amountInput as HTMLInputElement, { target: { value: "12.75" } });

    expect(amountInput?.value).toBe("12");
    expect(container.querySelector(".pt-amount-desk")?.getAttribute("data-asset")).toBe("neo");
    expect(container.querySelector(".pt-transfer-packet__body")?.textContent).toContain("NEO");
  });
});
