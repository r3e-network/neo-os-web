import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../aa-permissions-lab/src/PlayArea";
import type { PendingPermissionTransaction } from "../../aa-permissions-lab/src/permissions";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const ACCOUNT = "0x1111111111111111111111111111111111111111";
const OWNER = "0x2222222222222222222222222222222222222222";
const TARGET = "0x3333333333333333333333333333333333333333";

afterEach(() => cleanup());

function t(key: string) {
  return key;
}

function appState(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values = {
    network: "mainnet",
    aaCore: "0x0268a387913b250166ddec032b03332690a1ef78",
    launchForm: {
      accountIdHash: "",
      verifierHash: "",
      verifierParamsHex: "",
      hookHash: "",
    },
    storageHealthy: true,
    lastWriteStatus: "transactionIdle",
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  ) as ObservableState;
}

describe("AA Permissions PlayArea integration", () => {
  it("hydrates a launch account into the resource and dispatches exact inspection", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayArea
      t={t}
      state={appState({
        launchForm: {
          accountIdHash: ACCOUNT,
          verifierHash: "",
          verifierParamsHex: "",
          hookHash: "",
        },
      })}
      dispatch={dispatch}
    />);

    fireEvent.click(screen.getByRole("button", { name: "inspectAccount" }));
    expect(dispatch).toHaveBeenCalledWith("inspectBinding", ACCOUNT);
  });

  it("turns an inspected empty lane into an immediate-install action", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayArea
      t={t}
      state={appState({
        launchForm: {
          accountIdHash: ACCOUNT,
          verifierHash: TARGET,
          verifierParamsHex: "aabb",
          hookHash: "",
        },
        hasInspected: true,
        inspectedAccountId: ACCOUNT,
        currentVerifier: "",
        currentHook: "",
        currentBackupOwner: OWNER,
        connectedWalletDisplay: OWNER,
      })}
      dispatch={dispatch}
    />);

    fireEvent.click(screen.getByRole("button", { name: "installBindingNow" }));
    expect(dispatch).toHaveBeenCalledWith("submitVerifier", ACCOUNT, TARGET, "aabb");
  });

  it("gives a saved broadcast transaction one recovery action", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const pending: PendingPermissionTransaction = {
      version: 1,
      network: "mainnet",
      aaCore: "0x0268a387913b250166ddec032b03332690a1ef78",
      accountId: ACCOUNT,
      walletHash: OWNER,
      operation: "propose-verifier",
      lane: "verifier",
      targetHash: TARGET,
      previousHash: OWNER,
      eventName: "VerifierUpdateInitiated",
      txid: `0x${"ab".repeat(32)}`,
      submittedAt: Date.now(),
    };
    render(<PlayArea
      t={t}
      state={appState({ pendingTransaction: pending, pendingTxid: pending.txid })}
      dispatch={dispatch}
    />);

    const primary = screen.getByRole("button", { name: "checkTransaction" });
    fireEvent.click(primary);
    expect(dispatch).toHaveBeenCalledWith("reconcileTransaction");
    expect(screen.getAllByRole("button").filter((button) => button.classList.contains("mx2-btn--primary")))
      .toHaveLength(1);
  });
});
