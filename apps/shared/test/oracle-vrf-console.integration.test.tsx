import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../oracle-vrf-console/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string) { return k; }
function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, createObservable(v)])) as ObservableState;
}
function appScssPath(app: string) {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return path.join(appsRoot, app, "src/PlayArea.scss");
}
describe("oracle-vrf-console integration: dispatch + state", () => {
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
      expect(dispatch.mock.calls[0][1]).toMatchObject({
        consumer: "miniapp-oracle-vrf-console",
        mode: "single-proof",
        rounds: "1",
        salt: "vrf:miniapp-round",
      });
    }
  });
  it("dispatches seed edits from the Open UI drawer fields", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as HTMLButtonElement);
    const inputs = container.querySelectorAll<HTMLInputElement>(".vrf-field input.semi-input");
    expect(inputs).toHaveLength(2);

    fireEvent.change(inputs[0], { target: { value: "miniapp-custom-game" } });
    fireEvent.change(inputs[1], { target: { value: "round:42" } });
    fireEvent.click(container.querySelector(".mx2-btn--primary") as HTMLButtonElement);

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("buildRequest", expect.objectContaining({
      consumer: "miniapp-custom-game",
      salt: "round:42",
    })));
  });
  it("has reduced-motion CSS guard", () => {
    const s = readFileSync(appScssPath("oracle-vrf-console"), "utf8");
    expect(s).toMatch(/prefers-reduced-motion/);
  });
});
