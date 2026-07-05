import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import {
  DEFAULT_SESSION_ACCOUNT_SEED,
  DEFAULT_SESSION_ALLOWED_METHOD,
} from "../../aa-session-key-lab/src/launch";
import PlayArea from "../../aa-session-key-lab/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    aaCore: "AA Core",
    accountSeed: "Account ID / Hash",
    accountSeedPlaceholder: "seed string or 0x hash",
    allowedMethod: "Allowed Method",
    allowedMethodPlaceholder: "symbol",
    anyMethod: "Any method",
    anyMethodCaution: "Blank method allows any method.",
    checkSponsor: "Check Sponsorship",
    configureSession: "Configure Session Key",
    configureSessionBlocked: "Complete the missing scope first.",
    configured: "configured",
    expiresAt: "Expiry Timestamp",
    expiresAtPlaceholder: "unix seconds",
    generateKey: "Generate Key",
    inspectSession: "Inspect Session Key",
    notConnected: "not connected",
    pending: "pending",
    requestSponsor: "Request Sponsorship",
    revokeSession: "Revoke Session Key",
    sessionAdvancedHint: "Raw fields stay in details.",
    sessionAdvancedTitle: "Advanced session fields",
    sessionCommandTitle: "Key & sponsorship",
    sessionHeroEyebrow: "Session Keys",
    sessionHeroTitle: "Scoped session keys",
    sessionKeyMissing: "missing",
    sessionLabel: "Session",
    sessionMetricStatus: "Session",
    sessionNextGenerate: "Generate a local key",
    sessionPassDraft: "Draft needs fields",
    sessionPassReady: "Ready to configure",
    sessionPassTitle: "Scope before you sign",
    sessionReadinessChecks: "Session readiness checks",
    sessionStageNeedExpiry: "Choose a future expiry window",
    sessionStageNeedKey: "Generate a session key first",
    sessionStageNeedTarget: "Set a target contract in details",
    sessionPresetMint: "Mint window",
    sessionPresetMintCopy: "Day-long mint permission.",
    sessionPresetOps: "Ops delegate",
    sessionPresetOpsCopy: "Seven-day execute scope.",
    sessionPresetRewards: "Rewards bot",
    sessionPresetRewardsCopy: "One-hour rewards pass.",
    sessionPublicKey: "Session Public Key",
    sessionPublicKeyPlaceholder: "33-byte compressed public key",
    sessionScopeTitle: "Session scope",
    sessionTargetHint: "Target stays in details.",
    sessionTargetMissing: "Set target in details",
    sessionVerifier: "Session Verifier",
    spendUnlimited: "unlimited",
    spendingLimit: "Spending Limit (GAS)",
    spendingLimitHint: "0 leaves the key uncapped.",
    spendingLimitPlaceholder: "0 = unlimited",
    sponsorship: "Sponsorship",
    targetContract: "Target Contract",
    targetContractPlaceholder: "0x... or N...",
    wallet: "Wallet",
  };
  let value = messages[key] ?? key;
  for (const [name, replacement] of Object.entries(params ?? {})) {
    value = value.replaceAll(`{${name}}`, String(replacement));
  }
  return value;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    aaCoreDisplay: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    derivedAccountIdHash: "",
    generatedPublicKey: "",
    hasOnChainSession: false,
    isCheckingSponsorship: false,
    isRevoking: false,
    isSubmitting: false,
    sessionStatusDisplay: "",
    sessionVerifierDisplay: "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    sponsorStatusDisplay: "idle",
    walletDisplay: "not connected",
    ...overrides,
  };
  return Object.fromEntries(Object.entries(base).map(([key, value]) => [key, createObservable(value)])) as ObservableState;
}

function playAreaStyles(app: string): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return readFileSync(path.join(appsRoot, app, "src/PlayArea.scss"), "utf8");
}

describe("aa-session-key-lab PlayArea (session pass workflow)", () => {
  it("renders a clean session pass with presets instead of raw fields on the main surface", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector('.sess-visual-card img[src="session-key-control.webp"]')).toBeTruthy();
    expect(container.querySelector(".sess-scene__stage-art")).toBeNull();
    expect(container.querySelector(".sess-scene__wash")).toBeNull();
    expect(container.querySelector(".sess-scope-panel")).toBeTruthy();
    expect(container.querySelector(".sess-scope-panel__head")?.textContent).toContain("Rewards bot");
    expect(container.querySelectorAll(".sess-preset-card")).toHaveLength(3);
    expect(container.querySelectorAll(".sess-scene__badge")).toHaveLength(6);
    expect(container.querySelector(".sess-scene__status")?.textContent).toContain("Generate a session key first");
    expect(container.querySelector(".sess-drawer__field")).toBeFalsy();
    expect(container.querySelector(".mx2-btn--primary")?.textContent).toContain("Generate a local key");
  });

  it("opens raw account and contract fields only from the details drawer", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /Key & sponsorship/ }));

    expect(container.querySelector(".sess-drawer-panel--ops")).toBeTruthy();
    expect(container.querySelector(".sess-drawer-panel--scope")).toBeTruthy();
    expect(container.querySelectorAll(".sess-drawer-panel.mx2-open-panel.semi-card")).toHaveLength(2);
    expect(container.querySelector(".sess-sponsor-card.mx2-open-notice.semi-banner")).toBeTruthy();
    expect(container.querySelector(".sess-command-grid")).toBeTruthy();
    expect(container.querySelector(".sess-drawer-grid")).toBeTruthy();
    expect(container.querySelector(".sess-drawer__field")).toBeTruthy();
    expect(container.querySelectorAll(".sess-drawer__field.mx2-open-field .mx2-open-field__control input.semi-input")).toHaveLength(6);
    expect(container.querySelector(".sess-drawer-input")).toBeNull();
    expect(container.querySelector(".sess-drawer__row")).toBeFalsy();
    expect(screen.getByPlaceholderText("seed string or 0x hash")).toBeTruthy();
    expect(screen.getByPlaceholderText("0x... or N...")).toBeTruthy();
  });

  it("uses the generated public key and selected scope when configuring the session", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const generatedPublicKey = `02${"11".repeat(32)}`;
    const targetContract = "0x1234567890abcdef1234567890abcdef12345678";
    render(<PlayArea t={t} state={state({ generatedPublicKey })} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: /Key & sponsorship/ }));
    fireEvent.change(screen.getByPlaceholderText("0x... or N..."), {
      target: { value: targetContract },
    });

    await waitFor(() =>
      expect((screen.getByRole("button", { name: /Configure Session Key/ }) as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(screen.getByRole("button", { name: /Configure Session Key/ }));

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith(
        "configureSessionKey",
        DEFAULT_SESSION_ACCOUNT_SEED,
        generatedPublicKey,
        targetContract,
        DEFAULT_SESSION_ALLOWED_METHOD,
        expect.any(String),
        "0.1",
        "",
      ),
    );
  });

  it("keeps scope preset choices wired to the configure action", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const generatedPublicKey = `02${"22".repeat(32)}`;
    const targetContract = "0x9999999999999999999999999999999999999999";
    render(<PlayArea t={t} state={state({ generatedPublicKey })} dispatch={dispatch} />);

    fireEvent.click(screen.getByText("Mint window").closest("button") as HTMLButtonElement);
    fireEvent.click(screen.getByRole("button", { name: /Key & sponsorship/ }));
    fireEvent.change(screen.getByPlaceholderText("0x... or N..."), {
      target: { value: targetContract },
    });

    await waitFor(() =>
      expect((screen.getByRole("button", { name: /Configure Session Key/ }) as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(screen.getByRole("button", { name: /Configure Session Key/ }));

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith(
        "configureSessionKey",
        DEFAULT_SESSION_ACCOUNT_SEED,
        generatedPublicKey,
        targetContract,
        "mint",
        expect.any(String),
        "1",
        "",
      ),
    );
  });

  it("keeps the PlayArea background quiet and motion-accessible", () => {
    const styles = playAreaStyles("aa-session-key-lab");

    expect(styles).toMatch(/prefers-reduced-motion/);
    expect(styles).toMatch(/\.sess-workspace\s*\{[^}]*align-items:\s*start/);
    expect(styles).toMatch(/\.sess-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 190px/);
    expect(styles).toMatch(/\.sess-scene\s*\{[\s\S]*background:\s*var\(--mx2-surface-2\)/);
    expect(styles).toMatch(/\.sess-scene__pass\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.sess-scene__scope\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.sess-visual-card\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.sess-visual-card\s*\{[\s\S]*grid-template-columns:\s*minmax\(132px,\s*0\.42fr\) minmax\(0,\s*0\.58fr\)/);
    expect(styles).toMatch(/\.sess-visual-card img\s*\{[\s\S]*object-fit:\s*contain/);
    expect(styles).toMatch(/\.sess-visual-card img\s*\{[\s\S]*opacity:\s*1/);
    expect(styles).toMatch(/\.sess-visual-card img\s*\{[\s\S]*filter:\s*none/);
    expect(styles).toMatch(/\.sess-visual-card img\s*\{[\s\S]*max-height:\s*124px/);
    expect(styles).toMatch(/\.sess-visual-card::after\s*\{[\s\S]*content:\s*none/);
    expect(styles).toMatch(/\.sess-visual-card figcaption\s*\{[\s\S]*position:\s*relative/);
    expect(styles).not.toMatch(/\.sess-visual-card img\s*\{[\s\S]*opacity:\s*0\.72/);
    expect(styles).not.toMatch(/\.sess-visual-card::after\s*\{[\s\S]*rgba\(255,\s*255,\s*255,\s*0\.14\)/);
    expect(styles).toMatch(/\.sess-scope-panel\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.sess-preset-grid\s*\{[\s\S]*display:\s*flex/);
    expect(styles).toMatch(/\.sess-preset-card\s*\{[\s\S]*min-height:\s*62px/);
    expect(styles).toMatch(/\.sess-drawer\s*\{[\s\S]*grid-template-columns:\s*repeat\(12,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.sess-drawer-panel--ops\s*\{[\s\S]*grid-column:\s*span 4/);
    expect(styles).toMatch(/\.sess-drawer-panel--scope\s*\{[\s\S]*grid-column:\s*span 8/);
    expect(styles).toMatch(/\.sess-command-card\s*\{[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\)/);
    expect(styles).toMatch(/\.sess-drawer-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.sess-drawer__field\s*\{[\s\S]*min-width:\s*0/);
    expect(styles).toMatch(/\.sess-sponsor-card\.mx2-open-notice\.semi-banner\s*\{[\s\S]*align-items:\s*flex-start/);
    expect(styles).not.toMatch(/\.sess-drawer-input/);
    expect(styles).not.toMatch(/\.sess-drawer-panel__head/);
    expect(styles).not.toMatch(/\.sess-drawer-panel__icon/);
    expect(styles).toMatch(/@media \(max-width:\s*820px\)[\s\S]*\.sess-scene__scope\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*820px\)[\s\S]*\.sess-scene__badge em\s*\{[\s\S]*white-space:\s*normal/);
    expect(styles).toMatch(/@media \(max-width:\s*820px\)[\s\S]*\.sess-preset-grid\s*\{[\s\S]*overflow-x:\s*auto/);
    expect(styles).toMatch(/@media \(max-width:\s*820px\)[\s\S]*\.sess-preset-card\s*\{[\s\S]*flex:\s*1 0 108px/);
    expect(styles).toMatch(/@media \(max-width:\s*820px\)[\s\S]*\.sess-control-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*820px\)[\s\S]*\.sess-drawer\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(styles).toMatch(/@media \(max-width:\s*820px\)[\s\S]*\.sess-command-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).not.toMatch(/sess-scene__stage-art/);
    expect(styles).not.toMatch(/sess-scene__wash/);
    expect(styles).not.toMatch(/repeating-linear-gradient/);
    expect(styles).not.toMatch(/\.sess-preset-card\s*\{[\s\S]*min-height:\s*128px/);
    expect(styles).not.toMatch(/sess-preset-card[\s\S]*radial-gradient/);
  });
});
