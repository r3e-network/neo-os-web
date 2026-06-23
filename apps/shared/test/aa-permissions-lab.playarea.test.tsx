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
import PlayArea from "../../aa-permissions-lab/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

const ACCOUNT_ID_HASH = "0x1111111111111111111111111111111111111111";
const VERIFIER_HASH = "0x5be915aea3ce85e4752d522632f0a9520e377aaf";
const HOOK_HASH = "0x0000000000000000000000000000000000000000";

function t(key: string) {
  const messages: Record<string, string> = {
    notAvailable: "Not available",
    accountId: "AccountId Hash",
    accountIdHint: "Required before reading or writing permission bindings.",
    accountIdHashPlaceholder: "20-byte hash",
    inspect: "Refresh State",
    connectWallet: "Connect Wallet",
    inspectBlocked: "Enter an AccountId hash before reading live state.",
    currentVerifier: "Current Verifier",
    currentHook: "Current Hook",
    currentBackupOwner: "Current Backup Owner",
    configured: "configured",
    verifier: "Verifier Hash",
    verifierParams: "Verifier Params Hex",
    verifierParamsHint: "Optional hex.",
    verifierHashPlaceholder: "0x...",
    verifierParamsPlaceholder: "hex payload",
    hook: "Hook Hash",
    hookHashPlaceholder: "0x...",
    updateVerifier: "Update Verifier",
    updateHook: "Update Hook",
    permissionsHeroTitle: "Permission controls for AA accounts",
    permissionsHeroCopy: "Inspect and rotate AA verifier and hook bindings.",
    permissionsHeroChip: "Inspect first. Propose second. Confirm later.",
    permissionsHeroImageAlt: "AA permission security console",
    permissionsHeroVisualLabel: "Permission boundary",
    permissionsMetricsLabel: "AA permission state",
    permissionsMetricVerifier: "Verifier",
    permissionsMetricHook: "Hook",
    permissionsMetricAccount: "Account",
    permissionsCommandTitle: "Account inspector",
    permissionsAccountPreview: "Account boundary preview",
    accountPreviewEmpty: "Paste an AccountId hash to inspect",
    connectedWallet: "Connected Wallet",
    permissionsFlowLabel: "Permission update workflow",
    permissionsFlowInspect: "Inspect account",
    permissionsFlowInspectDesc: "Load live state first.",
    permissionsFlowVerifier: "Rotate verifier",
    permissionsFlowVerifierDesc: "Update authentication logic.",
    permissionsFlowHook: "Update hook",
    permissionsFlowHookDesc: "Change policy hook.",
    writeStagePropose: "Propose rotation",
    writeStageConfirm: "Confirm or cancel",
    permissionsRouteStageLabel: "Permission route",
    permissionsRouteStageTitle:
      "Route the account through verifier, timelock, and hook",
    permissionsRouteStageCopy:
      "Treat every write as a routed permission change.",
    permissionsRouteStatusLabel: "Route status",
    permissionsRouteStatusEmpty: "Waiting for an account hash",
    permissionsRouteStatusArmed: "Account selected — inspect live state",
    permissionsRouteStatusInspect: "Reading verifier, hook, and owner",
    permissionsRouteStatusVerifier: "Verifier proposal is in flight",
    permissionsRouteStatusHook: "Hook proposal is in flight",
    permissionsRouteStatusPendingVerifier:
      "Verifier proposal is waiting on the timelock",
    permissionsRouteStatusPendingHook:
      "Hook proposal is waiting on the timelock",
    permissionsRouteStatusReady: "Live permission route loaded",
    permissionsRouteAccount: "Account",
    permissionsRouteVerifier: "Verifier",
    permissionsRouteTimelock: "Timelock",
    permissionsRouteHook: "Hook",
    permissionsRoutePending: "Pending update",
    permissionsRouteGuard: "Safety guard",
    permissionsStateLabel: "Live state",
    permissionsStateTitle: "Current permissions",
    permissionsStateEmpty: "Inspect an account to load its permissions",
    permissionsRiskTitle: "Writes change permission boundaries",
    permissionsRiskCopy: "Confirm target contracts before signing.",
    verifierUpdateBlocked:
      "Enter an AccountId hash and verifier contract hash before submitting.",
    hookUpdateBlocked:
      "Enter an AccountId hash and hook contract hash before submitting.",
    notInspected: "not inspected",
    pendingVerifierTitle: "Pending verifier rotation",
    pendingHookTitle: "Pending hook rotation",
    pendingUnlockReady: "Timelock elapsed — confirm to finalize.",
    confirmUpdate: "Confirm",
    cancelUpdate: "Cancel",
    notBackupOwner:
      "Connect the backup-owner wallet to rotate this account's bindings.",
  };
  return messages[key] ?? key;
}

function launch(url: string) {
  return parseMiniAppLaunchContext(url, "miniapp-aa-permissions-lab");
}

function baseState(
  overrides: Partial<Record<string, unknown>> = {},
): ObservableState {
  const values: Record<string, unknown> = {
    isRefreshing: false,
    isVerifierBusy: false,
    isHookBusy: false,
    currentVerifier: "Not available",
    currentHook: "Not available",
    currentBackupOwner: "Not available",
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      createObservable(value),
    ]),
  );
}

describe("AA Permissions Lab PlayArea launch flow", () => {
  it("prefills permission forms from host launch params and dispatches real fields", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);

    render(
      <PlayArea
        t={t}
        state={baseState()}
        dispatch={dispatch}
        launchContext={launch(
          `https://neomini.app/miniapps/aa-permissions-lab?network=testnet&accountIdHash=${ACCOUNT_ID_HASH}&verifierHash=${VERIFIER_HASH}&verifierParamsHex=112233&hookHash=${HOOK_HASH}`,
        )}
      />,
    );

    expect(
      (screen.getByLabelText("AccountId Hash") as HTMLInputElement).value,
    ).toBe(ACCOUNT_ID_HASH);
    expect(
      (screen.getByLabelText("Verifier Hash") as HTMLInputElement).value,
    ).toBe(VERIFIER_HASH);
    expect(
      (screen.getByLabelText("Verifier Params Hex") as HTMLInputElement).value,
    ).toBe("112233");
    expect((screen.getByLabelText("Hook Hash") as HTMLInputElement).value).toBe(
      HOOK_HASH,
    );
    expect(
      screen.getByRole("region", {
        name: "Route the account through verifier, timelock, and hook",
      }),
    ).toBeTruthy();
    expect(screen.getByText("Account selected — inspect live state")).toBeTruthy();
    expect(screen.getByText("Safety guard")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Refresh State" }));
    fireEvent.click(screen.getByRole("button", { name: "Update Verifier" }));
    fireEvent.click(screen.getByRole("button", { name: "Update Hook" }));

    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("refresh", ACCOUNT_ID_HASH);
      expect(dispatch).toHaveBeenCalledWith(
        "submitVerifier",
        ACCOUNT_ID_HASH,
        VERIFIER_HASH,
        "112233",
      );
      expect(dispatch).toHaveBeenCalledWith(
        "submitHook",
        ACCOUNT_ID_HASH,
        HOOK_HASH,
      );
    });
  });

  it("keeps write actions disabled until the required account and target hashes are present", () => {
    render(
      <PlayArea
        t={t}
        state={baseState()}
        dispatch={vi.fn()}
        launchContext={launch(
          `https://neomini.app/miniapps/aa-permissions-lab?accountIdHash=${ACCOUNT_ID_HASH}`,
        )}
      />,
    );

    expect(screen.getByText(/verifier contract hash/i)).toBeTruthy();
    expect(screen.getByText(/hook contract hash/i)).toBeTruthy();
    expect(
      (
        screen.getByRole("button", {
          name: "Update Verifier",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Update Hook" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("shows 'not inspected' until a read completes, then 'configured'", () => {
    const { rerender } = render(
      <PlayArea
        t={t}
        state={baseState()}
        dispatch={vi.fn()}
        launchContext={launch(
          `https://neomini.app/miniapps/aa-permissions-lab?accountIdHash=${ACCOUNT_ID_HASH}`,
        )}
      />,
    );
    // Typing an account id alone must NOT assert configured state.
    expect(screen.getAllByText("not inspected").length).toBeGreaterThan(0);
    expect(screen.queryByText("configured")).toBeNull();

    rerender(
      <PlayArea
        t={t}
        state={baseState({ hasInspected: true })}
        dispatch={vi.fn()}
        launchContext={launch(
          `https://neomini.app/miniapps/aa-permissions-lab?accountIdHash=${ACCOUNT_ID_HASH}`,
        )}
      />,
    );
    expect(screen.getAllByText("configured").length).toBeGreaterThan(0);
    expect(screen.getByText("Live permission route loaded")).toBeTruthy();
  });

  it("surfaces a confirm/cancel banner for a pending verifier rotation", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(
      <PlayArea
        t={t}
        state={baseState({ hasInspected: true, hasPendingVerifier: true })}
        dispatch={dispatch}
        launchContext={launch(
          `https://neomini.app/miniapps/aa-permissions-lab?accountIdHash=${ACCOUNT_ID_HASH}`,
        )}
      />,
    );

    expect(screen.getByText("Pending verifier rotation")).toBeTruthy();
    expect(
      screen.getByText("Verifier proposal is waiting on the timelock"),
    ).toBeTruthy();
    expect(screen.getByText("Pending update")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirm" }));
    await waitFor(() => {
      expect(dispatch).toHaveBeenCalledWith("confirmVerifier", ACCOUNT_ID_HASH);
    });
  });

  it("refreshes visible fields when launch params change in the same mount", () => {
    const nextAccount = "0x2222222222222222222222222222222222222222";
    const nextVerifier = "0x3333333333333333333333333333333333333333";

    const { rerender } = render(
      <PlayArea
        t={t}
        state={baseState()}
        dispatch={vi.fn()}
        launchContext={launch(
          `https://neomini.app/miniapps/aa-permissions-lab?accountIdHash=${ACCOUNT_ID_HASH}&verifierHash=${VERIFIER_HASH}`,
        )}
      />,
    );

    rerender(
      <PlayArea
        t={t}
        state={baseState()}
        dispatch={vi.fn()}
        launchContext={launch(
          `https://neomini.app/miniapps/aa-permissions-lab?accountIdHash=${nextAccount}&verifierHash=${nextVerifier}`,
        )}
      />,
    );

    expect(
      (screen.getByLabelText("AccountId Hash") as HTMLInputElement).value,
    ).toBe(nextAccount);
    expect(
      (screen.getByLabelText("Verifier Hash") as HTMLInputElement).value,
    ).toBe(nextVerifier);
  });

  it("marks the permission route stage as busy while a verifier proposal is in flight", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={baseState({ isVerifierBusy: true })}
        dispatch={vi.fn()}
        launchContext={launch(
          `https://neomini.app/miniapps/aa-permissions-lab?accountIdHash=${ACCOUNT_ID_HASH}&verifierHash=${VERIFIER_HASH}`,
        )}
      />,
    );

    const routeStage = screen.getByRole("region", {
      name: "Route the account through verifier, timelock, and hook",
    });
    expect(routeStage.getAttribute("aria-busy")).toBe("true");
    expect(container.querySelector(".permissions-route-stage--verifier")).toBeTruthy();
    expect(screen.getByText("Verifier proposal is in flight")).toBeTruthy();
  });

  it("keeps the permission route stage animated and reduced-motion safe", () => {
    const styles = readFileSync(
      resolve(process.cwd(), "../aa-permissions-lab/src/PlayArea.scss"),
      "utf8",
    );

    expect(styles).toContain("@keyframes permissions-route-flow");
    expect(styles).toContain("@keyframes permissions-scan-frame");
    expect(styles).toContain("@keyframes permissions-node-active");
    expect(styles).toContain("@keyframes permissions-node-hold");
    expect(styles).toContain(".permissions-route-stage--verifier");
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.permissions-route-stage__scan/,
    );
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.permissions-route-map__lane::after[\s\S]*animation:\s*none/,
    );
  });
});
