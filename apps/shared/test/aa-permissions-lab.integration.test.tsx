import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../aa-permissions-lab/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string) { return k; }
function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, createObservable(v)])) as ObservableState;
}
describe("aa-permissions-lab integration: dispatch + state", () => {
  it("renders the scene", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    expect(container.children.length).toBeGreaterThan(0);
  });
  it("fires a dispatch on primary action", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    const input = container.querySelector(".perms-boundary__target-input input") as HTMLInputElement;
    const btn = container.querySelector(".mx2-btn--primary");
    fireEvent.change(input, { target: { value: "0x1111111111111111111111111111111111111111" } });
    if (btn && !(btn as HTMLButtonElement).disabled) {
      fireEvent.click(btn);
      await waitFor(() => expect(dispatch.mock.calls.length).toBeGreaterThan(0));
      expect(dispatch.mock.calls[0]).toEqual(["refresh", "0x1111111111111111111111111111111111111111"]);
    }
  });
  it("has reduced-motion CSS guard", () => {
    const fs = require("node:fs");
    const s = fs.readFileSync(`${process.cwd()}/../aa-permissions-lab/src/PlayArea.scss`, "utf8");
    expect(s).toMatch(/prefers-reduced-motion/);
  });
});
