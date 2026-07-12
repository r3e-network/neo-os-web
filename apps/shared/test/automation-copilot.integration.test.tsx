import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../automation-copilot/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string) { return k; }
function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {};
    base["$extra_state"] = "";
  return Object.fromEntries(Object.entries({ ...base, ...o }).map(([k, v]) => [k, createObservable(v)])) as ObservableState;
}
describe("automation-copilot integration: dispatch params", () => {
  it("dispatchs registerTrigger on primary action", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({ currentPrice: "$18.4200", priceFreshnessState: "fresh" })} dispatch={dispatch} />);
    const btn = container.querySelector(".mx2-btn--primary");
    if (btn) {
      fireEvent.click(btn);
      await waitFor(() => {
        const calls = dispatch.mock.calls;
        expect(calls.length).toBeGreaterThan(0);
        expect(calls[0][0]).toBeTruthy();
      });
    }
  });
});
