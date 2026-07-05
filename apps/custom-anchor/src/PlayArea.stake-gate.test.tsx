import React from "react";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "@shared/react/context";
import PlayArea from "./PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

// Identity translator: assertions match against the locale KEY so the test does
// not couple to specific copy. The behavior under test is the stake gate, which
// is independent of wording.
function t(key: string) {
  return key;
}

function readPlayAreaStyles() {
  const candidates = [
    resolve(process.cwd(), "src/PlayArea.scss"),
    resolve(process.cwd(), "apps/custom-anchor/src/PlayArea.scss"),
  ];
  const stylePath = candidates.find((candidate) => existsSync(candidate));
  if (!stylePath) throw new Error("PlayArea.scss was not found from the current test working directory.");
  return readFileSync(stylePath, "utf8");
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values = {
    anchorAppId: "custom-anchor:team:nonce",
    // mode 1 = registered (trust); mode 0 = not registered.
    anchorMode: 1,
    totalStaked: "12",
    rewardReserve: "0",
    userStake: "0",
    pendingRewards: "0",
    agentCount: 0,
    rewardPerNeo: "0",
    lastTxid: "0xabc",
    workflowStatus: "Ready",
    lastError: "",
    isLoading: false,
    neoCredit: "0",
    gasCredit: "0",
    discoveredAnchors: [],
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  );
}

function renderPlayArea(overrides: Partial<Record<string, unknown>> = {}, dispatch = vi.fn(async () => undefined)) {
  render(
    <PlayArea
      t={t}
      state={state(overrides)}
      dispatch={dispatch}
    />,
  );
  return dispatch;
}

describe("Custom Anchor stake gate (0-agent inert anchor)", () => {
  it("disables Stake and shows the no-agents warning for a registered anchor with 0 agents", () => {
    renderPlayArea({ anchorMode: 1, agentCount: 0 });

    // The inert-anchor warning is surfaced (not buried in a collapsed panel).
    expect(screen.getByText("noAgentsTitle")).toBeTruthy();
    // Stake is blocked until the user acknowledges the 0-agent state.
    const stake = screen.getByRole("button", { name: "stakeAction" }) as HTMLButtonElement;
    expect(stake.disabled).toBe(true);
  });

  it("enables Stake only after the user confirms staking into a 0-agent anchor", async () => {
    const dispatch = renderPlayArea({ anchorMode: 1, agentCount: 0 });

    const stake = screen.getByRole("button", { name: "stakeAction" }) as HTMLButtonElement;
    expect(stake.disabled).toBe(true);

    // Tick the explicit acknowledgement checkbox.
    fireEvent.click(screen.getByRole("checkbox"));
    expect(stake.disabled).toBe(false);

    fireEvent.click(stake);
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("stake", {
        anchorAppId: "custom-anchor:team:nonce",
        amount: "1",
      });
    });
  });

  it("does not gate or warn when the anchor already has agents", () => {
    renderPlayArea({ anchorMode: 1, agentCount: 21 });

    expect(screen.queryByText("noAgentsTitle")).toBeNull();
    const stake = screen.getByRole("button", { name: "stakeAction" }) as HTMLButtonElement;
    // A valid id + amount + provisioned agents -> stake is enabled.
    expect(stake.disabled).toBe(false);
  });

  it("does not show the no-agents gate for an unregistered anchor (handled by the not-registered notice)", () => {
    renderPlayArea({ anchorMode: 0, agentCount: 0 });
    expect(screen.queryByText("noAgentsTitle")).toBeNull();
  });

  it("keeps NEO stake amounts whole-number only before dispatch", async () => {
    const dispatch = renderPlayArea({ anchorMode: 1, agentCount: 21 });

    fireEvent.click(screen.getByRole("button", { name: /discoverLabel/i }));

    const amountInput = document.querySelector<HTMLInputElement>(".anchor-input--amount input.semi-input");
    expect(amountInput).toBeTruthy();
    expect(amountInput?.inputMode).toBe("numeric");

    fireEvent.change(amountInput as HTMLInputElement, { target: { value: "12.9" } });
    expect(amountInput?.value).toBe("12");

    fireEvent.click(screen.getByRole("button", { name: "stakeAction" }));
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("stake", {
        anchorAppId: "custom-anchor:team:nonce",
        amount: "12",
      });
    });
  });

  it("styles drawer controls as compact designed panels instead of raw form rows", () => {
    const styles = readPlayAreaStyles();

    expect(styles).toMatch(/\.anchor-drawer__panel\.mx2-open-panel\.semi-card\s*\{[\s\S]*border-radius:\s*20px/);
    expect(styles).toMatch(/\.anchor-drawer__panel\.mx2-open-panel\.semi-card > \.semi-card-body\s*\{[\s\S]*display:\s*grid/);
    expect(styles).toMatch(/\.anchor-drawer \.anchor-field\.mx2-open-field\s*\{[\s\S]*border-radius:\s*16px/);
    expect(styles).toMatch(/\.anchor-drawer \.anchor-field\.mx2-open-field:focus-within\s*\{[\s\S]*box-shadow:/);
    expect(styles).toMatch(/\.anchor-field > \.mx2-open-field__label\s*\{/);
    expect(styles).not.toMatch(/\.anchor-field span\s*\{/);
    expect(styles).toMatch(/\.anchor-drawer \.anchor-input,[\s\S]*\.anchor-candidates-input,[\s\S]*\.anchor-candidates-input \.semi-input-textarea\s*\{[\s\S]*border:\s*0/);
    expect(styles).toMatch(/\.anchor-drawer__notice\.mx2-open-notice\.semi-banner\s*\{[\s\S]*align-items:\s*flex-start/);
    expect(styles).toMatch(/\.anchor-mode\.mx2-open-field\s*\{[\s\S]*border-radius:\s*16px/);
    expect(styles).toMatch(/\.anchor-mode \.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*border-radius:\s*14px/);
    expect(styles).toMatch(/\.anchor-mode \.mx2-open-segmented\.semi-radioGroup \.semi-radio-checked\s*\{[\s\S]*box-shadow:/);
    expect(styles).not.toMatch(/\.anchor-mode button\[data-active="true"\]/);
  });
});
