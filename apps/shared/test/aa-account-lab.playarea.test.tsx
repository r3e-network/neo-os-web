import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import { parseMiniAppLaunchContext } from "../utils/launch-params";
import PlayArea from "../../aa-account-lab/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

const VERIFIER_HASH = "0x5be915aea3ce85e4752d522632f0a9520e377aaf";
const HOOK_HASH = "0x0000000000000000000000000000000000000000";
const BACKUP_OWNER = "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32";

function t(key: string) {
  const messages: Record<string, string> = {
    accountHeroEyebrow: "Account Abstraction",
    accountHeroTitle: "Account control center",
    accountHeroCopy: "Inspect and register AA shells.",
    accountMetricsLabel: "AA account environment summary",
    network: "Network",
    defaultVerifier: "Default Verifier",
    accountMetricAccount: "Account Shell",
    accountStageEyebrow: "AA shell assembly",
    accountStageIdle: "Connect, inspect, then assemble the account shell",
    accountStageReady: "Account shell ready for registration",
    accountStageInspecting: "Reading AA Core account state...",
    accountStageRegistering: "Registering AA account shell...",
    accountStageConnecting: "Connecting wallet identity...",
    accountStageCopy: "Verifier, backup owner, and escape window assemble into the deterministic AccountId accepted by AA Core.",
    accountInspectorTitle: "Account Readiness",
    accountId: "AccountId Hash",
    accountIdHint: "Use the registered 20-byte AccountId hash, or a public key that can be normalized to one.",
    accountIdPlaceholder: "20-byte AccountId hash or public key",
    inspectBlocked: "Enter an account id before reading AA Core state.",
    inspect: "Inspect Account",
    connectWallet: "Connect Wallet",
    accountFlowLabel: "AA account workflow",
    accountFlowInspect: "Read live state",
    accountFlowInspectDesc: "Resolve account state.",
    accountFlowRegister: "Register shell",
    accountFlowRegisterDesc: "Submit registerAccount.",
    accountFlowRecovery: "Keep recovery clear",
    accountFlowRecoveryDesc: "Pin backup owner.",
    accountStateLabel: "Live AA Core",
    accountStateTitle: "Account state",
    currentVerifier: "Current Verifier",
    currentHook: "Current Hook",
    currentBackupOwner: "Current Backup Owner",
    aaCore: "AA Core",
    accountRiskTitle: "Registration guardrails",
    accountRiskCopy: "Blocks empty required fields.",
    registerTitle: "Register New Account",
    accountShellLabel: "Draft Shell",
    registerBlocked:
      "Complete account id, verifier, backup owner, and timelock before submitting.",
    verifier: "Verifier Hash",
    verifierHint: "Required verifier.",
    verifierPlaceholder: "0x...",
    verifierParams: "Verifier Params Hex",
    verifierParamsHint: "Optional hex.",
    verifierParamsPlaceholder: "hex payload",
    hook: "Hook Hash",
    hookHint: "Optional guard hook.",
    hookPlaceholder: "0x... or empty",
    backupOwner: "Backup Owner",
    backupOwnerHint: "Required recovery owner.",
    backupOwnerPlaceholder: "N... or 0x...",
    timelock: "Escape Timelock",
    timelockHint: "Seconds before backup recovery.",
    timelockPlaceholder: "2592000",
    register: "Register Account",
    notAvailable: "Not available",
    accountIdSharedHint: "Shared with the inspector above.",
    mainnetCaution: "You are on mainnet — Register Account is a real write.",
    mainnetCautionLead: "You are on mainnet — Register Account is a ",
    mainnetCautionEmphasis: "real write against mainnet AA Core and spends GAS",
    mainnetCautionTail: ".",
    alreadyRegisteredCaution: "This account already has a verifier registered.",
    noVerifierRegistered: "No verifier registered.",
    currentEscapeTimelock: "Escape Timelock",
    currentEscapeStatus: "Escape Status",
    derivedAccountIdLabel: "Derived AccountId",
    derivedAccountIdHint: "The contract only accepts this id derived from the parameters above.",
    backupOwnerMustSign: "The backup owner must sign this transaction.",
  };
  return messages[key] ?? key;
}

function launch(url: string) {
  return parseMiniAppLaunchContext(url, "miniapp-aa-account-lab");
}

function baseState(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    isInspecting: false,
    isSubmitting: false,
    currentVerifier: "Not available",
    currentHook: "Not available",
    currentBackupOwner: "Not available",
    aaCoreDisplay: "0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2",
    defaultVerifierDisplay: VERIFIER_HASH,
    networkDisplay: "testnet",
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      createObservable(value),
    ]),
  );
}

describe("AA Account Lab PlayArea launch flow", () => {
  it("prefills inspect and register forms from host launch params", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    render(
      <PlayArea
        t={t}
        state={baseState()}
        dispatch={dispatch}
        launchContext={launch(
          `https://neomini.app/miniapps/aa-account-lab?network=testnet&accountIdInput=neo-aa-001&verifierHash=${VERIFIER_HASH}&verifierParamsHex=112233&hookHash=${HOOK_HASH}&backupOwner=${BACKUP_OWNER}&escapeTimelock=604800`,
        )}
      />,
    );

    expect(document.querySelector(".account-flow-stage")).toBeTruthy();
    expect(screen.getByText("Account shell ready for registration")).toBeTruthy();
    expect(document.querySelector('.account-flow-stage__media[src="./account-control-center.jpg"]')).toBeTruthy();

    // Inspect card keeps the single editable AccountId input prefilled from the
    // launch param; the register card derives its id from parameters instead.
    expect(
      (screen.getByLabelText("AccountId Hash") as HTMLInputElement).value,
    ).toBe("neo-aa-001");
    expect((screen.getByLabelText("Verifier Hash") as HTMLInputElement).value).toBe(
      VERIFIER_HASH,
    );
    expect(
      (screen.getByLabelText("Verifier Params Hex") as HTMLInputElement).value,
    ).toBe("112233");
    expect((screen.getByLabelText("Hook Hash") as HTMLInputElement).value).toBe(
      HOOK_HASH,
    );
    expect((screen.getByLabelText("Backup Owner") as HTMLInputElement).value).toBe(
      BACKUP_OWNER,
    );
    expect(
      (screen.getByLabelText("Escape Timelock") as HTMLInputElement).value,
    ).toBe("604800");

    // The derived registration accountId preview renders the only id the
    // contract will accept (a 0x 20-byte hash), not the free seed.
    const derived = document.querySelector(".account-derived__value");
    expect(derived?.textContent).toMatch(/^0x[0-9a-f]{40}$/i);

    fireEvent.click(screen.getByRole("button", { name: "Register Account" }));

    expect(document.querySelector(".account-flow-stage--registering")).toBeTruthy();
    expect(screen.getByText("Registering AA account shell...")).toBeTruthy();

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith(
        "register",
        "neo-aa-001",
        VERIFIER_HASH,
        "112233",
        HOOK_HASH,
        BACKUP_OWNER,
        "604800",
      );
    });
  });

  it("previews inspect and wallet connect as AA account workflow actions", async () => {
    let finishInspect: (() => void) | undefined;
    const dispatch = vi.fn((name: string) => {
      if (name === "inspect") {
        return new Promise<void>((resolve) => {
          finishInspect = resolve;
        });
      }
      return Promise.resolve();
    });

    const { container } = render(
      <PlayArea
        t={t}
        state={baseState()}
        dispatch={dispatch}
        launchContext={launch(
          "https://neomini.app/miniapps/aa-account-lab?accountIdInput=neo-aa-001",
        )}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Inspect Account" }));
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("inspect", "neo-aa-001");
      expect(container.querySelector(".account-flow-stage--inspecting")).toBeTruthy();
      expect(screen.getByText("Reading AA Core account state...")).toBeTruthy();
    });
    finishInspect?.();

    fireEvent.click(screen.getByRole("button", { name: "Connect Wallet" }));
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("connect");
      expect(container.querySelector(".account-flow-stage--connecting")).toBeTruthy();
      expect(screen.getByText("Connecting wallet identity...")).toBeTruthy();
    });
  });

  it("keeps registration disabled until required launch fields are present", () => {
    render(
      <PlayArea
        t={t}
        state={baseState()}
        dispatch={vi.fn()}
        launchContext={launch(
          `https://neomini.app/miniapps/aa-account-lab?accountIdInput=neo-aa-001&verifierHash=${VERIFIER_HASH}`,
        )}
      />,
    );

    expect(screen.getByText(/Complete account id/i)).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Register Account" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("warns before a mainnet write but stays quiet on testnet", () => {
    const { rerender } = render(
      <PlayArea
        t={t}
        state={baseState({ networkDisplay: "mainnet" })}
        dispatch={vi.fn()}
        launchContext={launch(
          "https://neomini.app/miniapps/aa-account-lab?network=mainnet",
        )}
      />,
    );

    expect(screen.getByText(/You are on mainnet/i)).toBeTruthy();

    rerender(
      <PlayArea
        t={t}
        state={baseState({ networkDisplay: "testnet" })}
        dispatch={vi.fn()}
        launchContext={launch(
          "https://neomini.app/miniapps/aa-account-lab?network=testnet",
        )}
      />,
    );

    expect(screen.queryByText(/You are on mainnet/i)).toBeNull();
  });

  it("warns that a re-register will revert once an inspected account has a verifier", () => {
    render(
      <PlayArea
        t={t}
        state={baseState({
          networkDisplay: "testnet",
          hasInspected: true,
          currentVerifier: VERIFIER_HASH,
        })}
        dispatch={vi.fn()}
        launchContext={launch(
          "https://neomini.app/miniapps/aa-account-lab?network=testnet",
        )}
      />,
    );

    expect(
      screen.getByText(/This account already has a verifier registered/i),
    ).toBeTruthy();
  });

  it("keeps AA account shell motion and reduced-motion fallback covered", () => {
    const styles = readFileSync(
      resolve(process.cwd(), "../aa-account-lab/src/PlayArea.scss"),
      "utf8",
    );

    expect(styles).toContain("@keyframes aa-account-packet-route");
    expect(styles).toContain("@keyframes aa-account-route-scan");
    expect(styles).toContain("@keyframes aa-account-shell-ready");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(
      /\.account-flow-stage--registering \.account-flow-stage__packet[\s\S]*animation:\s*aa-account-packet-route/,
    );
    expect(styles).toMatch(
      /\.account-flow-stage--inspecting \.account-flow-stage__route::after[\s\S]*animation:\s*aa-account-route-scan/,
    );
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.account-flow-stage__packet[\s\S]*animation:\s*none/,
    );
  });
});
