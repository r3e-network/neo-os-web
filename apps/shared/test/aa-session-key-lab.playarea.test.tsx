import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import { DEFAULT_SESSION_ALLOWED_METHOD } from "../../aa-session-key-lab/src/launch";
import PlayArea from "../../aa-session-key-lab/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const ACCOUNT = "0xcbc8faecd19d509790e8e32e25791602aa278705";
const OWNER = "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32";
const VERIFIER = "0x3ba8333406e59f9fd83cf378b33706a33d9f3755";
const PUBLIC_KEY = `02${"11".repeat(32)}`;
const PRIVATE_KEY = "aa".repeat(32);
const TARGET = "0x1234567890abcdef1234567890abcdef12345678";

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    aaCore: "AA Core",
    accountOwner: "Backup owner",
    accountSeed: "Registered AccountId",
    accountSeedPlaceholder: "exact 20-byte AccountId or N-address",
    allowedMethod: "Allowed Method",
    allowedMethodPlaceholder: "method name",
    allowanceUnavailableShort: "No allowance",
    allowanceUnavailableTestnet: "Testnet does not enforce an allowance.",
    bindingVerified: "Session verifier bound",
    checkSponsor: "Check Sponsorship",
    configureSession: "Configure Session Key",
    connectOwnerWallet: "Connect owner wallet",
    copyPrivateKey: "Copy Private Key",
    expiresAt: "Expiry Timestamp",
    expiresAtPlaceholder: "unix seconds",
    explicitMethodHint: "Use one exact method.",
    generateKey: "Generate Key",
    hidePrivateKey: "Hide",
    inspectAAAccount: "Inspect AA account",
    inspectSession: "Inspect Session Key",
    mainnet: "Mainnet",
    network: "Network",
    ownerNotVerified: "Not verified",
    ownerVerified: "Owner verified",
    privateKeyCardTitle: "Generated private key",
    privateKeyCaution: "Shown once and never stored.",
    recoverSessionWrite: "Recover pending update",
    requestSponsor: "Request Sponsorship",
    revokeConfirm: "Confirm Revoke",
    revokeConfirmPrompt: "Revoke this on-chain session key?",
    revokeSession: "Revoke Session Key",
    sessionAbsent: "No session on chain",
    sessionAccountReady: "AA account verified",
    sessionAdvancedHint: "Raw fields stay in details.",
    sessionAdvancedTitle: "Advanced session fields",
    sessionCommandTitle: "Key & sponsorship",
    sessionDraft: "Permission draft",
    sessionDraftHonest: "This is a local draft.",
    sessionHeroCopy: "Bind one key to one contract and method.",
    sessionHeroEyebrow: "Session Keys",
    sessionHeroTitle: "Scoped session keys",
    sessionHeroVisualAlt: "Session key permission illustration",
    sessionKeyMissing: "missing",
    sessionMetricStatus: "Session",
    sessionNextGenerate: "Generate a local key",
    sessionObjectAccount: "AA account",
    sessionObjectAllowance: "Allowance",
    sessionObjectExpiry: "Expiry",
    sessionObjectKey: "Session key",
    sessionObjectOwner: "Owner authority",
    sessionObjectScope: "Contract · method",
    sessionPassTitle: "Scope before you sign",
    sessionPermissionObject: "Live permission object",
    sessionPresetMint: "Mint window",
    sessionPresetMintCopy: "Day-long mint permission.",
    sessionPresetOps: "Ops delegate",
    sessionPresetOpsCopy: "Seven-day execute scope.",
    sessionPresetRewards: "Rewards bot",
    sessionPresetRewardsCopy: "One-hour rewards pass.",
    sessionPublicKey: "Session Public Key",
    sessionPublicKeyPlaceholder: "33-byte compressed public key",
    sessionReadbackRequired: "Exact on-chain readback is required.",
    sessionReadinessChecks: "Session readiness checks",
    sessionScopeTitle: "Session scope",
    sessionStageNeedTarget: "Set a target contract in details",
    sessionTargetHint: "Target stays in details.",
    sessionTargetMissing: "Set target in details",
    sessionVerifier: "Session Verifier",
    showPrivateKey: "Show",
    spendUnlimited: "unlimited",
    spendingLimit: "Spending Limit (GAS)",
    spendingLimitHint: "0 leaves the key uncapped.",
    spendingLimitPlaceholder: "0 = unlimited",
    sponsorship: "Sponsorship",
    targetContract: "Target Contract",
    targetContractPlaceholder: "0x... or N...",
    walletNetworkVerified: "Wallet network verified",
  };
  let value = messages[key] ?? key;
  for (const [name, replacement] of Object.entries(params ?? {})) {
    value = value.replaceAll(`{${name}}`, String(replacement));
  }
  return value;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    aaCoreDisplay: "0x0268a387913b250166ddec032b03332690a1ef78",
    accountOwner: OWNER,
    accountReadStatus: "ready",
    accountVerifier: VERIFIER,
    allowanceSupported: true,
    canConfigure: true,
    canRevoke: false,
    generatedPrivateKey: "",
    generatedPublicKey: "",
    inspectedAccountIdHash: ACCOUNT,
    launchAccountId: ACCOUNT,
    isCheckingSponsorship: false,
    isInspecting: false,
    isRecovering: false,
    isRevoking: false,
    isSubmitting: false,
    lastError: "",
    networkDisplay: "Mainnet",
    onChainSessionView: null,
    ownerAuthorityStatus: "owner",
    pendingWrite: null,
    sessionReadStatus: "absent",
    sessionVerifierDisplay: VERIFIER,
    sponsorStatusDisplay: "Not checked",
    verifierBound: true,
    walletDisplay: OWNER,
    walletNetwork: "mainnet",
    writePhase: "idle",
    ...overrides,
  };
  return Object.fromEntries(Object.entries(base).map(([key, value]) => [key, createObservable(value)])) as ObservableState;
}

function styles(): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return readFileSync(path.join(appsRoot, "aa-session-key-lab", "src/PlayArea.scss"), "utf8");
}

describe("aa-session-key-lab PlayArea", () => {
  it("renders a real permission object and asset-led surface before raw fields", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector('.sess-visual-card img[src="session-key-control.webp"]')).toBeTruthy();
    expect(container.querySelectorAll(".sess-object__module")).toHaveLength(6);
    expect(container.querySelectorAll(".sess-preset-card")).toHaveLength(3);
    expect(container.querySelector(".sess-account-ribbon")?.textContent).toContain("Session verifier bound");
    expect(container.querySelector(".sess-drawer__field")).toBeNull();
    const primary = container.querySelector(".mx2-btn--primary") as HTMLButtonElement;
    expect(primary.textContent).toContain("Generate a local key");
    expect(primary.disabled).toBe(false);
  });

  it("keeps six mainnet raw inputs and sponsorship in the secondary drawer", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Key & sponsorship/ }));

    expect(container.querySelectorAll(".sess-drawer-panel.mx2-open-panel.semi-card")).toHaveLength(2);
    expect(container.querySelectorAll(".sess-drawer__field input.semi-input")).toHaveLength(6);
    expect(container.querySelector(".sess-sponsor-card")).toBeTruthy();
    expect(screen.getByPlaceholderText("exact 20-byte AccountId or N-address")).toBeTruthy();
    expect(screen.getByPlaceholderText("0x... or N...")).toBeTruthy();
  });

  it("submits the selected scope only after the verified account object is complete", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayArea t={t} state={state({ generatedPublicKey: PUBLIC_KEY })} dispatch={dispatch} />);
    fireEvent.click(screen.getByText("Mint window").closest("button") as HTMLButtonElement);
    fireEvent.click(screen.getByRole("button", { name: /Key & sponsorship/ }));
    fireEvent.change(screen.getByPlaceholderText("0x... or N..."), { target: { value: TARGET } });

    const configure = await screen.findByRole("button", { name: "Configure Session Key" });
    expect((configure as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(configure);

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith(
      "configureSessionKey",
      ACCOUNT,
      PUBLIC_KEY,
      TARGET,
      "mint",
      expect.any(String),
      "1",
      "Mint window",
    ));
  });

  it("shows the generated private key once, hidden by default, with an explicit copy action", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayArea t={t} state={state({ generatedPublicKey: PUBLIC_KEY, generatedPrivateKey: PRIVATE_KEY })} dispatch={dispatch} />);

    expect(screen.queryByText(PRIVATE_KEY)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show" }));
    expect(screen.getByText(PRIVATE_KEY)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Copy Private Key" }));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("copyPrivateKey"));
  });

  it("does not present a fake allowance on the frozen testnet verifier", () => {
    const { container } = render(<PlayArea t={t} state={state({ allowanceSupported: false, networkDisplay: "Testnet", walletNetwork: "testnet" })} dispatch={vi.fn()} />);
    expect(container.querySelector(".sess-object__grid")?.textContent).toContain("Testnet does not enforce an allowance.");
    expect(screen.getAllByText("Testnet does not enforce an allowance.")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: /Key & sponsorship/ }));
    expect(container.querySelectorAll(".sess-drawer__field input.semi-input")).toHaveLength(5);
  });

  it("requires an explicit second action before revoke dispatch", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const liveView = {
      decoded: {
        pubKey: PUBLIC_KEY,
        targetContract: TARGET,
        method: DEFAULT_SESSION_ALLOWED_METHOD,
        expirySeconds: Math.floor(Date.now() / 1000) + 3_600,
        expiryDisplay: "1 hour",
        spendingLimitGas: "1.5",
        spendingLimitUnlimited: false,
        spendingLimitSupported: true,
      },
      spentGas: "0.2",
    };
    render(<PlayArea t={t} state={state({ sessionReadStatus: "active", canConfigure: false, canRevoke: true, onChainSessionView: liveView })} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: "Revoke Session Key" }));
    expect(dispatch).not.toHaveBeenCalledWith("revokeSession", expect.anything());
    fireEvent.click(screen.getByRole("button", { name: "Confirm Revoke" }));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("revokeSession", ACCOUNT));
  });

  it("makes pending readback recovery the only primary action", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayArea t={t} state={state({ pendingWrite: { kind: "configure", txid: `0x${"ab".repeat(32)}` } })} dispatch={dispatch} />);
    fireEvent.click(screen.getByRole("button", { name: "Recover pending update" }));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("recoverPending"));
  });

  it("keeps contrast, quiet backgrounds, bounded controls, and reduced motion", () => {
    const css = styles();
    expect(css).toMatch(/prefers-reduced-motion/);
    expect(css).toMatch(/\.sess-workspace\s*\{[^}]*align-items:\s*start/);
    expect(css).toMatch(/\.sess-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 210px/);
    expect(css).toMatch(/\.sess-scene\s*\{[\s\S]*background:\s*#f8faf8/);
    expect(css).toMatch(/\.sess-object\s*\{[\s\S]*background:\s*#ffffff/);
    expect(css).toMatch(/\.sess-object__grid\s*\{[\s\S]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(css).toMatch(/\.sess-visual-card img\s*\{[\s\S]*object-fit:\s*cover/);
    expect(css).toMatch(/\.sess-drawer\s*\{[\s\S]*repeat\(12,\s*minmax\(0,\s*1fr\)\)/);
    expect(css).not.toMatch(/repeating-linear-gradient|radial-gradient/);
  });
});
