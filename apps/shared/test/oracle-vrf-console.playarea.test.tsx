import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../oracle-vrf-console/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(key: string) { const m: Record<string,string> = { statusReady:"Ready", digestPlaceholder:"No digest", panelTitle:"Console", panelEyebrow:"Oracle", buildRequest:"Build" }; return m[key] ?? key; }
function state(o: Partial<Record<string,unknown>> = {}): ObservableState {
  const b: Record<string,unknown> = { networkLabel:"Mainnet", endpointLabel:"Preview", lastStatus:"Ready", lastDigest:"No digest", requestCount:0, ...o };
  return Object.fromEntries(Object.entries(b).map(([k,v]) => [k, createObservable(v)]));
}
function appScssPath(app: string) {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return path.join(appsRoot, app, "src/PlayArea.scss");
}
function appSourcePath(app: string) {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return path.join(appsRoot, app, "src/PlayArea.tsx");
}
describe("oracle-vrf-console PlayArea (v2)", () => {
  it("renders the terminal scene", () => { const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />); expect(container.querySelector(".oracle-console-scene")).toBeTruthy(); });
  it("has reduced-motion", () => { const s = readFileSync(appScssPath("oracle-vrf-console"), "utf8"); expect(s).toContain("@media (prefers-reduced-motion: reduce)"); expect(s).toMatch(/animation-duration:\s*0\.001ms/); });
  it("keeps the VRF request builder foreground-led with clean resource art", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    const s = readFileSync(appScssPath("oracle-vrf-console"), "utf8");

    expect(container.querySelector<HTMLImageElement>(".oracle-console-scene__image img")?.getAttribute("src")).toContain("oracle-workspace-stage.webp");
    expect(container.querySelector(".oracle-console-scene__shade")).toBeNull();
    expect(container.querySelector(".vrf-ticket__seed-summary")).toBeTruthy();
    expect(container.querySelector(".vrf-ticket__seed input")).toBeNull();
    expect(s).toMatch(/\.oracle-console-scene\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.oracle-console-scene__image\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.oracle-console-scene__image img\s*\{[\s\S]*object-fit:\s*cover/);
    expect(s).toMatch(/\.oracle-console-scene__capsule\s*\{[\s\S]*background:\s*#f7faf8/);
    expect(s).toMatch(/\.oracle-console-scene__proof\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.oracle-console-scene__ticket-strip\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.vrf-ticket__compose\s*\{[\s\S]*grid-template-columns:\s*minmax\(152px,\s*0\.64fr\) minmax\(0,\s*1fr\)/);
    expect(s).toMatch(/\.oracle-console-scene__beam\s*\{[\s\S]*opacity:\s*0;/);
    expect(s).toMatch(/\.oracle-console-scene\[data-state="building"\] \.oracle-console-scene__beam\s*\{[\s\S]*opacity:\s*1;/);
    expect(s).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.oracle-console-scene__image img\s*\{[\s\S]*height:\s*86px/);
    expect(s).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.oracle-console-scene__ticket-strip,\s*[\s\S]*\.vrf-ticket__seed-summary\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.vrf-ticket__compose\s*\{[\s\S]*grid-template-columns:\s*minmax\(128px,\s*0\.72fr\) minmax\(0,\s*1fr\)/);
    expect(s).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.vrf-preset-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.vrf-preset-grid small\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.oracle-console-play-area \.mx2-score\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/@media \(max-width:\s*520px\)[\s\S]*\.vrf-mode-card\s*\{[\s\S]*min-height:\s*42px/);
    expect(s).not.toMatch(/vrf-randomness-stage\.jpg/);
    expect(s).not.toMatch(/background-image:\s*url/);
    expect(s).not.toMatch(/backdrop-filter/);
  });

  it("uses Open UI panels for secondary seed and proof details", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    expect(container.querySelector(".vrf-mode-switch__group.mx2-open-segmented.semi-radioGroup")).toBeTruthy();
    expect(container.querySelectorAll(".vrf-mode-switch__group .semi-radio")).toHaveLength(2);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as HTMLButtonElement);
    const tabs = Array.from(container.querySelectorAll<HTMLElement>(".vrf-drawer__switcher-group .semi-radio"));

    expect(tabs).toHaveLength(4);
    expect(tabs[3].classList.contains("semi-radio-disabled")).toBe(true);
    expect(container.querySelectorAll('.vrf-drawer__switcher [role="tab"]')).toHaveLength(0);
    expect(container.querySelectorAll(".vrf-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(container.querySelectorAll(".vrf-field .mx2-open-field__control input.semi-input")).toHaveLength(2);
    expect(container.querySelector(".vrf-seed-editor")).toBeNull();
    expect(container.querySelector(".vrf-drawer h4")).toBeNull();

    fireEvent.click(tabs[1]);
    expect(container.querySelectorAll(".vrf-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(container.querySelector(".vrf-flow")).toBeTruthy();

    fireEvent.click(tabs[2]);
    expect(container.querySelectorAll(".vrf-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(container.querySelector(".vrf-empty.mx2-open-notice.semi-banner")).toBeTruthy();

    fireEvent.click(container.querySelector(".mx2-btn--primary") as HTMLButtonElement);
    expect(dispatch).toHaveBeenCalledWith("buildRequest", expect.objectContaining({ consumer: "miniapp-oracle-vrf-console" }));
    const updatedTabs = Array.from(container.querySelectorAll<HTMLElement>(".vrf-drawer__switcher-group .semi-radio"));
    expect(updatedTabs[3].classList.contains("semi-radio-disabled")).toBe(false);
    fireEvent.click(updatedTabs[3]);
    expect(container.querySelectorAll(".vrf-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(container.querySelector(".vrf-payload")).toBeTruthy();
  });

  it("keeps VRF drawer responsive and free of local native input styling", () => {
    const s = readFileSync(appScssPath("oracle-vrf-console"), "utf8");
    const source = readFileSync(appSourcePath("oracle-vrf-console"), "utf8");

    expect(source).toContain("OpenUiSegmented");
    expect(source).not.toContain('role="tablist"');
    expect(source).not.toContain('role="tab"');
    expect(source).not.toContain('role="radiogroup"');
    expect(s).toMatch(/\.vrf-mode-switch__group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.vrf-drawer__switcher-group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.vrf-drawer__switcher-group \.semi-radio-checked \.vrf-drawer-tab\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.vrf-empty\.mx2-open-notice\.semi-banner\s*\{[\s\S]*min-height:\s*88px/);
    expect(s).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.vrf-drawer\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
    expect(s).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.vrf-drawer__switcher-group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).not.toMatch(/\.vrf-seed-editor/);
    expect(s).not.toMatch(/\.vrf-field input\s*\{/);
  });
});
