import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../neo-x-bridge/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string) { return k; }
function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  const base = {
    timeline: [
      { labelKey: "timelineSource", detailKey: "timelineSourceDetail", state: "done" },
      { labelKey: "timelineBridge", detailKey: "timelineBridgeDetail", state: "active" },
      { labelKey: "timelineSettle", detailKey: "timelineSettleDetail", state: "waiting" },
    ],
  };
  return Object.fromEntries(Object.entries({ ...base, ...o }).map(([k, v]) => [k, createObservable(v)])) as ObservableState;
}
describe("neo-x-bridge PlayArea (v2)", () => {
  it("renders a foreground bridge workbench with asset packet and lifecycle", () => {
    const { container } = render(<PlayArea t={t} state={state({ requestCount: 1, lastDigest: "0x1234567890abcdef", lastKind: "asset" })} dispatch={vi.fn()} />);

    expect(container.querySelector(".mx2-stage")).toBeTruthy();
    expect(container.querySelector(".bridge-scene__route")).toBeTruthy();
    expect(container.querySelector(".bridge-scene__packet")).toBeTruthy();
    expect(container.querySelector(".bridge-scene__mode-tabs")).toBeTruthy();
    expect(container.querySelectorAll(".bridge-scene__mode-tabs [role='tab']")).toHaveLength(3);
    expect(container.querySelector(".bridge-scene__timeline")).toBeTruthy();
    expect(container.querySelector(".bridge-scene__backdrop")).toBeFalsy();
    expect(container.querySelector(".mx2-score")).toBeNull();
    expect(container.querySelector(".mx2-btn--primary")?.textContent).toContain("opAssetAction");
    expect(container.textContent).not.toMatch(/🌉|⚡/);
  });

  it("switches bridge modes and dispatches the selected primary action", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    const modeTabs = container.querySelectorAll(".bridge-scene__mode-tabs [role='tab']");
    const primary = () => container.querySelector(".mx2-btn--primary") as HTMLButtonElement;

    fireEvent.click(primary());
    fireEvent.click(modeTabs[1]);
    expect(primary().textContent).toContain("opMessageAction");
    fireEvent.click(primary());
    fireEvent.click(modeTabs[2]);
    expect(primary().textContent).toContain("opTrackAction");
    fireEvent.click(primary());

    expect(dispatch).toHaveBeenCalledWith("prepareAssetBridge");
    expect(dispatch).toHaveBeenCalledWith("prepareMessageBridge");
    expect(dispatch).toHaveBeenCalledWith("trackBridgeOperation");
  });

  it("keeps bridge metadata behind drawer tabs", () => {
    const { container } = render(<PlayArea t={t} state={state({ bridgeAppUrl: "https://xbridge.neo.org/", requestCount: 2 })} dispatch={vi.fn()} />);

    expect(container.querySelector(".bridge-drawer")).toBeNull();
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);

    expect(container.querySelector(".bridge-drawer")).toBeTruthy();
    expect(container.querySelectorAll(".bridge-drawer-tabs [role='tab']")).toHaveLength(3);
    expect(container.querySelector(".bridge-drawer__panel[data-mode='summary']")).toBeTruthy();
    expect(container.querySelector(".bridge-drawer-timeline")).toBeNull();

    fireEvent.click(container.querySelectorAll(".bridge-drawer-tabs [role='tab']")[1]);
    expect(container.querySelector(".bridge-drawer__panel[data-mode='timeline']")).toBeTruthy();
    expect(container.querySelector(".bridge-drawer-timeline")).toBeTruthy();

    fireEvent.click(container.querySelectorAll(".bridge-drawer-tabs [role='tab']")[2]);
    expect(container.querySelector(".bridge-drawer__panel[data-mode='resources']")).toBeTruthy();
    expect(container.querySelector("a[href='https://xbridge.neo.org/']")).toBeTruthy();
  });

  it("keeps bridge styling foreground-led, animated, and motion guarded", () => {
    const fs = require("node:fs");
    const s = fs.readFileSync(`${process.cwd()}/../neo-x-bridge/src/PlayArea.scss`, "utf8");

    expect(s).toContain('@use "@shared/components-react/v2/v2" as *;');
    expect(s).toMatch(/prefers-reduced-motion/);
    expect(s).toMatch(/\.neo-x-bridge-play-area \.mx2-score\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/\.bridge-scene\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.bridge-scene__mode-tabs\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.bridge-scene__packet\s*\{[\s\S]*animation:\s*bridge-packet-idle/);
    expect(s).toMatch(/@keyframes bridge-packet-travel/);
    expect(s).toMatch(/\.neo-x-bridge-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 184px/);
    expect(s).toMatch(/\.bridge-drawer-tabs\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.bridge-drawer-timeline li\s*\{[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\)/);
    expect(s).not.toMatch(/AI-generated scene backdrop/);
    expect(s).not.toMatch(/bridge-scene__backdrop|background-image:\s*url|var\(--mx2-scene-wash/);
    expect(s).not.toMatch(/\.copilot-scene__backdrop/);
  });
});
