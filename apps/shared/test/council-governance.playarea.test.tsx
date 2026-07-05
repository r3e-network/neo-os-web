import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../council-governance/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string) { return k; }
function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, createObservable(v)])) as ObservableState;
}
function playAreaStyles(): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return readFileSync(path.join(appsRoot, "council-governance/src/PlayArea.scss"), "utf8");
}
describe("council-governance PlayArea (v2)", () => {
  it("renders the business-specific scene", () => { const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />); expect(container.children.length).toBeGreaterThan(0); });
  it("presents proposal drafting as a motion dossier instead of a raw form", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".council-draft--stage")).toBeTruthy();
    expect(container.querySelector(".council-draft__art")).toBeNull();
    expect(container.querySelector(".council-motion-paper")).toBeTruthy();
    expect(container.querySelector(".council-motion-paper__title")).toBeTruthy();
    expect(container.querySelector(".council-motion-paper__brief")).toBeTruthy();
    expect(container.querySelector(".council-motion-paper__summary-grid")).toBeTruthy();
    expect(container.querySelectorAll(".council-motion-paper__summary-card")).toHaveLength(3);
    expect(container.querySelector(".council-motion-paper__seal")).toBeTruthy();
    expect(container.querySelector(".council-window-rail")).toBeNull();
    expect(container.querySelector(".mx2-stage__scene .council-motion-paper--stage")).toBeTruthy();
    expect(container.querySelector(".mx2-stage__scene .council-draft-type")).toBeNull();
    expect(container.querySelectorAll(".mx2-stage__scene .council-motion-paper input")).toHaveLength(0);
    expect(container.querySelectorAll(".mx2-stage__scene .council-motion-paper textarea")).toHaveLength(0);
    expect(container.querySelector(".mx2-stage__scene .council-duration-grid")).toBeNull();
    expect(container.querySelector(".mx2-stage__scene .council-field")).toBeNull();
    expect(container.querySelector(".council-chamber-card")).toBeNull();
    expect(container.querySelector(".council-workbench[data-mode='draft']")).toBeTruthy();
    expect(container.querySelector(".council-floor-tabs")).toBeTruthy();
    expect(container.querySelector(".mx2-score")).toBeNull();
    expect(container.querySelector(".council-chamber-visual img")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /proposalTabs/ }));

    const drawer = container.querySelector(".council-drawer");
    expect(drawer?.querySelector(".council-drawer-tabs")).toBeTruthy();
    expect(drawer?.querySelectorAll(".council-drawer-tabs [role='tab']")).toHaveLength(3);
    expect(drawer?.querySelectorAll(".council-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(drawer?.querySelector(".council-drawer__panel--draft")).toBeTruthy();
    expect(drawer?.querySelector(".council-draft--drawer .council-draft-type")).toBeTruthy();
    expect(drawer?.querySelectorAll(".council-draft--drawer .council-draft-type button > em").length).toBe(2);
    expect(drawer?.querySelector(".council-drawer-fields")).toBeTruthy();
    expect(drawer?.querySelectorAll(".council-drawer__field.mx2-open-field")).toHaveLength(2);
    expect(drawer?.querySelector(".council-window-rail")).toBeTruthy();
    expect(drawer?.querySelectorAll(".council-duration-grid button")).toHaveLength(3);
    expect(drawer?.querySelector(".council-field")).toBeNull();
    expect(drawer?.querySelector("select")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /policyType/ }));

    expect(drawer?.querySelector(".council-policy-fields")).toBeTruthy();
    expect(drawer?.querySelector(".council-policy-fields .semi-radioGroup.mx2-open-segmented")).toBeTruthy();
    expect(drawer?.querySelector(".council-policy-value .mx2-open-field__control input.semi-input")).toBeTruthy();
    expect(drawer?.querySelector(".council-policy-fields select")).toBeNull();

    fireEvent.click(screen.getByRole("tab", { name: /activeProposals/ }));
    expect(drawer?.querySelector(".council-draft--drawer")).toBeNull();
    expect(drawer?.querySelectorAll(".council-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
  });
  it("keeps createProposal payload unchanged from the redesigned motion dossier", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: /proposalTabs/ }));

    fireEvent.change(screen.getByPlaceholderText("proposalTitlePlaceholder"), {
      target: { value: "Lower storage fee" },
    });
    fireEvent.change(screen.getByPlaceholderText("proposalDescPlaceholder"), {
      target: { value: "Reduce storage price for small apps." },
    });
    fireEvent.click(screen.getByRole("button", { name: "duration14Days" }));
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith("createProposal", {
        type: 0,
        title: "Lower storage fee",
        description: "Reduce storage price for small apps.",
        policyMethod: undefined,
        policyValue: undefined,
        duration: 14 * 24 * 60 * 60 * 1000,
      }),
    );
  });
  it("has reduced-motion", () => {
    const s = playAreaStyles();
    expect(s).toMatch(/prefers-reduced-motion/);
  });
  it("keeps the council floor clean enough that foreground controls read first", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    const s = playAreaStyles();

    expect(container.querySelector(".council-scene__image")).toBeNull();
    expect(container.querySelector(".council-scene__shade")).toBeNull();
    expect(s).toMatch(/\.council-scene\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.council-scene\s*\{[\s\S]*grid-template-areas:\s*\n\s*"visual visual"\n\s*"quorum proposal"/);
    expect(s).toMatch(/\.council-chamber-visual\s*\{[\s\S]*background:\s*#f8fffb/);
    expect(s).toMatch(/\.council-chamber-visual img\s*\{[\s\S]*object-fit:\s*cover/);
    expect(s).toMatch(/\.council-chamber-visual img\s*\{[^}]*filter:\s*none/);
    expect(container.querySelector(".council-draft__art")).toBeNull();
    expect(s).toMatch(/\.council-gov-play-area \.mx2-score\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/\.council-gov-play-area \.mx2-action-rail,[\s\S]*\.council-gov-play-area \.mx2-drawer\s*\{[\s\S]*width:\s*min\(100%,\s*920px\)/);
    expect(s).toMatch(/\.council-gov-play-area \.mx2-stage__scene\s*\{[\s\S]*display:\s*block/);
    expect(s).toMatch(/\.council-gov-play-area \.mx2-stage__scene\s*\{[\s\S]*background:\s*var\(--mx2-bg-2\)/);
    expect(s).toMatch(/\.council-workbench__body\s*\{[\s\S]*grid-template-columns:\s*minmax\(280px,\s*0\.72fr\) minmax\(440px,\s*1\.28fr\)/);
    expect(s).toMatch(/\.council-workbench\[data-mode="draft"\] \.council-workbench__body\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*780px\)/);
    expect(s).toMatch(/\.council-floor-tabs\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.council-gov-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 220px/);
    expect(s).toMatch(/\.council-draft--stage\s*\{[\s\S]*border-radius:\s*var\(--mx2-r-lg\)/);
    expect(s).toMatch(/\.council-draft--stage\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(s).toMatch(/\.council-draft--stage \.council-motion-paper\s*\{[\s\S]*grid-area:\s*paper/);
    expect(s).not.toMatch(/\.council-draft__art/);
    expect(s).toMatch(/\.council-quorum__ring\s*\{[\s\S]*background:\s*conic-gradient/);
    expect(s).toMatch(/\.council-quorum__ring\s*\{[\s\S]*box-shadow:\s*none/);
    expect(s).toMatch(/\.council-motion-paper--stage\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*0\.92fr\) minmax\(0,\s*1\.08fr\)/);
    expect(s).toMatch(/\.council-motion-paper--stage\s*\{[\s\S]*"summary summary"/);
    expect(s).toMatch(/\.council-motion-paper--stage\s*\{[\s\S]*min-height:\s*194px/);
    expect(s).toMatch(/\.council-motion-paper__title,\n\.council-motion-paper__brief\s*\{[\s\S]*border-radius:\s*16px/);
    expect(s).toMatch(/\.council-motion-paper__title,\n\.council-motion-paper__brief\s*\{[\s\S]*background:\s*var\(--mx2-surface-2\)/);
    expect(s).toMatch(/\.council-motion-paper__title strong\s*\{[\s\S]*-webkit-line-clamp:\s*2/);
    expect(s).toMatch(/\.council-motion-paper__brief p\s*\{[\s\S]*-webkit-line-clamp:\s*4/);
    expect(s).toMatch(/\.council-motion-paper__summary-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.council-motion-paper__summary-card\s*\{[\s\S]*grid-template-areas:\s*\n\s*"icon label"\n\s*"icon value"/);
    expect(s).not.toMatch(/\.council-draft--stage \.council-window-rail/);
    expect(s).not.toMatch(/\.council-draft--stage \.council-duration-grid/);
    expect(s).toMatch(/\.council-drawer-tabs\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.council-drawer-tabs button\.is-active,[\s\S]*\.council-drawer-tabs button:hover\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.council-draft--drawer\s*\{[\s\S]*background:\s*transparent/);
    expect(s).toMatch(/\.council-drawer-fields\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*0\.72fr\) minmax\(0,\s*1\.28fr\)/);
    expect(s).toMatch(/\.council-policy-fields\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(176px,\s*232px\)/);
    expect(s).toMatch(/\.council-policy-methods\s*\{[\s\S]*width:\s*min\(100%,\s*760px\)/);
    expect(s).toMatch(/\.council-policy-methods \.mx2-open-segmented\.semi-radioGroup \.semi-radio\s*\{[\s\S]*flex-basis:\s*max\(116px,\s*calc\(33\.333% - 4px\)\)/);
    expect(s).toMatch(/@media \(max-width: 520px\)[\s\S]*\.council-motion-paper--stage\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(s).toMatch(/@media \(max-width: 520px\)[\s\S]*\.council-motion-paper--stage\s*\{[\s\S]*"title"[\s\S]*"brief"[\s\S]*"summary"[\s\S]*"seal"/);
    expect(s).toMatch(/@media \(max-width: 860px\)[\s\S]*\.council-drawer,[\s\S]*\.council-drawer-fields\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(s).toMatch(/@media \(max-width: 520px\)[\s\S]*\.council-gov-play-area \.mx2-stage\s*\{[\s\S]*padding:\s*14px 14px 16px/);
    expect(s).toMatch(/@media \(max-width: 520px\)[\s\S]*\.council-gov-play-area \.mx2-stage__scene\s*\{[\s\S]*padding:\s*0/);
    expect(s).toMatch(/@media \(max-width: 520px\)[\s\S]*\.council-drawer-tabs button\s*\{[\s\S]*grid-template-areas:\s*\n\s*"icon"\n\s*"label"/);
    expect(s).toMatch(/@media \(max-width: 520px\)[\s\S]*\.council-ticket--draft \.council-ticket__review\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/@media \(max-width: 520px\)[\s\S]*\.council-scene\[data-state="empty"\]\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/@media \(max-width: 520px\)[\s\S]*\.council-draft--stage\s*\{[\s\S]*padding:\s*10px/);
    expect(s).toMatch(/@media \(max-width: 520px\)[\s\S]*\.council-gov-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex-basis:\s*220px[\s\S]*white-space:\s*nowrap/);
    expect(s).not.toMatch(/\.council-draft--stage \.council-draft-type/);
    expect(s).not.toMatch(/\.council-chamber-card/);
    expect(s).toMatch(/\.council-submit-draft\s*\{[\s\S]*min-width:\s*180px/);
    expect(s).toMatch(/\.council-proposal-card\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.council-draft\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.council-motion-paper\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.council-motion-paper\s*\{[\s\S]*box-shadow:\s*none/);
    expect(s).toMatch(/\.council-motion-paper::before\s*\{[\s\S]*content:\s*none/);
    expect(s).not.toMatch(/\.council-motion-paper__title input/);
    expect(s).not.toMatch(/\.council-motion-paper__brief textarea/);
    expect(s).not.toContain("background: rgba(248, 250, 252, 0.72);");
    expect(s).toMatch(/\.council-window-rail\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).not.toMatch(/council-chamber\.jpg/);
    expect(s).not.toMatch(/council-scene-art\.jpg/);
    expect(s).not.toMatch(/background-image:\s*url/);
    expect(s).not.toMatch(/backdrop-filter/);
    expect(s).not.toMatch(/repeating-linear-gradient/);
    expect(s).not.toMatch(/radial-gradient/);
    expect(s).not.toMatch(/\.council-field\b/);
    expect(s).toMatch(/\.council-duration-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.council-scene\s*\{[\s\S]*order:\s*2/);
    expect(s).toMatch(/\.council-ticket--draft\s*\{[\s\S]*order:\s*1/);
  });
});
