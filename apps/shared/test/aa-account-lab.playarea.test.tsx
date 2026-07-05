import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../aa-account-lab/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    accountPlanTitle: "Account strategy",
    accountPlanDaily: "Everyday shell",
    accountPlanFast: "Fast recovery",
    accountPlanCold: "Cold vault",
    accountPlanDailyCopy: "Balanced recovery",
    accountPlanFastCopy: "Fast recovery",
    accountPlanColdCopy: "Long delay",
    ownerNotSet: "Connect or set owner",
    useConnectedWallet: "Use connected wallet",
    recoveryWindow: "Recovery window",
    register: "Register Account",
    inspect: "Inspect Account",
    connectWallet: "Connect Wallet",
    registerTitle: "Advanced",
    accountStageNeedOwner: "Set a backup owner",
    accountStageNeedVerifier: "Verifier needed",
    accountStageNeedTimelock: "Set a recovery window",
    accountShellProgress: "{count}/3 ready",
  };
  let value = messages[k] ?? k;
  for (const [name, replacement] of Object.entries(params ?? {})) {
    value = value.replace(`{${name}}`, String(replacement));
  }
  return value;
}
function state(o: Partial<Record<string, unknown>> = {}): ObservableState { return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, createObservable(v)])) as ObservableState; }
function playAreaStyles(app: string): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return readFileSync(path.join(appsRoot, app, "src/PlayArea.scss"), "utf8");
}
describe("aa-account-lab PlayArea (v2)", () => {
  it("renders a strategy-led account workbench without exposing advanced fields on the main surface", () => {
    const { container } = render(<PlayArea t={t} state={state({ defaultVerifierDisplay: "0x2222222222222222222222222222222222222222" })} dispatch={vi.fn()} />);
    expect(container.querySelector('.aa-visual-card img[src="account-control-center.webp"]')).toBeTruthy();
    expect(container.querySelector(".aa-scene__stage-art")).toBeNull();
    expect(container.querySelector(".aa-scene__wash")).toBeNull();
    expect(container.querySelector(".aa-plan-panel")).toBeTruthy();
    expect(container.querySelector(".aa-plan-panel__head")?.textContent).toContain("Everyday shell");
    expect(container.querySelectorAll(".aa-plan-card")).toHaveLength(3);
    expect(container.querySelector(".aa-drawer__field")).toBeFalsy();
  });

  it("opens advanced account fields only from the drawer toggle", () => {
    const { container } = render(<PlayArea t={t} state={state({ defaultVerifierDisplay: "0x2222222222222222222222222222222222222222" })} dispatch={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Advanced/ }));
    expect(container.querySelector(".aa-drawer__field")).toBeTruthy();
    expect(container.querySelectorAll(".aa-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(3);
    expect(container.querySelectorAll(".aa-drawer__field.mx2-open-field .mx2-open-field__control input.semi-input")).toHaveLength(5);
    expect(container.querySelector(".aa-drawer__caution.mx2-open-notice.semi-banner")).toBeTruthy();
    expect(container.querySelector(".aa-drawer h4")).toBeNull();
  });

  it("dispatches register from the main strategy flow", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayArea t={t} state={state({
      connectedWalletDisplay: "0x1111111111111111111111111111111111111111",
      defaultVerifierDisplay: "0x2222222222222222222222222222222222222222",
    })} dispatch={dispatch} />);

    await waitFor(() => expect((screen.getByRole("button", { name: /Register Account/ }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: /Fast recovery/ }));
    fireEvent.click(screen.getByRole("button", { name: /Register Account/ }));

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith(
        "register",
        "",
        "0x2222222222222222222222222222222222222222",
        "",
        "",
        "0x1111111111111111111111111111111111111111",
        "604800",
      ),
      { timeout: 2500 },
    );
  });

  it("keeps the scene background low-noise with reduced-motion fallbacks", () => {
    const s = playAreaStyles("aa-account-lab");
    expect(s).toMatch(/prefers-reduced-motion/);
    expect(s).toMatch(/\.aa-workspace\s*\{[^}]*align-items:\s*start/);
    expect(s).toMatch(/\.aa-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 190px/);
    expect(s).toMatch(/\.aa-play-area \.mx2-action-rail__row \.mx2-btn--primary:not\(:disabled\)\s*\{[\s\S]*background:\s*var\(--mx2-brand-hover\)/);
    expect(s).toMatch(/\.aa-scene\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.aa-scene\s*\{[\s\S]*min-height:\s*328px/);
    expect(s).toMatch(/\.aa-scene__diagram\s*\{[\s\S]*grid-template-columns:\s*minmax\(144px,\s*0\.46fr\) minmax\(220px,\s*1fr\)/);
    expect(s).toMatch(/\.aa-scene__segments\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.aa-scene__status\s*\{[\s\S]*grid-template-columns:\s*minmax\(128px,\s*auto\) minmax\(160px,\s*1fr\) minmax\(0,\s*1\.25fr\)/);
    expect(s).toMatch(/\.aa-visual-card\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.aa-visual-card\s*\{[\s\S]*grid-template-rows:\s*minmax\(150px,\s*auto\) auto/);
    expect(s).toMatch(/\.aa-visual-card img\s*\{[\s\S]*object-fit:\s*contain/);
    expect(s).toMatch(/\.aa-visual-card img\s*\{[\s\S]*opacity:\s*1/);
    expect(s).toMatch(/\.aa-visual-card img\s*\{[\s\S]*filter:\s*none/);
    expect(s).toMatch(/\.aa-visual-card::after\s*\{[\s\S]*content:\s*none/);
    expect(s).toMatch(/\.aa-visual-card figcaption\s*\{[\s\S]*position:\s*relative/);
    expect(s).not.toMatch(/\.aa-visual-card img\s*\{[\s\S]*opacity:\s*0\.74/);
    expect(s).not.toMatch(/\.aa-visual-card::after\s*\{[\s\S]*rgba\(255,\s*255,\s*255,\s*0\.12\)/);
    expect(s).toMatch(/\.aa-plan-panel\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.aa-plan-grid\s*\{[\s\S]*display:\s*flex/);
    expect(s).toMatch(/\.aa-plan-card\s*\{[\s\S]*min-height:\s*62px/);
    expect(s).toMatch(/\.aa-drawer\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.aa-drawer__panel--wide > \.semi-card-body\s*\{[\s\S]*grid-template-columns:\s*minmax\(260px,\s*520px\)\s+minmax\(220px,\s*1fr\)/);
    expect(s).not.toMatch(/\.aa-drawer__field input/);
    expect(s).not.toMatch(/\.aa-drawer__intro/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.aa-scene__core\s*\{[\s\S]*min-height:\s*64px/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.aa-scene__segments\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.aa-scene__status p\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.aa-visual-card\s*\{[\s\S]*grid-template-rows:\s*68px/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.aa-visual-card figcaption\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.aa-plan-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.aa-plan-card\s*\{[\s\S]*min-height:\s*50px/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.aa-owner-card button:disabled\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.aa-play-area \.mx2-score\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.aa-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex-basis:\s*184px/);
    expect(s).not.toMatch(/aa-scene__stage-art/);
    expect(s).not.toMatch(/aa-scene__wash/);
    expect(s).not.toMatch(/\.aa-workspace\s*\{[^}]*align-items:\s*stretch/);
    expect(s).not.toMatch(/\.aa-plan-card\s*\{[\s\S]*min-height:\s*128px/);
    expect(s).not.toMatch(/aa-plan-card[\s\S]*radial-gradient/);
  });
});
