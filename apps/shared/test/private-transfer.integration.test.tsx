import React from "react";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../private-transfer/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string) { return k; }
function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {};
    base["$extra_state"] = "";
  return Object.fromEntries(Object.entries({ ...base, ...o }).map(([k, v]) => [k, createObservable(v)])) as ObservableState;
}
describe("private-transfer integration: dispatch params", () => {
  it("dispatches prepareTransfer only after the composer has valid inputs", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    const btn = container.querySelector(".mx2-btn--primary") as HTMLButtonElement;

    expect(btn.disabled).toBe(true);
    fireEvent.change(container.querySelector("input[placeholder='formRecipientPlaceholder']") as Element, {
      target: { value: "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32" },
    });
    fireEvent.change(container.querySelector("input[placeholder='0.00']") as Element, {
      target: { value: "1.25" },
    });
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.change(container.querySelector("input[placeholder='formMemoLabel']") as Element, {
      target: { value: "vault note" },
    });

    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith("prepareTransfer", {
        recipient: "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32",
        amount: "1.25",
        asset: "GAS",
        memo: "vault note",
      }),
    );
  });

  it("dispatches a NEO transfer intent with whole-token amount only", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    const btn = container.querySelector(".mx2-btn--primary") as HTMLButtonElement;

    fireEvent.click(within(container.querySelector(".pt-asset-switch") as HTMLElement).getByRole("radio", { name: /NEO/ }));
    fireEvent.change(container.querySelector("input[placeholder='formRecipientPlaceholder']") as Element, {
      target: { value: "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32" },
    });
    fireEvent.change(container.querySelector("input[placeholder='1']") as Element, {
      target: { value: "10.75" },
    });

    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith("prepareTransfer", {
        recipient: "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32",
        amount: "10",
        asset: "NEO",
        memo: "",
      }),
    );
  });
});
