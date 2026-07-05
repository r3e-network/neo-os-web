import React from "react";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../unbreakable-vault/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string) {
  const messages: Record<string, string> = {
    break: "Break",
    create: "Create",
    breakVault: "Break Vault",
    createVault: "Create Vault",
    createVaultButton: "Seal Vault",
    creatingVault: "Creating...",
    attemptBreak: "Attempt Break",
    attempting: "Attempting...",
    challengeConsole: "Challenge",
    challengeConsoleTitle: "Vault Challenge",
    detailsLabel: "Details",
    challengeDeskTitle: "Challenge target",
    challengeDeskLoaded: "Vault loaded.",
    challengeDeskEmpty: "Load a vault",
    challengeDeskHint: "Inspect the bounty before paying.",
    docSubtitle: "Break vaults for bounties.",
    confirmSecretLabel: "Confirm secret",
    confirmSecretPlaceholder: "Confirm secret",
    secretLabel: "Secret",
    secretPlaceholder: "Secret",
    secretAttemptLabel: "Break secret",
    secretAttemptPlaceholder: "Attempt secret",
    bountyPlaceholder: "Bounty GAS",
    bountyPresetLabel: "Bounty presets",
    vaultIdLabel: "Vault ID",
    vaultIdPlaceholder: "Vault ID",
    loadVault: "Load Vault",
    attemptFee: "Fee",
    bountyLabel: "Bounty",
    attempts: "Attempts",
    active: "Active",
    expired: "Expired",
    broken: "Broken",
    claimBounty: "Claim bounty",
    reclaimVault: "Reclaim vault",
    creator: "Creator",
    recentVaults: "Recent",
    noRecentVaults: "No vaults",
    myVaults: "My Vaults",
    createFineLabel: "Create details",
    secretNote: "Secret is hashed locally.",
    secretReady: "Hash armed",
    secretWaiting: "Keys unarmed",
    vaultCreated: "Vault Created",
    blueprintTitle: "Vault blueprint",
    blueprintUntitled: "Untitled bounty vault",
    configureVault: "Configure vault",
    createReady: "Ready",
    createNeedSecret: "Arm both key slots to seal the vault.",
    titleLabel: "Vault Title",
    titlePlaceholder: "Give it a name",
    descriptionPlaceholder: "Optional hint",
    difficultyLabel: "Difficulty",
    difficultyEasy: "Easy",
    difficultyMedium: "Medium",
    difficultyHard: "Hard",
    difficultyEasyHint: "Low fee",
    difficultyMediumHint: "Balanced",
    difficultyHardHint: "High stakes",
    vaultStatus: "Status",
  };
  return messages[key] ?? key;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    address: "",
    vaultIdInput: "",
    attemptSecret: "",
    attemptFeeDisplay: "0.1 GAS",
    createdVaultId: "",
    vaultDetails: null,
    recentVaults: [],
    myVaults: [],
    isLoading: false,
    isCreating: false,
    isClaiming: false,
    canAttempt: false,
    canReclaim: false,
    ...overrides,
  };
  return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, createObservable(v)]));
}

const vault = {
  id: "42",
  title: "Glass Fortress",
  description: "A public hint for challengers",
  bounty: 500_000_000,
  attempts: 3,
  broken: false,
  expired: false,
  status: "active",
  attemptFee: 10_000_000,
  difficultyName: "Medium",
};

function optionByText(container: HTMLElement, selector: string, text: string) {
  const option = Array.from(container.querySelectorAll<HTMLElement>(selector))
    .find((node) => node.textContent?.includes(text));
  if (!option) throw new Error(`Missing option "${text}" in ${selector}`);
  return option;
}

describe("Unbreakable Vault PlayArea (v2)", () => {
  it("renders the vault as a real resource-led challenge scene", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".vault-brk-scene")).toBeTruthy();
    expect(container.querySelector(".mx2-cat-game")).toBeTruthy();
    expect(container.querySelector(".vault-brk-scene__image")).toBeNull();
    expect(container.querySelector(".vault-brk-scene__wash")).toBeNull();
    expect((container.querySelector(".vault-brk-scene__artwork") as HTMLImageElement)?.src).toContain("vault-challenge.webp");
    expect(container.querySelector(".vault-core")).toBeTruthy();
    expect(container.querySelector(".vault-crack-route")).toBeTruthy();
    expect(container.querySelector(".vault-blueprint-art")).toBeNull();
  });

  it("starts on the create desk when there is no live target to break", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".mx2-stage__title")?.textContent).toBe("Create Vault");
    expect(container.querySelector(".vault-mode-card--active")?.textContent).toContain("Create");
    expect(container.querySelector(".vault-mode-switch .semi-radio")).toBeNull();
    expect(container.querySelector(".mx2-btn--primary")?.textContent).toContain("Seal Vault");
    expect(container.querySelector(".mx2-btn--primary")?.textContent).not.toContain("bounty");
    expect(container.querySelector(".vault-work-card--create")).toBeTruthy();
    expect(container.querySelector(".vault-secret-console")).toBeTruthy();
    expect(container.querySelector(".vault-secret-console .vault-create-dossier")).toBeTruthy();
    expect(container.querySelector(".vault-tuning-grid")).toBeTruthy();
    expect(container.querySelectorAll(".vault-tuning-card")).toHaveLength(2);
    expect(container.querySelector(".vault-secret-console__status")?.textContent).toContain("Keys unarmed");
    expect(container.querySelector(".vault-key-grid--create")).toBeTruthy();
    expect(container.querySelectorAll(".vault-key-grid--create .vault-key-slot input")).toHaveLength(2);
    expect((container.querySelector(".vault-field--create-secret input") as HTMLInputElement)?.placeholder).toBe("Secret");
    expect((container.querySelector(".vault-field--confirm-secret input") as HTMLInputElement)?.placeholder).toBe("Confirm secret");
    expect(container.querySelector(".vault-brk-scene__art-card")).toBeTruthy();
    expect(container.querySelector(".vault-blueprint-art")).toBeNull();
    expect(container.querySelector(".vault-core__door")?.textContent).toContain("Vault blueprint");
    expect(container.querySelector(".vault-crack-route")?.textContent).toContain("Secret");
    expect(container.querySelector(".vault-target-card--empty")).toBeNull();
    expect(container.querySelector(".vault-target-lock")).toBeNull();
  });

  it("starts on the break desk when a target is already loaded", () => {
    const { container } = render(
      <PlayArea t={t} state={state({ vaultDetails: vault, canAttempt: true })} dispatch={vi.fn()} />,
    );

    expect(container.querySelector(".mx2-stage__title")?.textContent).toBe("Break Vault");
    expect(container.querySelector(".vault-mode-card--active")?.textContent).toContain("Break");
    expect(container.querySelector(".vault-mode-switch .semi-radio")).toBeNull();
    expect(container.querySelector(".vault-target-lock")).toBeTruthy();
    expect(container.querySelector(".vault-work-card--create")).toBeNull();
  });

  it("selects and loads a recent vault from the target rail", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const appState = state({ recentVaults: [vault] });
    const { container } = render(<PlayArea t={t} state={appState} dispatch={dispatch} />);

    fireEvent.click(container.querySelector(".vault-target-card") as Element);

    expect(appState.vaultIdInput.get()).toBe("42");
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("loadVault", "42"));
  });

  it("dispatches loadVault and attemptBreak from the break desk", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <PlayArea
        t={t}
        state={state({
          vaultIdInput: "42",
          attemptSecret: "open-sesame",
          vaultDetails: vault,
          canAttempt: true,
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(container.querySelector(".vault-secondary-action") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("loadVault", "42"));
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("attemptBreak"));
  });

  it("dispatches createVault with full contract payload", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(optionByText(container, ".vault-mode-card", "Create"));
    expect(container.querySelector(".vault-create-dossier")).toBeTruthy();
    expect(container.querySelector(".vault-secret-console .vault-create-dossier")).toBeTruthy();
    expect(container.querySelector(".vault-secret-console")).toBeTruthy();
    expect(container.querySelector(".vault-tuning-grid")).toBeTruthy();
    expect(container.querySelectorAll(".vault-tuning-card")).toHaveLength(2);
    expect(container.querySelector(".vault-key-grid--create")).toBeTruthy();
    expect(container.querySelector(".vault-detail-toggle")).toBeNull();
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.change(container.querySelector(".vault-drawer-field--title input") as HTMLInputElement, { target: { value: "Cipher Shrine" } });
    const secretInputs = container.querySelectorAll(".vault-key-grid--create .vault-field--secret input");
    fireEvent.change(secretInputs[0], { target: { value: "  secret123  " } });
    fireEvent.change(secretInputs[1], { target: { value: "secret123" } });
    fireEvent.click(container.querySelectorAll(".vault-bounty")[2]);
    fireEvent.click(container.querySelectorAll(".vault-difficulty")[2]);
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("createVault", expect.objectContaining({
      title: "Cipher Shrine",
      secret: "secret123",
      secretHash: "",
      bounty: "10",
      difficulty: 3,
    })));
  });

  it("keeps the secondary drawer as compact vault operation panels", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".vault-target-card--empty")).toBeNull();
    fireEvent.click(optionByText(container, ".vault-mode-card", "Break"));
    expect(container.querySelector(".vault-target-card--empty")?.textContent).toContain("Arm both key slots");
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);

    expect(container.querySelector(".mx2-action-rail__drawer-toggle")?.textContent).toContain("Details");
    expect(container.querySelector(".mx2-drawer__title")?.textContent).toBe("Challenge");
    expect(container.querySelector(".vault-drawer-grid")).toBeTruthy();
    expect(container.querySelectorAll(".vault-drawer-panel").length).toBe(4);
    expect(container.querySelectorAll(".vault-drawer-panel.mx2-open-panel.semi-card").length).toBe(4);
    expect(container.querySelector(".vault-drawer-input")).toBeNull();
    expect(container.querySelector(".vault-drawer-panel__head")).toBeNull();
    expect(container.querySelector(".vault-drawer-field input.semi-input")).toBeTruthy();
    expect(container.querySelector(".vault-drawer-field--title input.semi-input")).toBeTruthy();
    expect(container.querySelector(".vault-drawer-field--wide input.semi-input")).toBeTruthy();
    expect(container.querySelector(".mx2-drawer__body h4")).toBeNull();
  });

  it("keeps motion and low-noise vault hierarchy backed by tests", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
      ? path.resolve(process.cwd(), "..")
      : path.resolve(process.cwd(), "apps");
    const styles = fs.readFileSync(
      path.join(appsRoot, "unbreakable-vault/src/PlayArea.scss"),
      "utf8",
    );
    const source = fs.readFileSync(
      path.join(appsRoot, "unbreakable-vault/src/PlayArea.tsx"),
      "utf8",
    );
    expect(source).not.toContain("OpenUiSegmented");
    expect(source).toContain("vault-mode-card");
    expect(styles).toContain("@use \"@shared/styles/v2/motion\"");
    expect(styles).toMatch(/\.unbreakable-vault-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 172px/);
    expect(styles).toMatch(/\.unbreakable-vault-play-area \.mx2-action-rail__row \.mx2-btn--primary:not\(:disabled\)\s*\{[\s\S]*background:\s*#d97706/);
    expect(styles).toMatch(/\.unbreakable-vault-play-area \.mx2-score\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/vault-brk-scene\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/vault-brk-scene\s*\{[\s\S]*box-shadow:\s*none/);
    expect(styles).not.toMatch(/vault-brk-scene__image|vault-brk-scene__wash|vault-brk-scene-art|var\(--mx2-scene-art-opacity|background-image:\s*url/);
    expect(styles).toMatch(/vault-brk-scene__art-card\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/vault-brk-scene__artwork\s*\{[\s\S]*object-fit:\s*cover/);
    expect(styles).toMatch(/vault-brk-scene__artwork\s*\{[^}]*opacity:\s*0\.82/);
    expect(styles).toMatch(/vault-brk-scene__artwork\s*\{[^}]*filter:\s*none/);
    expect(styles).toMatch(/vault-mode-switch\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/vault-mode-card\s*\{[\s\S]*min-height:\s*72px/);
    expect(styles).toMatch(/vault-mode-card--active\s*\{[\s\S]*inset 4px 0 0 #0f766e/);
    expect(styles).not.toMatch(/vault-mode-segmented|semi-radioGroup|semi-radio-checked/);
    expect(styles).toMatch(/vault-core__door\s*\{[\s\S]*background:\s*#fffef8/);
    expect(styles).toMatch(/vault-core__laser\s*\{[\s\S]*opacity:\s*0;/);
    expect(styles).toMatch(/vault-core__laser\s*\{[\s\S]*filter:\s*none/);
    expect(styles).toMatch(/vault-brk-scene\[data-state="attempting"\] \.vault-core__laser[\s\S]*opacity:\s*0\.38/);
    expect(styles).not.toMatch(/backdrop-filter/);
    expect(styles).not.toContain("vault-blueprint-art");
    expect(styles).not.toMatch(/vault-brk-scene__artwork\s*\{[^}]*filter:\s*saturate/);
    expect(fs.existsSync(path.join(appsRoot, "unbreakable-vault/public/vault-brk-scene-art.jpg"))).toBe(false);
    expect(styles).toMatch(/vault-work-card--break[\s\S]*grid-template-columns/);
    expect(styles).toMatch(/vault-work-card--create[\s\S]*grid-template-areas:[\s\S]*"secret"[\s\S]*"tuning"/);
    expect(styles).toMatch(/vault-work-card--create \.vault-work-card__hero\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/vault-tuning-grid\s*\{[\s\S]*grid-area:\s*tuning/);
    expect(styles).toMatch(/vault-tuning-card\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/vault-key-slot[\s\S]*grid-template-areas/);
    expect(styles).toMatch(/vault-create-dossier[\s\S]*grid-area:\s*dossier/);
    expect(styles).toMatch(/vault-create-dossier[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.78\)/);
    expect(styles).toMatch(/vault-secret-console\s*\{[\s\S]*grid-area:\s*secret/);
    expect(styles).toMatch(/vault-secret-console\s*\{[\s\S]*grid-template-areas:\s*"head keys dossier"/);
    expect(styles).toMatch(/vault-secret-console\s*\{[\s\S]*background:[\s\S]*#fffdf4/);
    expect(styles).toMatch(/vault-secret-console\[data-ready="true"\]\s*\{[\s\S]*background:\s*#f4fffb/);
    expect(styles).toMatch(/vault-key-grid--create\s*\{[\s\S]*grid-area:\s*keys/);
    expect(styles).toMatch(/vault-key-grid--create\s*\{[\s\S]*width:\s*min\(100%,\s*460px\)/);
    expect(styles).toMatch(/vault-key-grid--create\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/vault-key-grid--create \.vault-key-slot\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/vault-key-grid--create \.vault-key-slot\s*\{[\s\S]*min-height:\s*54px/);
    expect(styles).toMatch(/vault-key-grid--create \.vault-key-slot \.mx2-open-field__label span\s*\{[\s\S]*clip:\s*rect\(0 0 0 0\)/);
    expect(styles).not.toContain("vault-detail-toggle");
    expect(styles).toMatch(/vault-drawer-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(260px,\s*0\.95fr\)\s*minmax\(320px,\s*1\.18fr\)/);
    expect(styles).toMatch(/vault-drawer-form-row\s*\{[\s\S]*grid-template-columns:\s*minmax\(180px,\s*1fr\)\s*minmax\(110px,\s*0\.46fr\)/);
    expect(styles).toMatch(/vault-drawer-field--wide\s*\{[\s\S]*grid-column:\s*1 \/ -1/);
    expect(styles).not.toContain("vault-drawer-panel__head");
    expect(styles).not.toContain("vault-drawer-input");
    expect(styles).toMatch(/vault-drawer-field \.mx2-open-field__control\s*\{[\s\S]*min-height:\s*40px/);
    expect(styles).toMatch(/@media \(max-width:\s*680px\)[\s\S]*\.vault-drawer-action-row,\s*\n\s*\.vault-drawer-form-row\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(styles).toMatch(/@media \(max-width:\s*680px\)[\s\S]*\.vault-brk-scene\s*\{[\s\S]*min-height:\s*300px/);
    expect(styles).toMatch(/@media \(max-width:\s*680px\)[\s\S]*\.vault-brk-scene__art-card\s*\{[\s\S]*height:\s*128px/);
    expect(styles).toMatch(/@media \(max-width:\s*680px\)[\s\S]*\.vault-crack-route\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*680px\)[\s\S]*\.vault-brk-scene__status\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*680px\)[\s\S]*\.vault-mode-card\s*\{[\s\S]*min-height:\s*54px/);
    expect(styles).toMatch(/@media \(max-width:\s*680px\)[\s\S]*\.vault-target-card--empty\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*980px\)[\s\S]*\.vault-work-card--create\s*\{[\s\S]*grid-template-areas:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*980px\)[\s\S]*\.vault-secret-console,[\s\S]*\.vault-tuning-grid\s*\{[\s\S]*grid-area:\s*auto/);
    expect(styles).toMatch(/@media \(max-width:\s*980px\)[\s\S]*\.vault-secret-console\s*\{[\s\S]*"head"[\s\S]*"dossier"[\s\S]*"keys"/);
    expect(styles).toMatch(/@media \(max-width:\s*980px\)[\s\S]*\.vault-tuning-grid\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(styles).toMatch(/@media \(max-width:\s*980px\)[\s\S]*\.vault-key-grid--create\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*980px\)[\s\S]*\.vault-key-grid--create \.vault-field\s*\{[\s\S]*grid-column:\s*auto/);
    expect(styles).toMatch(/@media \(max-width:\s*680px\)[\s\S]*\.vault-bounty\s*\{[\s\S]*min-height:\s*40px/);
    expect(styles).toMatch(/@media \(max-width:\s*680px\)[\s\S]*\.vault-difficulty\s*\{[\s\S]*min-height:\s*40px/);
    expect(styles).toMatch(/@media \(max-width:\s*680px\)[\s\S]*\.vault-key-grid--create \.vault-key-slot\s*\{[\s\S]*min-height:\s*42px/);
    expect(styles).toMatch(/@media \(max-width:\s*680px\)[\s\S]*\.vault-key-grid--create \.vault-field \.vault-input \.semi-input\s*\{[\s\S]*font-size:\s*12px/);
    expect(styles).toMatch(/@media \(max-width:\s*680px\)[\s\S]*\.vault-bounty-strip\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*680px\)[\s\S]*\.vault-difficulty-strip\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*680px\)[\s\S]*\.vault-difficulty span\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*680px\)[\s\S]*\.unbreakable-vault-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex-basis:\s*184px/);
    const messages = fs.readFileSync(
      path.join(appsRoot, "unbreakable-vault/src/locale/messages.ts"),
      "utf8",
    );
    expect(messages).toContain('en: "Seal Vault"');
    expect(messages).not.toContain("Create Vault (bounty + hash)");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(/animation-duration:\s*0\.001ms/);
  });
});
