import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../custom-anchor/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(k: string) { return k; }

function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    anchorAppId: "custom-anchor:team:nonce",
    anchorMode: 1,
    totalStaked: "42",
    rewardReserve: "3",
    userStake: "5",
    pendingRewards: "0.25",
    agentCount: 21,
    rewardPerNeo: "0.01",
    lastTxid: "",
    workflowStatus: "Ready",
    lastError: "",
    isLoading: false,
    submitting: false,
    neoCredit: "0",
    gasCredit: "0",
    discoveredAnchors: [],
  };
  return Object.fromEntries(Object.entries({ ...base, ...o }).map(([k, v]) => [k, createObservable(v)])) as ObservableState;
}

describe("custom-anchor integration: dispatch params", () => {
  it("dispatches stake with the reviewed anchor id and whole-NEO amount", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: "stakeAction" }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("stake", {
        anchorAppId: "custom-anchor:team:nonce",
        amount: "1",
      });
    });
  });

  it("does not dispatch stake while the anchor is unregistered", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayArea t={t} state={state({ anchorMode: 0 })} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: "stakeAction" }));
    expect(dispatch).not.toHaveBeenCalled();
  });
});
