import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../recovery-guardian/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string) {
  const messages: Record<string, string> = {
    accountAddress: "AA account",
    accountAddressHint: "Enter an account ID.",
    accountAddressPlaceholder: "0x... or N...",
    accountId: "Account ID",
    awaitingQuery: "Awaiting query",
    cancelRecovery: "Cancel Recovery",
    copyRecoveryCredential: "Copy Credential",
    copyRecoveryLink: "Copy Link",
    currentVerifier: "Verifier",
    encryptedParams: "Encrypted Params",
    encryptedParamsHint: "Encrypted Morpheus subject params.",
    encryptedParamsPlaceholder: "{}",
    finalizeRecovery: "Finalize Recovery",
    guardianCommandTitle: "Guardian Preflight",
    guardianDraftLabel: "Draft Account",
    guardianFlowCredential: "Share credential",
    guardianFlowCredentialDesc: "Share recovery credentials.",
    guardianFlowLabel: "Recovery workflow",
    guardianFlowPrepare: "Prepare recovery",
    guardianFlowPrepareDesc: "Prepare before sending.",
    guardianFlowRead: "Read state",
    guardianFlowReadDesc: "Read recovery state.",
    guardianHeroCopy: "Read state and submit recovery actions.",
    guardianHeroTitle: "Social recovery workspace",
    guardianMetricAccount: "Account",
    guardianMetricExpiry: "Expiry",
    guardianMetricOwner: "New Owner",
    guardianMetricsLabel: "Summary",
    guardianPrepareTitle: "Prepare Recovery",
    guardianRiskCopy: "Actions stay disabled until valid.",
    guardianRiskTitle: "Guardrails",
    guardianStateLabel: "Runtime",
    guardianStateTitle: "Recovery state",
    latestState: "Latest State",
    newOwner: "New Owner",
    newOwnerHint: "Connected wallet owner.",
    newOwnerPlaceholder: "N... or 0x...",
    noStateHint: "Run query state.",
    noStateYet: "No recovery state loaded yet.",
    notAvailable: "N/A",
    openAaWorkspace: "AA Workspace",
    openIdentityWorkspace: "Identity Workspace",
    openRecoveryCredential: "Open Credential",
    openRecoveryDocs: "Docs",
    openRecoveryPreview: "Open Preview",
    pendingRecovery: "Pending Recovery",
    queryBlocked: "Enter a valid account.",
    queryState: "Query State",
    recoveryExpiry: "Expiry minutes",
    recoveryExpiryHint: "5 to 1440.",
    recoveryExpiryPlaceholder: "30",
    recoveryLinkBlocked: "Complete valid fields.",
    recoveryNonce: "Recovery Nonce",
    recoveryProvider: "Recovery Provider",
    recoveryProviderHint: "Provider label.",
    recoveryProviderPlaceholder: "web3auth",
    recoveryTemplateId: "Template ID",
    recoveryTemplateIdHint: "Optional template.",
    recoveryTemplateIdPlaceholder: "template",
    requestRecoveryTicket: "Request Recovery Ticket",
    shareRecoveryCredential: "Share Credential",
    shareRecoveryLink: "Share Link",
    targetVerifier: "Target Verifier",
    threshold: "Threshold",
    timelockLabel: "Timelock",
    verifierHash: "Verifier Override",
    verifierHashHint: "Optional verifier.",
    verifierHashPlaceholder: "0x...",
  };
  return messages[key] ?? key;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    hasPayload: false,
    isLoading: false,
    isQuerying: false,
    renderedPayload: "N/A",
    accountId: "N/A",
    verifierHash: "N/A",
    threshold: "N/A",
    timelock: "N/A",
    recoveryNonce: "N/A",
    pendingRecovery: "N/A",
    targetVerifierHash: "0x198b3a9cec9bccc2110d19bd929b10374a9d034d",
    previewUrl: "",
    credentialUrl: "",
    accountAddress: "",
    verifierHashOverride: "",
    recoveryNewOwner: "",
    recoveryExpiryMinutes: "30",
    recoveryTemplateId: "",
    recoveryProvider: "web3auth",
    encryptedParams: "{}",
    actionStatus: "",
    activeOperation: "",
    lastTx: null,
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      createObservable(value),
    ]),
  );
}

describe("Recovery Guardian PlayArea", () => {
  it("enables the on-chain recovery request only after valid recovery fields", () => {
    const dispatch = vi.fn();
    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    expect(
      (screen.getByRole("button", {
        name: "Request Recovery Ticket",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);

    cleanup();
    render(
      <PlayArea
        t={t}
        state={state({
          accountAddress: "0x1111111111111111111111111111111111111111",
          recoveryNewOwner: "0x2222222222222222222222222222222222222222",
        })}
        dispatch={dispatch}
      />,
    );

    const requestButton = screen.getByRole("button", {
      name: "Request Recovery Ticket",
    });
    expect((requestButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(requestButton);
    expect(dispatch).toHaveBeenCalledWith("requestRecoveryTicket");
  });

  it("renders submitted transaction ids without hiding recovery controls", () => {
    render(
      <PlayArea
        t={t}
        state={state({
          accountAddress: "0x1111111111111111111111111111111111111111",
          recoveryNewOwner: "0x2222222222222222222222222222222222222222",
          actionStatus: "Recovery ticket request submitted",
          lastTx: {
            operation: "requestRecoveryTicket",
            txid: "0xabcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789",
            success: true,
          },
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(screen.getByRole("status").textContent).toContain(
      "Recovery ticket request submitted",
    );
    expect(screen.getByText(/0xabcdef0123456789/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Finalize Recovery" })).toBeTruthy();
  });
});
