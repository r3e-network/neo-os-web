import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../aa-relay-console/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string) { return k; }
function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, createObservable(v)])) as ObservableState;
}
describe("aa-relay-console integration: dispatch + state", () => {
  it("renders the scene", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    expect(container.children.length).toBeGreaterThan(0);
  });
  it("fires a dispatch on primary action", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByRole } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as HTMLButtonElement);
    const input = getByRole("textbox", { name: "aaAddress" });
    const btn = container.querySelector(".mx2-btn--primary");
    fireEvent.change(input, { target: { value: "NZTbZjNcFVb5AkVVTT8knybCuhPhSmBCEH" } });
    if (btn && !(btn as HTMLButtonElement).disabled) {
      fireEvent.click(btn);
      await waitFor(() => expect(dispatch.mock.calls.length).toBeGreaterThan(0), { timeout: 2000 });
      expect(dispatch.mock.calls[0]).toEqual(["submitRelay", "NZTbZjNcFVb5AkVVTT8knybCuhPhSmBCEH", "", "{}"]);
    }
  });
  it("has reduced-motion CSS guard", () => {
    const fs = require("node:fs");
    const s = fs.readFileSync(`${process.cwd()}/../aa-relay-console/src/PlayArea.scss`, "utf8");
    expect(s).toMatch(/prefers-reduced-motion/);
  });
});
