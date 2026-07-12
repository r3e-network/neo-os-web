import React from "react";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../recovery-guardian/src/PlayArea";
import type { RecoveryProfile } from "../../recovery-guardian/src/recovery-guardian";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());
function t(key: string) { return key; }
function state(values: Record<string, unknown>): ObservableState {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, createObservable(value)])) as ObservableState;
}

const PROFILE_ID = `0x${"11".repeat(20)}`;
const OWNER = `0x${"22".repeat(20)}`;
const ACCOUNT = `0x${"33".repeat(20)}`;
const profile: RecoveryProfile = {
  sourceNetwork: "testnet",
  configured: true,
  aaBindingVerified: true,
  aaVerifierHash: `0x${"aa".repeat(20)}`,
  aaBackupOwner: OWNER,
  profileId: { input: PROFILE_ID, hex: PROFILE_ID, base64: "", byteLength: 20, isAAAccountId: true },
  owner: OWNER,
  aaContract: `0x${"44".repeat(20)}`,
  accountAddress: ACCOUNT,
  morpheusOracle: `0x${"55".repeat(20)}`,
  networkLabel: "neo_n3",
  accountIdText: "family-wallet",
  threshold: 2,
  timelockMs: 86_400_000,
  recoveryNonce: "4",
  morpheusVerifier: `02${"66".repeat(32)}`,
  masterNullifiers: [`0x${"77".repeat(32)}`, `0x${"88".repeat(32)}`, `0x${"99".repeat(32)}`],
  pending: { active: false, newOwner: "", recoveryNonce: "-1", approvedCount: 0, initiatedAt: 0, executableAt: 0 },
  checkedAt: "2026-07-11T00:00:00.000Z",
};

function baseState(overrides: Record<string, unknown> = {}) {
  return state({
    profileInput: PROFILE_ID,
    recoveryExpiryMinutes: "30",
    journeyState: "idle",
    setupWriteAvailable: false,
    storageHealthy: true,
    ...overrides,
  });
}

describe("recovery-guardian designed journey", () => {
  it("renders one profile locator, real command-center art, and a four-step journey", () => {
    const { container } = render(<PlayArea t={t} state={baseState()} dispatch={vi.fn()} />);
    expect(container.querySelector(".guardian-app")).toBeTruthy();
    expect(container.querySelector(".guardian-console")).toBeTruthy();
    expect(container.querySelectorAll(".guardian-app input")).toHaveLength(1);
    expect(container.querySelectorAll(".guardian-journey > span")).toHaveLength(4);
    expect(container.querySelector(".guardian-command-art img")?.getAttribute("src")).toContain("recovery-command-center.webp");
    expect(container.querySelector(".guardian-command-art img")?.getAttribute("alt")).toBe("guardianHeroVisualAlt");
  });

  it("uses the real protected state as the primary recovery handoff", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayArea t={t} state={baseState({ profile, journeyState: "protected", threshold: 2, guardianCount: 3 })} dispatch={dispatch} />);
    fireEvent.click(screen.getByRole("button", { name: /startRecovery/ }));
    expect(dispatch).toHaveBeenCalledWith("continueRecovery");
    expect(screen.getAllByText("guardianPolicy", { exact: false }).length).toBeGreaterThan(0);
  });

  it("keeps the prepared setup importer contextual when a future verifier enables it", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const unconfigured = { ...profile, configured: false, owner: "", threshold: 0, timelockMs: 0, masterNullifiers: [] };
    const { container } = render(
      <PlayArea
        t={t}
        state={baseState({
          profile: unconfigured,
          journeyState: "unconfigured",
          setupPackageText: "{}",
          setupWriteAvailable: true,
        })}
        dispatch={dispatch}
      />,
    );
    expect(container.querySelector(".guardian-setup-card textarea")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /setupGuardians/ }));
    expect(container.querySelector(".guardian-setup-card textarea")).toBeTruthy();
    expect(screen.getByText("publicDataOnly")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /reviewSetupPackage/ }));
    expect(dispatch).toHaveBeenCalledWith("reviewSetupPackage");
  });

  it("keeps first-time activation read-only until the verifier upgrade", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const unconfigured = { ...profile, configured: false, owner: "", threshold: 0, timelockMs: 0, masterNullifiers: [] };
    const { container } = render(
      <PlayArea
        t={t}
        state={baseState({ profile: unconfigured, journeyState: "unconfigured", setupPackageText: "{}" })}
        dispatch={dispatch}
      />,
    );

    expect(screen.getByText("journeySetupUpgradeRequired")).toBeTruthy();
    expect(screen.getByText("setupActivationPaused")).toBeTruthy();
    expect(screen.getByText("setupUpgradePending")).toBeTruthy();
    expect(container.querySelector(".guardian-setup-card")).toBeNull();
    expect(screen.queryByRole("button", { name: /setupGuardians/ })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /refreshStatus/ }));
    expect(dispatch).toHaveBeenCalledWith("loadProfile");
  });

  it("shows progress and routes a threshold-ready profile to finalization", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const pending = {
      ...profile,
      pending: {
        active: true,
        newOwner: ACCOUNT,
        recoveryNonce: "4",
        approvedCount: 2,
        initiatedAt: Date.now() - 90_000,
        executableAt: Date.now() - 1_000,
      },
    };
    const { container } = render(
      <PlayArea
        t={t}
        state={baseState({ profile: pending, journeyState: "ready", approvedCount: 2, threshold: 2, guardianCount: 3 })}
        dispatch={dispatch}
      />,
    );
    expect(container.querySelector(".guardian-progress > span")?.getAttribute("style")).toContain("100%");
    fireEvent.click(screen.getByRole("button", { name: /finalizeRecovery/ }));
    expect(dispatch).toHaveBeenCalledWith("submitFinalize");
  });

  it("tucks ticket expiry and raw contract routing into the details drawer", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={baseState({ profile, journeyState: "protected", threshold: 2, guardianCount: 3, verifierHash: OWNER, aaCoreHash: ACCOUNT })}
        dispatch={dispatch}
      />,
    );
    expect(container.querySelector(".guardian-expiry-presets")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /guardianDetails/ }));
    expect(container.querySelector(".guardian-expiry-presets")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "1h" }));
    expect(dispatch).toHaveBeenCalledWith("setField", "recoveryExpiryMinutes", "60");
  });

  it("prioritizes an active confirmation notice over an older success message", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={baseState({
          profile,
          journeyState: "protected",
          lastSuccess: "old success",
          transactionNotice: "review before signing",
        })}
        dispatch={vi.fn()}
      />,
    );
    expect(container.querySelector(".guardian-feedback strong")?.textContent).toBe("review before signing");
    expect(container.querySelector(".guardian-feedback")?.className).toContain("is-pending");
  });

  it("locks profile and advanced fields while an exact write is pending", () => {
    const pendingWrite = {
      version: 1 as const,
      kind: "finalize" as const,
      txid: `0x${"aa".repeat(32)}`,
      createdAt: Date.now(),
      network: "testnet" as const,
      verifierHash: `0x${"bb".repeat(20)}`,
      profileHex: PROFILE_ID,
      actorHash: ACCOUNT,
      beforeOwner: OWNER,
      beforeNonce: "4",
      expectedNewOwner: ACCOUNT,
    };
    const { container } = render(
      <PlayArea
        t={t}
        state={baseState({ profile, journeyState: "pending-transaction", pendingWrite, storageHealthy: false })}
        dispatch={vi.fn()}
      />,
    );
    expect(container.querySelector<HTMLInputElement>("#guardian-profile-id")?.disabled).toBe(true);
    expect(screen.queryByRole("button", { name: /checkConfirmation/ })).toBeNull();
    expect((screen.getByRole("button", { name: /retryRecoveryStorage/ }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: /guardianDetails/ }));
    expect((screen.getByRole("button", { name: "1h" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("pauses new signatures when durable recovery storage is unavailable", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const pending = {
      ...profile,
      pending: {
        active: true,
        newOwner: ACCOUNT,
        recoveryNonce: "4",
        approvedCount: 2,
        initiatedAt: Date.now() - 90_000,
        executableAt: Date.now() - 1_000,
      },
    };
    render(
      <PlayArea
        t={t}
        state={baseState({
          profile: pending,
          journeyState: "ready",
          approvedCount: 2,
          threshold: 2,
          guardianCount: 3,
          storageHealthy: false,
        })}
        dispatch={dispatch}
      />,
    );
    expect(screen.getByText("recoveryStorageUnavailable")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /finalizeRecovery/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /cancelRecovery/ })).toBeNull();
    const retry = screen.getByRole("button", { name: /retryRecoveryStorage/ });
    expect((retry as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(retry);
    expect(dispatch).toHaveBeenCalledWith("refreshRecoveryStorage");
  });

  it("shows a truthful warning for a legacy no-delay policy", () => {
    const legacyPolicy = { ...profile, timelockMs: 0 };
    const { container } = render(
      <PlayArea
        t={t}
        state={baseState({ profile: legacyPolicy, journeyState: "legacy-policy", threshold: 2, guardianCount: 3 })}
        dispatch={vi.fn()}
      />,
    );
    expect(screen.getByText("journeyLegacyPolicy")).toBeTruthy();
    expect(screen.getByText("policyReviewNeeded")).toBeTruthy();
    expect(container.querySelector('[data-journey="legacy-policy"]')).toBeTruthy();
  });

  it("ships warm, high-contrast, reduced-motion styling without an oversized primary control", () => {
    const candidates = [
      resolve(process.cwd(), "apps/recovery-guardian/src/PlayArea.scss"),
      resolve(process.cwd(), "../recovery-guardian/src/PlayArea.scss"),
    ];
    const stylePath = candidates.find(existsSync);
    expect(stylePath).toBeTruthy();
    const styles = readFileSync(stylePath!, "utf8");
    expect(styles).toMatch(/prefers-reduced-motion/);
    expect(styles).toContain("#f4fcf9");
    expect(styles).toMatch(/\.guardian-command-art img\s*\{[\s\S]*object-fit:\s*cover/);
    expect(styles).toMatch(/\.mx2-btn--primary\s*\{[\s\S]*max-width:\s*280px/);
    expect(styles).not.toContain("repeating-linear-gradient");
  });
});
