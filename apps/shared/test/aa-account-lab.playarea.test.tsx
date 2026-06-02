import React from "react";
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
const BACKUP_OWNER = "NWMjW2tnPKSuSdHme5uYk86vFm8hyoHeJ3";

function t(key: string) {
  const messages: Record<string, string> = {
    accountHeroEyebrow: "Account Abstraction",
    accountHeroTitle: "Account control center",
    accountHeroCopy: "Inspect and register AA shells.",
    accountMetricsLabel: "AA account environment summary",
    network: "Network",
    defaultVerifier: "Default Verifier",
    accountMetricAccount: "Account Shell",
    accountInspectorTitle: "Account Readiness",
    accountId: "AccountId Hash",
    accountIdHint: "Use a hash, public key, or deterministic seed text.",
    accountIdPlaceholder: "20-byte hash, pubkey, or seed text",
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

    const accountInputs = screen.getAllByLabelText(
      "AccountId Hash",
    ) as HTMLInputElement[];
    expect(accountInputs[0]?.value).toBe("neo-aa-001");
    expect(accountInputs[1]?.value).toBe("neo-aa-001");
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

    fireEvent.click(screen.getByRole("button", { name: "Register Account" }));

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
});
