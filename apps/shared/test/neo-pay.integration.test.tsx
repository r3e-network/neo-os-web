import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../neo-pay/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string) { return k; }
function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  const b: Record<string, unknown> = { activeCount:0, createdStreamCount:0, isLoading:false, isCreating:false, isRefreshing:false, claimingId:"", cancellingId:"", serviceNotice:"", allStreams:[], ...o };
  return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, createObservable(v)])) as ObservableState;
}
describe("neo-pay integration: dispatch params", () => {
  it("dispatchs createStream after entering recipient", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    fireEvent.change(container.querySelector("#neopay-amount") as HTMLInputElement, { target: { value: "5" } });
    fireEvent.change(container.querySelector("#neopay-recipient") as HTMLInputElement, { target: { value: "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq" } });
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("createStream", expect.objectContaining({
      amount: "5",
      recipient: "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq",
    })));
  });
  it("dispatches whole NEO only after sanitizing fractional input", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    fireEvent.click(container.querySelector(".neopay-token-option[data-token='NEO']") as Element);
    fireEvent.change(container.querySelector("#neopay-amount") as HTMLInputElement, { target: { value: "5.75" } });
    fireEvent.change(container.querySelector("#neopay-recipient") as HTMLInputElement, { target: { value: "NXV7ZhHiyM1aHXwpVsRZC6BwNFP2jghXAq" } });
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("createStream", expect.objectContaining({
      amount: "5",
      token: "NEO",
    })));
  });
  it("disables createStream without recipient", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    const btn = container.querySelector(".mx2-btn--primary") as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
