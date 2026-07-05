import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../neodid-passport/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(k: string) { return k; }
function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {};
    base["$extra_state"] = "";
  return Object.fromEntries(Object.entries({ ...base, ...o }).map(([k, v]) => [k, createObservable(v)])) as ObservableState;
}
describe("neodid-passport integration: dispatch params", () => {
  it("dispatches buildPassport from the foreground credential lane", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    const btn = container.querySelector(".mx2-btn--primary");
    expect(btn).toBeTruthy();
    fireEvent.click(btn as Element);
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("buildPassport", {
        subject: "did:morpheus:neo_n3:service:neodid",
        claim: "wallet-ownership",
        audience: "miniapp-neodid-passport",
        provider: "wallet",
      });
    });
  });

  it("does not dispatch an empty credential lane", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    const btn = container.querySelector<HTMLButtonElement>(".mx2-btn--primary");

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    const claimInput = container.querySelectorAll<HTMLInputElement>(".did-drawer__field input")[1];
    fireEvent.change(claimInput, { target: { value: "" } });
    expect(btn?.disabled).toBe(true);
    fireEvent.click(btn as Element);
    await waitFor(() => expect(dispatch).not.toHaveBeenCalled());
  });
});
