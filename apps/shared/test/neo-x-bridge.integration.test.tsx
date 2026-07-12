import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../neo-x-bridge/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string) { return k; }
function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    n3Wallet: {
      environment: "mainnet",
      chain: "neo-n3",
      network: "neo-n3-mainnet",
      address: "NLnyLtep7jwyq1qhNPkwXbJpurC4jUT8ke",
      checkedAt: "2026-07-12T00:00:00.000Z",
      balances: {
        GAS: { units: "500000000", display: "5", decimals: 8 },
        NEO: { units: "10", display: "10", decimals: 0 },
      },
    },
  };
  base["$extra_state"] = "";
  return Object.fromEntries(Object.entries({ ...base, ...o }).map(([k, v]) => [k, createObservable(v)])) as ObservableState;
}
describe("neo-x-bridge integration: dispatch params", () => {
  it("dispatches an exact prepareAssetBridge handoff after valid inputs", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    const recipient = `0x${"a".repeat(40)}`;
    fireEvent.change(container.querySelector("#nxb-amount")!, { target: { value: "1" } });
    fireEvent.change(container.querySelector("#nxb-recipient")!, { target: { value: recipient } });

    const button = container.querySelector<HTMLButtonElement>(".mx2-btn--primary");
    expect(button).not.toBeNull();
    expect(button?.disabled).toBe(false);
    fireEvent.click(button!);

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("prepareAssetBridge", {
        direction: "n3-to-neox",
        asset: "GAS",
        amount: "1",
        recipient,
      });
    });
  });
});
