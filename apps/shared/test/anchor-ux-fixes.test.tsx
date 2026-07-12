import React from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import ProfitAnchorAdminPlayArea from "../../profitanchor-admin/src/PlayArea";
import TrustAnchorAdminPlayArea from "../../trustanchor-admin/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string) { return k; }
function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, createObservable(v)])) as ObservableState;
}
describe("Anchor admin PlayAreas (v2)", () => {
  it("renders ProfitAnchor Admin agent directory scene", () => {
    const { container } = render(<ProfitAnchorAdminPlayArea t={t} state={state()} dispatch={vi.fn()} />);
    expect(container.querySelector(".admin-scene")).toBeTruthy();
    expect(container.querySelector(".admin-topology")).toBeTruthy();
  });
  it("renders TrustAnchor Admin agent directory scene", () => {
    const { container } = render(<TrustAnchorAdminPlayArea t={t} state={state()} dispatch={vi.fn()} />);
    expect(container.querySelector(".admin-scene")).toBeTruthy();
    expect(container.querySelector(".admin-topology")).toBeTruthy();
  });
  it("has reduced-motion in both admin apps", () => {
    const fs = require("node:fs");
    const shared = fs.readFileSync(`${process.cwd()}/components-react/v2/anchor-admin/_workspace.scss`, "utf8");
    expect(shared).toMatch(/prefers-reduced-motion/);
    for (const app of ["profitanchor-admin", "trustanchor-admin"]) {
      const s = fs.readFileSync(`${process.cwd()}/../${app}/src/PlayArea.scss`, "utf8");
      expect(s).toMatch(/anchor-admin\/workspace/);
    }
  });
});
