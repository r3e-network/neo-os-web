import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../aa-permissions-lab/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string) { return k; }
function state(o: Partial<Record<string, unknown>> = {}): ObservableState { return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, createObservable(v)])) as ObservableState; }
describe("aa-permissions-lab PlayArea (v2)", () => {
  it("renders a foreground permission boundary instead of a form-like inspector panel", () => {
    const { container } = render(<PlayArea t={t} state={state({
      hasInspected: true,
      currentVerifier: "0x1111111111111111111111111111111111111111",
      currentHook: "0x2222222222222222222222222222222222222222",
    })} dispatch={vi.fn()} />);

    expect(container.querySelector(".perms-boundary")).toBeTruthy();
    expect(container.querySelector(".perms-boundary__target-bar")).toBeTruthy();
    expect(container.querySelector(".perms-boundary__target-input.mx2-open-field")).toBeTruthy();
    expect(container.querySelector(".perms-boundary__target-input .mx2-open-field__control input.semi-input")).toBeTruthy();
    expect((container.querySelector(".perms-boundary__visual img") as HTMLImageElement)?.src).toContain("permission-console.webp");
    expect(container.querySelector(".perms-boundary__core")).toBeTruthy();
    expect(container.querySelector(".perms-boundary__route")).toBeTruthy();
    expect(container.querySelector(".perms-boundary__guard")).toBeTruthy();
    expect(container.querySelector(".perms-scene__account-panel")).toBeFalsy();
    expect(container.querySelector(".perms-scene__route-step")).toBeFalsy();
    expect(container.querySelector(".perms-scene__backdrop")).toBeFalsy();
    expect(container.textContent).not.toMatch(/🔒|⏳|✓|✕/u);
  });

  it("keeps inspect disabled until the account hash is supplied", () => {
    const dispatch = vi.fn();
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    const primary = container.querySelector(".mx2-btn--primary") as HTMLButtonElement;

    expect(primary.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("accountId"), {
      target: { value: "0x1111111111111111111111111111111111111111" },
    });
    expect(primary.disabled).toBe(false);

    fireEvent.click(primary);
    expect(dispatch).toHaveBeenCalledWith("refresh", "0x1111111111111111111111111111111111111111");
  });

  it("keeps verifier and hook write controls tucked into the drawer", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".mx2-stage__scene .perms-drawer")).toBeFalsy();
    expect(container.querySelector(".perms-drawer")).toBeFalsy();

    fireEvent.click(screen.getByRole("button", { name: /permissionsCommandTitle/i }));

    expect(container.querySelector(".perms-drawer")).toBeTruthy();
    expect(container.querySelector(".mx2-stage__scene .perms-drawer")).toBeFalsy();
    expect(container.querySelectorAll(".perms-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(3);
    expect(container.querySelectorAll(".perms-drawer__field.mx2-open-field .mx2-open-field__control input.semi-input")).toHaveLength(3);
    expect(container.querySelector(".perms-drawer__notice.mx2-open-notice.semi-banner")).toBeTruthy();
    expect(container.querySelector(".perms-drawer h4")).toBeNull();
  });

  it("keeps styling clean, responsive, and motion guarded", () => {
    const fs = require("node:fs");
    const s = fs.readFileSync(`${process.cwd()}/../aa-permissions-lab/src/PlayArea.scss`, "utf8");
    const source = fs.readFileSync(`${process.cwd()}/../aa-permissions-lab/src/PlayArea.tsx`, "utf8");

    expect(s).toMatch(/prefers-reduced-motion/);
    expect(s).toMatch(/\.perms-scene\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.perms-boundary__visual\s*\{[\s\S]*background:\s*#f8fcfb/);
    expect(s).toMatch(/\.perms-boundary__visual img\s*\{[\s\S]*object-fit:\s*cover/);
    expect(s).toMatch(/\.perms-boundary__map\s*\{[\s\S]*grid-template-columns/);
    expect(s).toMatch(/\.perms-boundary__map\s*\{[\s\S]*grid-template-columns:\s*minmax\(220px,\s*0\.66fr\) minmax\(190px,\s*0\.48fr\) minmax\(360px,\s*1fr\)/);
    expect(s).toMatch(/\.perms-boundary__target-input\.mx2-open-field\s*\{[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\)/);
    expect(s).toMatch(/\.perms-boundary__route\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.perms-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 174px/);
    expect(s).toMatch(/\.perms-play-area \.mx2-action-rail__row \.mx2-btn--primary:not\(:disabled\)\s*\{[\s\S]*background:\s*var\(--mx2-brand-hover\)/);
    expect(s).toMatch(/\.perms-drawer\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.perms-drawer__panel--wide > \.semi-card-body\s*\{[\s\S]*grid-template-columns:\s*minmax\(260px,\s*520px\)\s+minmax\(160px,\s*220px\)/);
    expect(s).not.toMatch(/\.perms-drawer__field[\s\S]*& input/);
    expect(source).toContain("OpenUiTextField");
    expect(source).not.toContain("<input");
    expect(s).not.toMatch(/\.perms-drawer__section/);
    expect(s).toMatch(/\.perms-boundary__visual span\s*\{[\s\S]*letter-spacing:\s*0/);
    expect(s).toMatch(/@media \(max-width:\s*900px\)[\s\S]*\.perms-boundary__map\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.perms-boundary__visual\s*\{[\s\S]*height:\s*104px/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.perms-boundary__core\s*\{[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\)/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.perms-boundary__route\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.perms-boundary__gate\s*\{[\s\S]*min-height:\s*72px/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.perms-boundary__guard small\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.perms-play-area \.mx2-score\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.perms-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex-basis:\s*170px/);
    expect(s).toMatch(/@keyframes perms-route-flow/);
    expect(s).toMatch(/@keyframes perms-core-spin/);
    expect(s).toMatch(/@keyframes perms-pending-breathe/);
    expect(s).not.toMatch(/perms-scene__account-panel|perms-scene__route-step|perms-scene__backdrop|background-image:\s*url|var\(--mx2-scene-wash/);
  });
});
