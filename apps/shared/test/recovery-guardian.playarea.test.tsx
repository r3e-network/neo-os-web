import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../recovery-guardian/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string) {
  const messages: Record<string, string> = {
    title: "Recovery Guardian",
    accountAddress: "Account Address",
    accountAddressHint: "Enter an account ID.",
    accountAddressPlaceholder: "0x... or N...",
    accountId: "Account ID",
    awaitingQuery: "Awaiting query",
    backupOwner: "Backup Owner",
    checkedAt: "Checked At",
    copyRecoveryCredential: "Copy Recovery Credential Link",
    copyRecoveryLink: "Copy Recovery Link",
    currentVerifier: "Verifier",
    guardianCommandTitle: "Guardian Preflight",
    guardianCommandStageEyebrow: "Account scan",
    guardianCommandStageLabel: "Guardian account scan route",
    guardianDraftLabel: "Draft Account",
    guardianFlowCredential: "Share credential",
    guardianFlowCredentialDesc: "Share recovery credentials.",
    guardianFlowLabel: "Recovery workflow",
    guardianFlowPrepare: "Prepare recovery",
    guardianFlowPrepareDesc: "Prepare before sending.",
    guardianFlowRead: "Read state",
    guardianFlowReadDesc: "Read recovery state.",
    guardianHeroCopy: "Read state and prepare recovery links.",
    guardianHeroTitle: "Social recovery workspace",
    guardianMetricAccount: "Account",
    guardianMetricExpiry: "Expiry",
    guardianMetricOwner: "New Owner",
    guardianMetricsLabel: "Summary",
    guardianPrepareTitle: "Prepare Recovery",
    guardianPassDraft: "Complete fields",
    guardianPassExpiry: "Expiry",
    guardianPassExpiryInvalid: "Invalid",
    guardianPassExpiryMissing: "Invalid",
    guardianPassExpiryReady: "Ready",
    guardianPassLocked: "Read state first",
    guardianPassOwner: "Owner",
    guardianPassOwnerMissing: "Missing",
    guardianPassOwnerReady: "Ready",
    guardianPassReady: "Links ready",
    guardianPassTitle: "Recovery pass",
    guardianPassVerifier: "Verifier",
    guardianPassVerifierAuto: "Auto",
    guardianPassVerifierCustom: "Custom",
    guardianPassVerifierInvalid: "Invalid",
    guardianRiskCopy: "Links stay disabled until valid.",
    guardianRiskTitle: "Guardrails",
    guardianRouteAccount: "Account",
    guardianRouteAccountNeeded: "Needed",
    guardianRouteAccountReady: "Valid",
    guardianRouteHandoff: "Handoff",
    guardianRouteLinksLocked: "Locked",
    guardianRouteLinksReady: "Ready",
    guardianRouteState: "State",
    guardianRouteStateReading: "Reading",
    guardianRouteStateReady: "Loaded",
    guardianRouteStateWaiting: "Waiting",
    guardianStageArmed: "Ready to read guardian state",
    guardianStageArmedHint: "The account locator is valid.",
    guardianStageIdle: "Choose an account to inspect",
    guardianStageIdleHint: "Paste a Neo address or Hash160.",
    guardianStageQuerying: "Reading guardian boundary",
    guardianStageQueryingHint: "Fetching recovery boundary.",
    guardianStageReady: "State loaded, prepare handoff",
    guardianStageReadyHint: "Review the account state.",
    guardianStateLabel: "Runtime",
    guardianStateTitle: "Recovery state",
    latestState: "Latest State",
    newOwner: "New Owner",
    newOwnerHint: "Connected wallet owner.",
    newOwnerPlaceholder: "N... or 0x...",
    noStateHint: "Run query state.",
    noStateYet: "No recovery state loaded yet.",
    notAvailable: "N/A",
    digestPlaceholder: "—",
    escapeStatusLabel: "Recovery Escape",
    escapeTriggeredAtLabel: "Escape Triggered",
    networkDefaultVerifierLabel: "Network Default Verifier",
    verifierNotConfigured: "Not configured",
    verifierOverrideMatch: "Override matches bound verifier",
    verifierOverrideMismatch: "Override differs from bound verifier",
    openAaWorkspace: "Open AA Workspace",
    openIdentityWorkspace: "Open Identity Workspace",
    openRecoveryCredential: "Open Recovery Credential",
    openRecoveryDocs: "Open Recovery Docs",
    openRecoveryPreview: "Open Recovery Preview",
    queryBlocked: "Enter a valid account.",
    queryState: "Query State",
    queryingState: "Querying state...",
    recoveryExpiry: "Expiry minutes",
    recoveryExpiryHint: "5 to 1440.",
    recoveryExpiryPlaceholder: "30",
    recoveryLinkBlocked: "Complete valid fields.",
    recoveryTemplateId: "Template ID",
    recoveryTemplateIdHint: "Optional template.",
    recoveryTemplateIdPlaceholder: "template",
    shareRecoveryCredential: "Share Recovery Credential Link",
    shareRecoveryLink: "Share Recovery Link",
    threshold: "Threshold",
    timelockLabel: "Timelock",
    verifierHash: "Verifier Hash Override",
    verifierHashHint: "Optional verifier.",
    verifierHashPlaceholder: "0x...",
  };
  return messages[key] ?? key;
}

const VALID_ACCOUNT = "0x1111111111111111111111111111111111111111";
const VALID_OWNER = "0x2222222222222222222222222222222222222222";

function state(
  overrides: Partial<Record<string, unknown>> = {},
): ObservableState {
  const values: Record<string, unknown> = {
    hasPayload: false,
    isLoading: false,
    isQuerying: false,
    renderedPayload: "—",
    accountId: "—",
    verifierHash: "—",
    escapeStatus: "—",
    timelock: "—",
    backupOwnerState: "—",
    checkedAt: "—",
    networkDefaultVerifier: "—",
    escapeTriggeredAt: "—",
    previewUrl: "",
    credentialUrl: "",
    accountAddress: "",
    verifierHashOverride: "",
    recoveryNewOwner: "",
    recoveryExpiryMinutes: "30",
    recoveryTemplateId: "",
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      createObservable(value),
    ]),
  );
}

const LINK_BUTTONS = [
  "Open Recovery Preview",
  "Copy Recovery Link",
  "Share Recovery Link",
  "Open Recovery Credential",
  "Copy Recovery Credential Link",
  "Share Recovery Credential Link",
];

describe("Recovery Guardian PlayArea", () => {
  it("keeps all recovery link buttons disabled until account, owner, expiry, and optional verifier are valid", () => {
    const { container } = render(
      <PlayArea t={t} state={state()} dispatch={vi.fn()} />,
    );

    expect(
      container.querySelector(".guardian-command-stage--idle"),
    ).toBeTruthy();
    expect(
      container.querySelector(".guardian-recovery-pass--locked"),
    ).toBeTruthy();
    expect(screen.getByLabelText("Guardian account scan route")).toBeTruthy();
    expect(screen.getByLabelText("Recovery pass")).toBeTruthy();

    for (const name of LINK_BUTTONS) {
      expect(
        (screen.getByRole("button", { name }) as HTMLButtonElement).disabled,
      ).toBe(true);
    }

    // An invalid optional verifier override must still block the links even
    // when the required fields are valid.
    cleanup();
    render(
      <PlayArea
        t={t}
        state={state({
          accountAddress: VALID_ACCOUNT,
          recoveryNewOwner: VALID_OWNER,
          recoveryExpiryMinutes: "30",
          verifierHashOverride: "not-a-hash",
        })}
        dispatch={vi.fn()}
      />,
    );
    for (const name of LINK_BUTTONS) {
      expect(
        (screen.getByRole("button", { name }) as HTMLButtonElement).disabled,
      ).toBe(true);
    }
  });

  it("enables link buttons and dispatches the matching link action once fields are valid", () => {
    const dispatch = vi.fn();
    render(
      <PlayArea
        t={t}
        state={state({
          accountAddress: VALID_ACCOUNT,
          recoveryNewOwner: VALID_OWNER,
          recoveryExpiryMinutes: "30",
        })}
        dispatch={dispatch}
      />,
    );

    const openPreview = screen.getByRole("button", {
      name: "Open Recovery Preview",
    });
    expect((openPreview as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(openPreview);
    expect(dispatch).toHaveBeenCalledWith("openRecoveryPreviewLink");

    fireEvent.click(
      screen.getByRole("button", { name: "Copy Recovery Credential Link" }),
    );
    expect(dispatch).toHaveBeenCalledWith("copyRecoveryCredentialLink");
  });

  it("blocks Query State until the account locator is valid, then dispatches queryGuardianState", () => {
    const dispatch = vi.fn();
    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    expect(
      (screen.getByRole("button", { name: "Query State" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    cleanup();
    render(
      <PlayArea
        t={t}
        state={state({ accountAddress: VALID_ACCOUNT })}
        dispatch={dispatch}
      />,
    );

    const queryButton = screen.getByRole("button", { name: "Query State" });
    expect((queryButton as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(queryButton);
    expect(dispatch).toHaveBeenCalledWith("queryGuardianState");
  });

  it("keeps account scan visibly active while querying instead of hiding the button text", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ accountAddress: VALID_ACCOUNT, isQuerying: true })}
        dispatch={vi.fn()}
      />,
    );

    expect(
      container.querySelector(".guardian-command-stage--querying"),
    ).toBeTruthy();
    expect(container.querySelector(".guardian-query-spinner")).toBeTruthy();
    expect(
      container.querySelector(".guardian-query-button--querying"),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Querying state..." }),
    ).toBeTruthy();
    expect(screen.getByText("Reading guardian boundary")).toBeTruthy();
    expect(screen.getByText("Reading")).toBeTruthy();
  });

  it("surfaces a recovery pass as ready once the required handoff fields are valid", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          hasPayload: true,
          accountAddress: VALID_ACCOUNT,
          recoveryNewOwner: VALID_OWNER,
          recoveryExpiryMinutes: "30",
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(
      container.querySelector(".guardian-command-stage--ready"),
    ).toBeTruthy();
    expect(
      container.querySelector(".guardian-recovery-pass--ready"),
    ).toBeTruthy();
    expect(screen.getByText("Links ready")).toBeTruthy();
    expect(screen.getAllByText("Ready").length).toBeGreaterThanOrEqual(3);
  });

  it("renders the recovery state grid only after a payload is loaded", () => {
    render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    expect(screen.getByText("No recovery state loaded yet.")).toBeTruthy();

    cleanup();
    render(
      <PlayArea
        t={t}
        state={state({
          hasPayload: true,
          accountId: "aa:test",
          verifierHash: VALID_ACCOUNT,
          backupOwnerState: VALID_OWNER,
          escapeStatus: "Inactive",
          timelock: "3600s",
          checkedAt: "2026-06-04T00:00:00.000Z",
          renderedPayload: '{\n  "timelock": 3600\n}',
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(screen.getByText("aa:test")).toBeTruthy();
    // Escape (recovery) status and the recovery timelock are populated from the
    // AA core reads instead of staying "—".
    expect(screen.getByText("Inactive")).toBeTruthy();
    expect(screen.getByText("3600s")).toBeTruthy();
    // The grid surfaces the freshly-read chain values (backup owner + the
    // checked-at timestamp) alongside verifier/escape status/timelock.
    expect(screen.getByText(VALID_OWNER)).toBeTruthy();
    expect(screen.getByText("2026-06-04T00:00:00.000Z")).toBeTruthy();
    expect(screen.getByText(/"timelock": 3600/)).toBeTruthy();
  });

  it("badges the verifier override against the bound verifier once state is loaded", () => {
    // Override equals the bound verifier → match badge.
    render(
      <PlayArea
        t={t}
        state={state({
          hasPayload: true,
          verifierHash: VALID_ACCOUNT,
          verifierHashOverride: VALID_ACCOUNT,
        })}
        dispatch={vi.fn()}
      />,
    );
    expect(screen.getByText("Override matches bound verifier")).toBeTruthy();

    // A different valid override → mismatch badge.
    cleanup();
    render(
      <PlayArea
        t={t}
        state={state({
          hasPayload: true,
          verifierHash: VALID_ACCOUNT,
          verifierHashOverride: VALID_OWNER,
        })}
        dispatch={vi.fn()}
      />,
    );
    expect(
      screen.getByText("Override differs from bound verifier"),
    ).toBeTruthy();
  });

  it("keeps the guardian route animated and reduced-motion safe", () => {
    const styles = readFileSync(
      resolve(process.cwd(), "../recovery-guardian/src/PlayArea.scss"),
      "utf8",
    );

    expect(styles).toContain("@keyframes guardian-stage-scan");
    expect(styles).toContain("@keyframes guardian-packet-route");
    expect(styles).toContain("@keyframes guardian-query-spin");
    expect(styles).toContain("@keyframes guardian-pass-scan");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.guardian-query-spinner[\s\S]*animation:\s*none/,
    );
  });
});
