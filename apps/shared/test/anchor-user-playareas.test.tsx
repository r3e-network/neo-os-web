import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import ProfitAnchorPlayArea from "../../profitanchor/src/PlayArea";
import TrustAnchorPlayArea from "../../trustanchor/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string) { return k; }
function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, createObservable(v)])) as ObservableState;
}
describe("Anchor user PlayAreas (v2)", () => {
  it("renders ProfitAnchor tool scene", () => {
    const { container } = render(<ProfitAnchorPlayArea t={t} state={state()} dispatch={vi.fn()} />);
    expect(container.querySelector(".tool-scene")).toBeTruthy();
  });
  it("renders TrustAnchor tool scene", () => {
    const { container } = render(<TrustAnchorPlayArea t={t} state={state()} dispatch={vi.fn()} />);
    expect(container.querySelector(".tool-scene")).toBeTruthy();
  });
  it("has reduced-motion in both", () => {
    const fs = require("node:fs");
    for (const app of ["profitanchor", "trustanchor"]) {
      const s = fs.readFileSync(`${process.cwd()}/../${app}/src/PlayArea.scss`, "utf8");
      expect(s).toMatch(/prefers-reduced-motion/);
    }
  });
});
