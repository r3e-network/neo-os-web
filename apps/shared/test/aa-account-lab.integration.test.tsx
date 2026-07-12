import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../aa-account-lab/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const copy: Record<string, string> = {
    connectWallet: "Connect Wallet",
    inspect: "Inspect Account",
    registerTitle: "Advanced account fields",
    accountShellProgress: "{count}/3 ready",
    networkWriteCaution: "Registration writes to {network}",
    derivedAccountPending: "Complete the shell",
    identityKeyRequired: "Identity key required",
  };
  let value = copy[key] ?? key;
  for (const [name, replacement] of Object.entries(params ?? {})) {
    value = value.replace(`{${name}}`, String(replacement));
  }
  return value;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    defaultVerifierDisplay: "0x2222222222222222222222222222222222222222",
    pendingStorageHealthy: true,
    networkDisplay: "mainnet",
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  ) as ObservableState;
}

describe("AA Account Lab product integration", () => {
  it("connects from the single primary action when no wallet is present", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("connect"));
  });

  it("keeps exact account inspection secondary and dispatches the entered AccountId", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const accountId = "0x3333333333333333333333333333333333333333";
    render(<PlayArea t={t} state={state({ launchAccountIdInput: accountId })} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: /Advanced account fields/ }));
    fireEvent.click(screen.getByRole("button", { name: "Inspect Account" }));

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("inspect", accountId));
  });
});
