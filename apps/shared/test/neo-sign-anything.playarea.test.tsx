import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../neo-sign-anything/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string) { return k; }
function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, createObservable(v)])) as ObservableState;
}
function playAreaStyles(app: string): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return readFileSync(path.join(appsRoot, app, "src/PlayArea.scss"), "utf8");
}
describe("neo-sign-anything PlayArea (v2)", () => {
  it("renders the tool scene", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    expect(container.querySelector(".sign-desk")).toBeTruthy();
    expect(container.querySelector(".sign-desk__paper")).toBeTruthy();
    expect(container.querySelector(".sign-desk__photo")).toBeTruthy();
    expect(container.querySelector(".sign-desk__payload-preview")).toBeTruthy();
    expect(container.querySelector(".sign-desk__handoff")).toBeTruthy();
  });
  it("uses designed Open UI panels for proof details instead of raw drawer sections", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          address: "NZExampleSignerAddress",
          message: "release digest",
          signature: "signature-abcdef0123456789",
          txHash: "0x1234567890abcdef",
        })}
        dispatch={vi.fn()}
      />,
    );

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as HTMLButtonElement);

    expect(container.querySelector(".sign-details__tabs")).toBeTruthy();
    expect(container.querySelectorAll(".sign-details__tabs [role='tab']")).toHaveLength(3);
    expect(container.querySelectorAll(".sign-details__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(container.querySelector(".sign-details__summary")).toBeTruthy();
    expect(container.querySelectorAll(".sign-details__status-chip[data-active='true']")).toHaveLength(2);

    fireEvent.click(container.querySelectorAll(".sign-details__tabs [role='tab']")[1]);
    expect(container.querySelector(".sign-details__panel--signature")).toBeTruthy();
    expect(container.querySelectorAll(".sign-details__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(container.querySelectorAll(".sign-details__artifact")).toHaveLength(1);

    fireEvent.click(container.querySelectorAll(".sign-details__tabs [role='tab']")[2]);
    expect(container.querySelector(".sign-details__panel--broadcast")).toBeTruthy();
    expect(container.querySelectorAll(".sign-details__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(container.querySelector(".sign-details__notice.mx2-open-notice.semi-banner")).toBeTruthy();
    expect(container.querySelector(".sign-details__panel h3")).toBeNull();
    expect(container.querySelector("section.sign-details__panel")).toBeNull();
  });
  it("has reduced-motion", () => {
    const s = playAreaStyles("neo-sign-anything");
    
    expect(s).toMatch(/prefers-reduced-motion/); expect(s).toMatch(/0\.001ms/);
  });
  it("keeps the signing desk foreground-led instead of using a dirty scenic background", () => {
    const s = playAreaStyles("neo-sign-anything");

    expect(s).toMatch(/\.sign-desk\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.tool-play-area \.mx2-score\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/\.tool-play-area \.mx2-action-rail,[\s\S]*\.tool-play-area \.mx2-drawer\s*\{[\s\S]*width:\s*min\(100%,\s*920px\)/);
    expect(s).toMatch(/\.tool-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 156px/);
    expect(s).toMatch(/\.sign-desk__workspace\s*\{[\s\S]*grid-template-columns:\s*minmax\(360px,\s*1\.18fr\) minmax\(280px,\s*0\.82fr\)/);
    expect(s).toMatch(/\.sign-desk__workspace\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.sign-desk__paper\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.sign-desk__proof\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.sign-desk__photo\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.sign-desk__photo img\s*\{[\s\S]*object-fit:\s*cover/);
    expect(s).toMatch(/\.sign-desk__photo img\s*\{[\s\S]*opacity:\s*1/);
    expect(s).toMatch(/\.sign-desk__photo img\s*\{[\s\S]*filter:\s*none/);
    expect(s).toMatch(/\.sign-desk__photo::after\s*\{[\s\S]*content:\s*none/);
    expect(s).toMatch(/\.sign-desk__mode\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.sign-desk__payload-sheet\s*\{/);
    expect(s).toMatch(/\.sign-desk__payload-sheet\s*\{[\s\S]*box-shadow:\s*inset 0 -1px 0 rgba\(31,\s*138,\s*83,\s*0\.1\)/);
    expect(s).toMatch(/\.sign-desk__textarea\s*\{[\s\S]*font:\s*620 14px/);
    expect(s).toMatch(/\.sign-desk__textarea\s*\{[\s\S]*min-height:\s*132px/);
    expect(s).toMatch(/\.sign-desk__textarea\s*\{[\s\S]*resize:\s*none/);
    expect(s).toMatch(/\.sign-desk__payload-preview\s*\{[\s\S]*background:\s*var\(--mx2-surface-2\)/);
    expect(s).toMatch(/\.sign-desk__handoff\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.sign-details__panel\.mx2-open-panel\.semi-card\s*\{/);
    expect(s).toMatch(/\.sign-details__tabs\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.sign-details__tabs button\.is-active,[\s\S]*\.sign-details__tabs button:hover\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.sign-details__panel\.mx2-open-panel \.mx2-open-panel__copy span\s*\{[\s\S]*line-height:\s*1\.3/);
    expect(s).toMatch(/\.sign-details__summary\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.sign-details__status-chip\s*\{[\s\S]*min-height:\s*40px/);
    expect(s).toMatch(/\.sign-details__facts div\s*\{[\s\S]*background:\s*var\(--mx2-surface-2\)/);
    expect(s).toMatch(/\.sign-details__artifact\s*\{[\s\S]*border-radius:\s*16px/);
    expect(s).toMatch(/\.sign-details__artifact code\s*\{[\s\S]*font:\s*650 11px/);
    expect(s).toMatch(/\.sign-details__notice\.mx2-open-notice\.semi-banner\s*\{[\s\S]*min-height:\s*72px/);
    expect(s).toMatch(/@keyframes sign-desk-handoff/);
    expect(s).not.toMatch(/\.sign-desk__textarea\s*\{[\s\S]*min-height:\s*150px/);
    expect(s).not.toMatch(/\.sign-desk__textarea\s*\{[\s\S]*min-height:\s*96px/);
    expect(s).not.toMatch(/\.sign-desk__photo img\s*\{[^}]*filter:\s*saturate/);
    expect(s).not.toMatch(/\.sign-desk__photo::after\s*\{[^}]*linear-gradient/);
    expect(s).not.toMatch(/sign-scene-art\.jpg/);
    expect(s).not.toMatch(/repeating-linear-gradient/);
    expect(s).not.toMatch(/backdrop-filter/);
    expect(s).not.toMatch(/\.sign-details__panel h3/);
  });
});
