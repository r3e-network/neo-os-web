import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../time-capsule/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());

function appFile(file: string): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return readFileSync(path.join(appsRoot, "time-capsule", "src", file), "utf8");
}

function optionByText(container: HTMLElement, selector: string, text: string): HTMLElement {
  const option = Array.from(container.querySelectorAll<HTMLElement>(selector))
    .find((item) => item.textContent?.includes(text));
  expect(option).toBeTruthy();
  return option!;
}

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    title: "Time Capsule", subtitle: "Seal messages for the future.", vaultEyebrow: "Time Capsule",
    heroStageAlt: "Glass chamber", createCapsule: "Create Capsule", sealCapsuleCta: "Seal",
    creatingCapsule: "Sealing...", depositShortNote: "0.2 GAS refundable", messageStage: "Message core",
    messageStageCopy: "Stored locally", letterDockLabel: "Message dock", letterDockEmpty: "Message waiting.",
    letterDockCount: "{count} characters ready", capsuleBoardDraft: "Draft slot", capsuleBoardReadySeal: "Ready to seal",
    titleLabel: "Title", titlePlaceholder: "Capsule name", secretMessage: "Secret message",
    secretMessagePlaceholder: "Seal future message", daysShort: "D", timeLockStage: "Time lock",
    timeLockStageCopy: "Choose unlock", durationPresets: "Duration presets", decreaseLockDuration: "Decrease",
    increaseLockDuration: "Increase", unlockIn: "Lock duration", categoryLabel: "Category",
    categoryStageCopy: "Pick purpose", categoryPersonal: "Personal", categoryPersonalShort: "Me",
    categoryGiftShort: "Gift", categoryMemorialShort: "Memory", categoryAnnouncementShort: "News",
    categorySecretShort: "Secret", categoryPersonalHint: "For self", categoryGiftHint: "For someone",
    categoryMemorialHint: "Save memory", categoryAnnouncementHint: "Publish later", categorySecretHint: "Keep private",
    visibility: "Visibility", visibilityStageCopy: "Who can reveal", private: "Private", public: "Public",
    privateHint: "Only you", publicHint: "Anyone", sealPreview: "Seal preview", sealSettings: "Seal settings",
    sealSettingsCopy: "Tune only when needed.", drawerTitle: "Capsule controls", drawerSeal: "Seal",
    drawerCapsules: "Capsules", drawerPublic: "Public tips", drawerDeposit: "Deposit", yourCapsules: "Your capsules",
    noLocalCapsules: "No local capsules.", revealed: "Revealed", readyToOpen: "Ready to open", sealed: "Sealed",
    openAndReclaim: "Open · reclaim {amount} GAS", countdownDaysHours: "{days}d {hours}h remaining",
    countdownHoursMinutes: "{hours}h {minutes}m remaining", untitledCapsule: "Untitled",
    fishCandidatesHint: "Pick a capsule to tip.", fishCandidatesLoading: "Loading public capsules",
    fishCandidatesRefresh: "Refresh list", fishCandidatesEmpty: "No public capsules.", fishTipThis: "Tip",
    depositLabel: "Deposit", depositNote: "Refundable deposit.", withdrawCredit: "Withdraw credit",
    unavailableShort: "Unavailable", capsuleDataUnavailable: "Capsules could not be verified",
    capsuleDataUnavailableHint: "Retry later", publicDataUnavailable: "Public capsules could not be verified",
    publicDataUnavailableHint: "Retry later", creditDataUnavailable: "Balance unavailable",
    recoveryTitle: "Chain confirmation", transactionPending: "Waiting for confirmation",
    recoverTransaction: "Check transaction", recoveringTransaction: "Checking",
    recoveryStorageUnavailableTitle: "Recovery storage unavailable",
    recoveryStorageUnavailable: "Wallet writes are paused.",
  };
  const base = messages[key] ?? key;
  return params ? base.replace(/\{(\w+)\}/g, (_match, name) => String(params[name] ?? `{${name}}`)) : base;
}

function state(values: Partial<Record<string, unknown>> = {}): ObservableState {
  const defaults: Record<string, unknown> = {
    totalCapsules: 0, lockedCount: 0, revealedCount: 0, isLoading: false, isCreating: false,
    isProcessing: false, isBusy: false, canCreate: false, hasCredit: false, reusableCredit: "0",
    capsules: [], fishCandidates: [], isLoadingCandidates: false, isRecovering: false,
    capsulesSource: "chain", candidatesSource: "chain", creditSource: "chain",
    transactionNotice: "", pendingOperation: null, storageHealthy: true, newCapsule: {}, ...values,
  };
  return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, createObservable(value)]));
}

describe("Time Capsule PlayArea (capsule-first)", () => {
  it("uses the real bright chamber resource and no CSS/div-art lock scene", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    const image = container.querySelector<HTMLImageElement>(".capsule-scene__stage-image");
    expect(image).toBeTruthy();
    expect(image?.src).toContain("time-capsule-stage.webp");
    expect(container.querySelector(".capsule-scene__orbit")).toBeFalsy();
    expect(container.querySelector(".capsule-scene__lock-strip")).toBeFalsy();
    expect(container.querySelectorAll(".capsule-scene__hud span")).toHaveLength(3);
  });

  it("keeps only the letter and lock presets primary, then progressively reveals advanced fields", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const s = state();
    const { container } = render(<PlayArea t={t} state={s} dispatch={dispatch} />);
    expect(container.querySelector(".capsule-letter-card")).toBeTruthy();
    expect(container.querySelector(".capsule-lock-presets")).toBeTruthy();
    expect(container.querySelector(".capsule-category-grid")).toBeFalsy();
    expect(container.querySelector(".capsule-visibility")).toBeFalsy();

    fireEvent.change(container.querySelector(".capsule-input--title .semi-input") as HTMLInputElement, { target: { value: "My Capsule" } });
    fireEvent.change(container.querySelector(".capsule-input--textarea .semi-input-textarea") as HTMLTextAreaElement, { target: { value: "Hello future" } });
    fireEvent.click(optionByText(container, ".capsule-lock-presets .semi-radio-addon-buttonRadio", "365"));
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(optionByText(container, ".capsule-visibility .semi-radio-addon-buttonRadio", "Public"));
    fireEvent.click(optionByText(container, ".capsule-category-grid .semi-radio-addon-buttonRadio", "Gift"));

    await waitFor(() => expect(s.newCapsule.get()).toEqual({
      title: "My Capsule", content: "Hello future", days: "365", isPublic: true, category: 2,
    }));
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("createCapsule", expect.objectContaining({ title: "My Capsule", category: 2 })));
  });

  it("renders countdown/locked actions and never enables early opening", () => {
    const { container } = render(<PlayArea t={t} state={state({
      capsules: [{ id: "1", title: "Future", revealed: false, locked: true, unlockTime: Date.now() + 86_400_000, amount: "0.2" }],
      totalCapsules: 1,
    })} dispatch={vi.fn()} />);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(optionByText(container, ".capsule-drawer-tabs .semi-radio-addon-buttonRadio", "Capsules"));
    const button = container.querySelector<HTMLButtonElement>(".capsule-list__item .mx2-btn");
    expect(button?.disabled).toBe(true);
    expect(container.textContent).toContain("remaining");
  });

  it("distinguishes unreadable chain sources from real empty states", () => {
    const { container } = render(<PlayArea t={t} state={state({ capsulesSource: "failed", candidatesSource: "failed", creditSource: "failed" })} dispatch={vi.fn()} />);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(optionByText(container, ".capsule-drawer-tabs .semi-radio-addon-buttonRadio", "Capsules"));
    expect(container.textContent).toContain("Capsules could not be verified");
    fireEvent.click(optionByText(container, ".capsule-drawer-tabs .semi-radio-addon-buttonRadio", "Public tips"));
    expect(container.textContent).toContain("Public capsules could not be verified");
    fireEvent.click(optionByText(container, ".capsule-drawer-tabs .semi-radio-addon-buttonRadio", "Deposit"));
    expect(container.textContent).toContain("Balance unavailable");
  });

  it("surfaces a persisted transaction recovery action without claiming success", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByText } = render(<PlayArea t={t} state={state({
      pendingOperation: { kind: "create", txid: `0x${"1".repeat(64)}` },
      transactionNotice: "Waiting for confirmation",
    })} dispatch={dispatch} />);
    expect(container.querySelector(".capsule-recovery")).toBeTruthy();
    fireEvent.click(getByText("Check transaction"));
    expect(dispatch).toHaveBeenCalledWith("recoverPending");
  });

  it("pauses the single wallet action when durable recovery storage is unavailable", () => {
    const { container } = render(<PlayArea t={t} state={state({
      storageHealthy: false,
      newCapsule: { title: "Future", content: "Hello", days: "30", isPublic: false, category: 1 },
    })} dispatch={vi.fn()} />);

    expect(container.textContent).toContain("Recovery storage unavailable");
    expect(container.querySelector<HTMLButtonElement>(".mx2-btn--primary")?.disabled).toBe(true);
    expect(container.querySelectorAll(".mx2-action-rail__row > .mx2-btn--ghost")).toHaveLength(1);
  });

  it("pins the real asset, warm contrast, official GAS icon and reduced-motion fallback in source", () => {
    const source = appFile("PlayArea.tsx");
    const styles = appFile("PlayArea.scss");
    expect(source).toContain("time-capsule-stage.webp");
    expect(source).toContain('import { CoinArt } from "@shared/art"');
    expect(source).toContain("components-react/v2/OpenUiLite");
    expect(source).toContain("components-react/v2/PlayStage");
    expect(source).not.toContain('from "@shared/components-react/v2"');
    expect(source).toContain('<CoinArt variant="gas"');
    expect(source).not.toMatch(/assets\/tokens\/gas-icon/);
    expect(source).not.toContain("time-capsule-token-cutout.webp");
    expect(source).toContain('capsulesSource === "failed"');
    expect(source).toContain('dispatch("recoverPending")');
    expect(source).not.toContain("setTimeout(");
    expect(source).not.toContain("createPreview");
    expect(source).toContain('category="social"');
    expect(source).not.toMatch(/<(input|textarea|select)\b/);
    expect(styles).toMatch(/\.capsule-scene\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/capsule-scene__stage-image[\s\S]*aspect-ratio:\s*16\s*\/\s*9/);
    expect(styles).toMatch(/capsule-scene__hud span[\s\S]*background:\s*#f6fbf8/);
    expect(styles).toMatch(/capsule-letter-card[\s\S]*background:\s*#fffaf3/);
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(/animation-duration:\s*0\.001ms/);
    expect(styles).not.toContain("capsule-scene__orbit");
    expect(styles).not.toContain("capsule-scene__lock-strip");
  });
});
