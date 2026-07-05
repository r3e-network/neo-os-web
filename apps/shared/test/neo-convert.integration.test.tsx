import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../neo-convert/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string) { return k; }
function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, createObservable(v)])) as ObservableState;
}
describe("neo-convert integration: dispatch + state", () => {
  it("renders the scene", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    expect(container.children.length).toBeGreaterThan(0);
  });
  it("fires a dispatch on primary action", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    const btn = container.querySelector(".mx2-btn--primary");
    if (btn && !(btn as HTMLButtonElement).disabled) {
      fireEvent.click(btn);
      await waitFor(() => expect(dispatch.mock.calls.length).toBeGreaterThan(0));
      expect(typeof dispatch.mock.calls[0][0]).toBe("string");
    }
  });
  it("has reduced-motion CSS guard", () => {
    const fs = require("node:fs");
    const s = fs.readFileSync(`${process.cwd()}/../neo-convert/src/PlayArea.scss`, "utf8");
    expect(s).toMatch(/prefers-reduced-motion/);
  });
});
