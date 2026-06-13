import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import ProfitAnchorPlayArea from "../../profitanchor/src/PlayArea";
import TrustAnchorPlayArea from "../../trustanchor/src/PlayArea";
import ProfitAnchorAdminPlayArea from "../../profitanchor-admin/src/PlayArea";
import TrustAnchorAdminPlayArea from "../../trustanchor-admin/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

/**
 * Minimal translator: returns the key with {param} interpolation so tests can
 * assert on stable identifiers rather than English copy.
 */
function t(key: string, params?: Record<string, string | number>) {
  // A couple of keys carry interpolation tokens; provide their templates so the
  // {address} substitution is observable in the rendered banner.
  const templates: Record<string, string> = {
    operatorRequiredBody: "Operator wallet required {address}",
  };
  let value = templates[key] ?? key;
  for (const [paramKey, paramValue] of Object.entries(params ?? {})) {
    value = value.replace(`{${paramKey}}`, String(paramValue));
  }
  return value;
}

function userState(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values = {
    stats: {
      totalStaked: 12,
      rewardReserve: 0,
      agentCount: 21,
      rps: "0",
      selectedAgentId: 4,
    },
    agentAccounts: [],
    agentCount: 21,
    myStake: 2,
    pendingRewards: 0,
    pendingWithdraw: 0,
    submitting: false,
    myStakeDisplay: "2.00 NEO",
    pendingRewardsDisplay: "0.00 GAS",
    pendingWithdrawDisplay: "0.00 NEO",
    rewardReserveDisplay: "0.00 GAS",
    rewardPerNeoDisplay: "0.00",
    totalNeoDisplay: "12.00 NEO",
    workflowStatus: "workflowReady",
    lastTxid: "",
    lastError: "",
    actionHistory: [],
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  );
}

function adminState(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values = {
    stats: {
      totalStaked: 12,
      rewardReserve: 3,
      agentCount: 21,
      rps: "0",
      selectedAgentId: 4,
    },
    agentAccounts: [],
    totalNeoDisplay: "12.00 NEO",
    reserveDisplay: "3.00 GAS",
    selectedAgentDisplay: "#4",
    agentCountDisplay: "21 / 21",
    adminState: "admin",
    expectedAdminDisplay: "",
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  );
}

describe("Anchor claim gating (claimable rewards = 0)", () => {
  for (const [name, Comp] of [
    ["TrustAnchor", TrustAnchorPlayArea],
    ["ProfitAnchor", ProfitAnchorPlayArea],
  ] as const) {
    it(`${name} disables the claim button when pendingRewards is 0`, () => {
      render(<Comp t={t} state={userState({ pendingRewards: 0 })} dispatch={vi.fn(async () => undefined)} />);
      const claimButton = screen.getByRole("button", { name: "submitClaim" }) as HTMLButtonElement;
      expect(claimButton.disabled).toBe(true);
    });

    it(`${name} enables the claim button when pendingRewards is positive`, () => {
      render(
        <Comp
          t={t}
          state={userState({ pendingRewards: 0.4, pendingRewardsDisplay: "0.40 GAS" })}
          dispatch={vi.fn(async () => undefined)}
        />,
      );
      const claimButton = screen.getByRole("button", { name: "submitClaim" }) as HTMLButtonElement;
      expect(claimButton.disabled).toBe(false);
    });
  }
});

describe("Anchor NEO-credit recovery exit path", () => {
  for (const [name, Comp] of [
    ["TrustAnchor", TrustAnchorPlayArea],
    ["ProfitAnchor", ProfitAnchorPlayArea],
  ] as const) {
    it(`${name} hides the recover button when there is no NEO credit`, () => {
      render(<Comp t={t} state={userState({ pendingWithdraw: 0 })} dispatch={vi.fn(async () => undefined)} />);
      expect(screen.queryByRole("button", { name: "recoverCredit" })).toBeNull();
    });

    it(`${name} surfaces and dispatches recoverNeoCredit when NEO credit exists`, async () => {
      const dispatch = vi.fn(async () => undefined);
      render(
        <Comp
          t={t}
          state={userState({ pendingWithdraw: 5, pendingWithdrawDisplay: "5.00 NEO" })}
          dispatch={dispatch}
        />,
      );
      const recoverButton = screen.getByRole("button", { name: "recoverCredit" });
      fireEvent.click(recoverButton);
      await waitFor(() => {
        expect(dispatch).toHaveBeenCalledWith("recoverNeoCredit");
      });
    });
  }
});

describe("Anchor PlayArea reflects the shared in-flight lock", () => {
  it("TrustAnchor disables stake while submitting is true", () => {
    render(
      <TrustAnchorPlayArea
        t={t}
        state={userState({ submitting: true })}
        dispatch={vi.fn(async () => undefined)}
      />,
    );
    const stakeButton = screen.getByRole("button", { name: "submitStake" }) as HTMLButtonElement;
    expect(stakeButton.disabled).toBe(true);
  });
});

describe("Anchor admin role gating (non-operator)", () => {
  for (const [name, Comp] of [
    ["TrustAnchor", TrustAnchorAdminPlayArea],
    ["ProfitAnchor", ProfitAnchorAdminPlayArea],
  ] as const) {
    it(`${name} Admin shows the operator-required banner and disables the move button when denied`, () => {
      render(
        <Comp
          t={t}
          state={adminState({ adminState: "denied", expectedAdminDisplay: "NXXXX…ABCDEF" })}
          dispatch={vi.fn(async () => undefined)}
        />,
      );
      // Banner copy resolves through t() (interpolated address present).
      expect(screen.getByText("operatorRequiredTitle")).toBeTruthy();
      expect(screen.getByText(/NXXXX…ABCDEF/)).toBeTruthy();
      const moveButton = screen.getByRole("button", { name: "submitMove" }) as HTMLButtonElement;
      expect(moveButton.disabled).toBe(true);
    });

    it(`${name} Admin keeps the move button reachable for the operator`, () => {
      render(
        <Comp
          t={t}
          state={adminState({ adminState: "admin" })}
          dispatch={vi.fn(async () => undefined)}
        />,
      );
      expect(screen.queryByText("operatorRequiredTitle")).toBeNull();
      const moveButton = screen.getByRole("button", { name: "submitMove" }) as HTMLButtonElement;
      // Default form is from=1, to=2, amount=1 -> enabled for the operator.
      expect(moveButton.disabled).toBe(false);
    });
  }
});

describe("Anchor admin renders the on-chain agent directory", () => {
  it("TrustAnchor Admin shows getAgent account addresses (not only static roster fields)", () => {
    render(
      <TrustAnchorAdminPlayArea
        t={t}
        state={adminState({
          agentAccounts: [
            { agentId: 1, account: "0xabc0000000000000000000000000000000000001", candidate: "02ab", active: true },
          ],
        })}
        dispatch={vi.fn(async () => undefined)}
      />,
    );
    expect(
      screen.getByText("0xabc0000000000000000000000000000000000001"),
    ).toBeTruthy();
  });
});
