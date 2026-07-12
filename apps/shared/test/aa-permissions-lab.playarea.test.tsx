import React from "react";
import fs from "node:fs";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../aa-permissions-lab/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const ACCOUNT = "0x1111111111111111111111111111111111111111";
const OTHER_ACCOUNT = "0x2222222222222222222222222222222222222222";
const OWNER = "0x3333333333333333333333333333333333333333";
const VERIFIER = "0x4444444444444444444444444444444444444444";
const TARGET = "0x5555555555555555555555555555555555555555";

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

function boundState(overrides: Partial<Record<string, unknown>> = {}) {
  return appState({
    launchForm: {
      accountIdHash: ACCOUNT,
      verifierHash: TARGET,
      verifierParamsHex: "",
      hookHash: "",
    },
    hasInspected: true,
    inspectedAccountId: ACCOUNT,
    currentVerifier: VERIFIER,
    currentHook: "",
    currentBackupOwner: OWNER,
    connectedWalletDisplay: OWNER,
    hasPendingVerifier: false,
    hasPendingHook: false,
    pendingVerifierUnlockAt: 0,
    pendingHookUnlockAt: 0,
    ...overrides,
  });
}

describe("AA Permissions product surface", () => {
  it("leads with a real permission resource and keeps form controls out of the stage", () => {
    const { container } = render(
      <PlayArea t={t} state={appState()} dispatch={vi.fn()} />,
    );

    expect(container.querySelector(".perms-console")).toBeTruthy();
    expect(container.querySelector(".perms-passport")).toBeTruthy();
    expect(container.querySelector(".perms-lifecycle__track")).toBeTruthy();
    expect((container.querySelector(".perms-console__art") as HTMLImageElement).src)
      .toContain("permission-console.webp");
    expect(container.querySelector(".mx2-stage__scene input")).toBeNull();
    expect(container.querySelector(".perms-drawer")).toBeNull();
    expect(container.textContent).not.toMatch(/🔒|⏳|✓|✕/u);
    expect(container.querySelectorAll(".mx2-btn--primary")).toHaveLength(1);
  });

  it("keeps account, lane, target, params, and raw hashes in secondary settings", () => {
    const { container } = render(
      <PlayArea t={t} state={boundState()} dispatch={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "permissionSettings" }));

    expect(container.querySelector(".perms-drawer")).toBeTruthy();
    expect(screen.getByLabelText("accountId")).toBeTruthy();
    expect(screen.getByRole("radiogroup", { name: "permissionLane" })).toBeTruthy();
    expect(screen.getByLabelText("targetContractHash")).toBeTruthy();
    expect(screen.getByLabelText("verifierParams")).toBeTruthy();
    expect(container.querySelector(".perms-raw-record")).toBeTruthy();
    expect(container.querySelectorAll(".perms-drawer__panel.mx2-open-panel")).toHaveLength(3);
  });

  it("invalidates the live binding as soon as the account draft changes", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayArea t={t} state={boundState()} dispatch={dispatch} />);
    fireEvent.click(screen.getByRole("button", { name: "permissionSettings" }));
    fireEvent.change(screen.getByLabelText("accountId"), {
      target: { value: OTHER_ACCOUNT },
    });

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("invalidateBinding"));
  });

  it("shows wait and cancel during the safety window, then confirm after expiry", () => {
    const futureDispatch = vi.fn().mockResolvedValue(undefined);
    const future = render(<PlayArea
      t={t}
      state={boundState({
        hasPendingVerifier: true,
        pendingVerifierUnlockAt: Date.now() + 86_400_000,
      })}
      dispatch={futureDispatch}
    />);

    expect((screen.getByRole("button", { name: "safetyWindowActive" }) as HTMLButtonElement).disabled)
      .toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "cancelProposal" }));
    expect(futureDispatch).toHaveBeenCalledWith("cancelVerifier", ACCOUNT);
    future.unmount();

    const readyDispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayArea
      t={t}
      state={boundState({
        hasPendingVerifier: true,
        pendingVerifierUnlockAt: Date.now() - 1,
      })}
      dispatch={readyDispatch}
    />);
    fireEvent.click(screen.getByRole("button", { name: "confirmRotation" }));
    expect(readyDispatch).toHaveBeenCalledWith("confirmVerifier", ACCOUNT);
  });

  it("keeps writes locked for a different connected wallet or unavailable recovery", () => {
    const wrong = render(<PlayArea
      t={t}
      state={boundState({ connectedWalletDisplay: OTHER_ACCOUNT })}
      dispatch={vi.fn()}
    />);
    expect((screen.getByRole("button", { name: "useBackupOwnerWallet" }) as HTMLButtonElement).disabled)
      .toBe(true);
    wrong.unmount();

    render(<PlayArea
      t={t}
      state={boundState({ storageHealthy: false })}
      dispatch={vi.fn()}
    />);
    expect((screen.getByRole("button", { name: "writesLockedNoRecovery" }) as HTMLButtonElement).disabled)
      .toBe(true);
  });

  it("uses bright, high-contrast, responsive styles with reduced-motion handling", () => {
    const styles = fs.readFileSync(
      `${process.cwd()}/../aa-permissions-lab/src/PlayArea.scss`,
      "utf8",
    );
    const source = fs.readFileSync(
      `${process.cwd()}/../aa-permissions-lab/src/PlayArea.tsx`,
      "utf8",
    );

    expect(styles).toMatch(/\.perms-console\s*\{[\s\S]*background:\s*#ead6b9/);
    expect(styles).toMatch(/\.perms-passport\s*\{[\s\S]*background:\s*rgba\(255, 254, 250, 0\.97\)/);
    expect(styles).toMatch(/\.perms-console__art\s*\{[\s\S]*object-fit:\s*cover/);
    expect(styles).toMatch(/\.perms-lifecycle__track\s*\{[\s\S]*grid-template-columns:\s*repeat\(3/);
    expect(styles).toMatch(/@media \(max-width:\s*720px\)/);
    expect(styles).toMatch(/@media \(prefers-reduced-motion:\s*reduce\)/);
    expect(styles).not.toMatch(/font-size:\s*clamp\(/);
    expect(source).toContain("OpenUiLiteProvider as OpenUiProvider");
    expect(source).toContain("new URL(");
    expect(source).not.toContain("<input");
    expect(source).not.toContain("eyebrow:");
  });
});
