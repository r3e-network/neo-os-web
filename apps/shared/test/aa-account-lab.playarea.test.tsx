import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../aa-account-lab/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    accountPlanTitle: "Account strategy",
    accountPlanDaily: "Everyday shell",
    accountPlanFast: "Fast recovery",
    accountPlanCold: "Cold vault",
    accountPlanDailyCopy: "Balanced recovery",
    accountPlanFastCopy: "Fast recovery",
    accountPlanColdCopy: "Long delay",
    ownerNotSet: "Connect or set owner",
    useConnectedWallet: "Use connected wallet",
    recoveryWindow: "Recovery window",
    register: "Register Account",
    inspect: "Inspect Account",
    connectWallet: "Connect Wallet",
    registerTitle: "Advanced",
    accountStageNeedOwner: "Set a backup owner",
    accountStageNeedVerifier: "Verifier needed",
    accountStageNeedTimelock: "Set a recovery window",
    accountShellProgress: "{count}/3 ready",
    registrationPending: "Registration pending",
    checkConfirmation: "Check confirmation",
    registrationPendingHint: "Check the saved transaction",
    derivedAccountPending: "Complete the shell",
    networkWriteCaution: "Registration writes to {network}",
    identityKeyRequired: "Identity key required",
  };
  let value = messages[key] ?? key;
  for (const [name, replacement] of Object.entries(params ?? {})) {
    value = value.replace(`{${name}}`, String(replacement));
  }
  return value;
}

const WEB3AUTH_PUBLIC_KEY = `04${"11".repeat(64)}`;

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    defaultVerifierDisplay: "0x2222222222222222222222222222222222222222",
    pendingStorageHealthy: true,
    ...overrides,
  };
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, createObservable(value)])) as ObservableState;
}

function source(relative: string): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return readFileSync(path.join(appsRoot, "aa-account-lab", relative), "utf8");
}

describe("AA Account Lab product surface", () => {
  it("uses the real account-control-center artwork as the primary account object", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector<HTMLImageElement>('.aa-scene__visual img[src="account-control-center.webp"]')).toBeTruthy();
    expect(container.querySelector<HTMLImageElement>('.aa-scene__core-mark[src="logo.webp"]')).toBeTruthy();
    expect(container.querySelector(".aa-plan-panel")).toBeTruthy();
    expect(container.querySelectorAll(".aa-plan-card")).toHaveLength(3);
    expect(container.querySelector(".aa-drawer__field")).toBeNull();
    expect(container.textContent).not.toContain("⚠");
  });

  it("keeps exact hashes and account inspection in the secondary drawer", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Advanced/ }));

    expect(container.querySelectorAll(".aa-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(3);
    expect(container.querySelectorAll(".aa-drawer__field input.semi-input")).toHaveLength(6);
    expect(container.querySelector(".aa-drawer__caution.mx2-open-notice.semi-banner")).toBeTruthy();
  });

  it("dispatches the real registration immediately after choosing a recovery strategy", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayArea t={t} state={state({
      connectedWalletDisplay: "0x1111111111111111111111111111111111111111",
      launchVerifierParamsHex: WEB3AUTH_PUBLIC_KEY,
    })} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: /Fast recovery/ }));
    fireEvent.click(screen.getByRole("button", { name: /Register Account/ }));

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith(
      "register",
      "",
      "0x2222222222222222222222222222222222222222",
      WEB3AUTH_PUBLIC_KEY,
      "",
      "0x1111111111111111111111111111111111111111",
      "604800",
    ));
  });

  it("uses launch-scoped account configuration and names the actual write network", () => {
    const { container } = render(<PlayArea t={t} state={state({
      networkDisplay: "testnet",
      launchAccountIdInput: "0x3333333333333333333333333333333333333333",
      launchVerifierParamsHex: WEB3AUTH_PUBLIC_KEY,
      launchHookHash: "0x4444444444444444444444444444444444444444",
      launchBackupOwner: "0x1111111111111111111111111111111111111111",
      launchEscapeTimelock: "604800",
    })} dispatch={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Advanced/ }));

    const inputs = Array.from(container.querySelectorAll<HTMLInputElement>(".aa-drawer__field input"));
    expect(inputs.map((input) => input.value)).toEqual(expect.arrayContaining([
      "0x3333333333333333333333333333333333333333",
      WEB3AUTH_PUBLIC_KEY,
      "0x4444444444444444444444444444444444444444",
      "0x1111111111111111111111111111111111111111",
      "604800",
    ]));
    expect(container.textContent).toContain("Registration writes to testnet");
  });

  it("makes durable transaction recovery the only primary action while registration is pending", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state({
      connectedWalletDisplay: "0x1111111111111111111111111111111111111111",
      pendingRegistration: {
        version: 1,
        txid: `0x${"ab".repeat(32)}`,
        network: "mainnet",
        coreHash: "0x3333333333333333333333333333333333333333",
        accountId: "0x4444444444444444444444444444444444444444",
        verifier: "0x2222222222222222222222222222222222222222",
        hook: "0x0000000000000000000000000000000000000000",
        backupOwner: "0x1111111111111111111111111111111111111111",
        escapeTimelock: 2_592_000,
        createdAt: Date.now(),
      },
    })} dispatch={dispatch} />);

    expect(container.querySelector(".aa-pending-strip")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Check confirmation" })[0]);
    expect(dispatch).toHaveBeenCalledWith("recoverRegistration");
    expect(screen.queryByRole("button", { name: "Register Account" })).toBeNull();
  });

  it("locks production visual and dependency boundaries", () => {
    const scss = source("src/PlayArea.scss");
    const tsx = source("src/PlayArea.tsx");

    expect(scss).toMatch(/\.aa-scene__visual img\s*\{[\s\S]*object-fit:\s*cover/);
    expect(scss).toMatch(/\.aa-pending-strip\s*\{[\s\S]*background:\s*#fffbeb/);
    expect(scss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(scss).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.aa-scene__visual/);
    expect(tsx).toContain("@shared/components-react/v2/OpenUiLite");
    expect(tsx).toContain("account-control-center.webp");
    expect(tsx).not.toMatch(/[⚠🔒🧩]/u);
    expect(tsx).not.toContain("aa-scene__core-ring");
  });
});
