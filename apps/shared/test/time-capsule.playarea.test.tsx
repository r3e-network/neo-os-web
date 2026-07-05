import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../time-capsule/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function playAreaStyles(app: string): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return readFileSync(path.join(appsRoot, app, "src/PlayArea.scss"), "utf8");
}
function playAreaSource(app: string): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return readFileSync(path.join(appsRoot, app, "src/PlayArea.tsx"), "utf8");
}
function optionByText(container: HTMLElement, selector: string, text: string): HTMLElement {
  const option = Array.from(container.querySelectorAll<HTMLElement>(selector)).find((item) => item.textContent?.includes(text));
  expect(option).toBeTruthy();
  return option as HTMLElement;
}

function t(key: string, params?: Record<string, string | number>) {
  const m: Record<string, string> = {
    title: "Time Capsule",
    subtitle: "Seal messages for the future.",
    vaultEyebrow: "Time Capsule",
    heroStageAlt: "Glass chamber",
    createCapsule: "Create Capsule",
    createCapsuleButton: "Seal",
    sealCapsuleCta: "Seal",
    creatingCapsule: "Sealing...",
    depositShortNote: "0.2 GAS refundable",
    sealWorkbenchCopy: "Load the capsule.",
    messageStage: "Message core",
    messageStageCopy: "Stored locally",
    letterDockLabel: "Message dock",
    letterDockKicker: "Letter loading",
    letterDockEmpty: "Message core waiting.",
    letterDockCount: "{count} characters ready",
    capsuleBoardDraft: "Draft slot",
    capsuleBoardReadySeal: "Ready to seal",
    titleLabel: "Title",
    titlePlaceholder: "Capsule name",
    secretMessage: "Secret message",
    secretMessagePlaceholder: "Seal future message",
    daysShort: "D",
    timeLockStage: "Time lock",
    timeLockStageCopy: "Choose unlock",
    durationPresets: "Duration presets",
    decreaseLockDuration: "Decrease",
    increaseLockDuration: "Increase",
    unlockIn: "Lock duration",
    categoryLabel: "Category",
    categoryStageCopy: "Pick purpose",
    categoryPersonal: "Personal",
    categoryPersonalShort: "Me",
    categoryGiftShort: "Gift",
    categoryMemorialShort: "Memory",
    categoryAnnouncementShort: "News",
    categorySecretShort: "Secret",
    categoryPersonalHint: "For self",
    categoryGiftHint: "For someone",
    categoryMemorialHint: "Save memory",
    categoryAnnouncementHint: "Publish later",
    categorySecretHint: "Keep private",
    visibility: "Visibility",
    visibilityStageCopy: "Who can reveal",
    private: "Private",
    public: "Public",
    privateHint: "Only you",
    publicHint: "Anyone",
    sealPreview: "Seal preview",
    sealSettings: "Seal settings",
    sealSettingsCopy: "Tune only when needed.",
    drawerTitle: "Capsule controls",
    drawerSeal: "Seal",
    drawerCapsules: "Capsules",
    drawerPublic: "Public tips",
    drawerDeposit: "Deposit",
    yourCapsules: "Your capsules",
    noLocalCapsules: "No local capsules.",
    locked: "Locked",
    revealed: "Revealed",
    unlocked: "Unlocked",
    open: "Open",
    untitledCapsule: "Untitled",
    fishCandidatesTitle: "Public capsules",
    fishCandidatesHint: "Pick a capsule to tip.",
    fishCandidatesLoading: "Loading public capsules",
    fishCandidatesRefresh: "Refresh list",
    fishCandidatesEmpty: "No public capsules.",
    fishTipThis: "Tip",
    depositLabel: "Deposit",
    depositNote: "Refundable deposit.",
    prepaidCreditLabel: "Credit",
    withdrawCredit: "Withdraw credit",
    collectTips: "Collect tips",
  };
  const base = m[key] ?? key;
  if (!params) return base;
  return base.replace(/\{(\w+)\}/g, (_m, name: string) =>
    params[name] !== undefined ? String(params[name]) : `{${name}}`,
  );
}

function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  const b: Record<string, unknown> = {
    totalCapsules: 0,
    lockedCount: 0,
    revealedCount: 0,
    isLoading: false,
    isCreating: false,
    isProcessing: false,
    isBusy: false,
    canCreate: false,
    hasCredit: false,
    reusableCredit: "0",
    capsules: [],
    fishCandidates: [],
    isLoadingCandidates: false,
    newCapsule: {},
    ...o,
  };
  return Object.fromEntries(Object.entries(b).map(([k, v]) => [k, createObservable(v)]));
}

describe("Time Capsule PlayArea (scene-led)", () => {
  it("renders the resource-based vault stage without the old fake envelope", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".capsule-scene__backdrop-art")).toBeFalsy();
    expect(container.querySelector(".capsule-scene__token")).toBeTruthy();
    expect(container.querySelector(".capsule-scene__hud")).toBeTruthy();
    expect(container.querySelectorAll(".capsule-scene__hud span")).toHaveLength(3);
    expect(container.querySelector(".capsule-scene__message-card")).toBeFalsy();
    expect(container.querySelector(".capsule-scene__envelope")).toBeFalsy();
    expect(container.textContent).not.toContain("🔒");
  });

  it("syncs the draft to newCapsule and dispatches the complete create payload", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const s = state();
    const { container } = render(<PlayArea t={t} state={s} dispatch={dispatch} />);

    const titleInput = container.querySelector(".capsule-input--title .semi-input") as HTMLInputElement;
    const messageInput = container.querySelector(".capsule-input--textarea .semi-input-textarea") as HTMLTextAreaElement;
    fireEvent.change(titleInput, { target: { value: "My Capsule" } });
    fireEvent.change(messageInput, { target: { value: "Hello future" } });
    fireEvent.click(optionByText(container, ".capsule-visibility--compact .semi-radio-addon-buttonRadio", "Public"));
    fireEvent.click(optionByText(container, ".capsule-lock-presets .semi-radio-addon-buttonRadio", "365"));
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.click(optionByText(container, ".capsule-category-grid .semi-radio-addon-buttonRadio", "Gift"));

    await waitFor(() =>
      expect(s.newCapsule.get()).toEqual({
        title: "My Capsule",
        content: "Hello future",
        days: "365",
        isPublic: true,
        category: 2,
      }),
    );

    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);
    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith(
        "createCapsule",
        expect.objectContaining({
          title: "My Capsule",
          content: "Hello future",
          days: "365",
          isPublic: true,
          category: 2,
        }),
      ),
    );
  });

  it("shows an immediate sealing state while the wallet flow starts", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    const titleInput = container.querySelector(".capsule-input--title .semi-input") as HTMLInputElement;
    const messageInput = container.querySelector(".capsule-input--textarea .semi-input-textarea") as HTMLTextAreaElement;

    fireEvent.change(titleInput, { target: { value: "Signal" } });
    fireEvent.change(messageInput, { target: { value: "Do not forget this." } });
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);

    expect(container.querySelector(".capsule-scene")?.getAttribute("data-state")).toBe("sealing");
    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1));
  });

  it("keeps history and public tipping in the drawer", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByText } = render(
      <PlayArea
        t={t}
        state={state({
          capsules: [{ id: "1", title: "Cap", revealed: true }],
          fishCandidates: [{ id: "7", title: "Public Cap", unlockTime: Date.now() + 1000 }],
          totalCapsules: 1,
          revealedCount: 1,
        })}
        dispatch={dispatch}
      />,
    );

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.querySelector(".capsule-drawer-tabs")).toBeTruthy();
    expect(container.querySelectorAll(".capsule-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(container.querySelector(".capsule-drawer__section")).toBeFalsy();
    expect(container.querySelector(".capsule-drawer h4")).toBeFalsy();
    expect(container.querySelector(".capsule-drawer__panel-body")?.getAttribute("data-mode")).toBe("settings");
    expect(container.textContent).not.toContain("Public Cap");
    expect(container.querySelector(".capsule-list__item")).toBeFalsy();

    fireEvent.click(optionByText(container, ".capsule-drawer-tabs .semi-radio-addon-buttonRadio", "Capsules"));
    expect(container.querySelector(".capsule-drawer__panel-body")?.getAttribute("data-mode")).toBe("capsules");
    expect(container.textContent).toContain("Cap");
    expect(container.querySelector(".capsule-list__item")).toBeTruthy();

    fireEvent.click(optionByText(container, ".capsule-drawer-tabs .semi-radio-addon-buttonRadio", "Public tips"));
    expect(container.querySelector(".capsule-drawer__panel-body")?.getAttribute("data-mode")).toBe("public");
    expect(container.textContent).toContain("Public Cap");

    fireEvent.click(getByText("Tip"));
    expect(dispatch).toHaveBeenCalledWith("fishCapsule", "7");

    fireEvent.click(optionByText(container, ".capsule-drawer-tabs .semi-radio-addon-buttonRadio", "Deposit"));
    expect(container.querySelector(".capsule-drawer__panel-body")?.getAttribute("data-mode")).toBe("deposit");
  });

  it("keeps advanced seal settings out of the first screen", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".capsule-message-dock")).toBeTruthy();
    expect(container.querySelector(".capsule-letter-card")).toBeTruthy();
    expect(container.querySelector(".capsule-letter-card__surface")).toBeTruthy();
    expect(container.querySelector(".capsule-lock-presets")).toBeTruthy();
    expect(container.querySelector(".capsule-visibility--compact")).toBeTruthy();
    expect(container.querySelector(".capsule-letter-card__meta")).toBeTruthy();
    expect(container.querySelector(".capsule-seal-summary")).toBeTruthy();
    expect(container.querySelector(".capsule-category-grid")).toBeFalsy();
    expect(container.querySelector(".mx2-score")).toBeFalsy();

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.querySelector(".capsule-category-grid")).toBeTruthy();
    expect(container.querySelector(".capsule-visibility")).toBeTruthy();
  });

  it("has reduced-motion fallback", () => {
    const s = playAreaStyles("time-capsule");
    expect(s).toContain("@media (prefers-reduced-motion: reduce)");
    expect(s).toMatch(/animation-duration:\s*0\.001ms/);
  });

  it("keeps the chamber art quiet so the capsule and form controls stay foregrounded", () => {
    const s = playAreaStyles("time-capsule");
    const source = playAreaSource("time-capsule");

    expect(s).not.toContain("capsule-scene__backdrop-art");
    expect(s).not.toContain("capsule-scene__wash");
    expect(s).not.toContain("capsule-scene__beam");
    expect(s).not.toContain("capsule-scene__message-card");
    expect(s).toMatch(/\.capsule-scene\s*\{[\s\S]*background:\s*var\(--mx2-surface-2\)/);
    expect(s).toMatch(/capsule-scene__orbit[\s\S]*opacity:\s*0\.12/);
    expect(s).toMatch(/capsule-scene__hud\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/capsule-scene__hud span\s*\{[\s\S]*background:\s*rgba\(255,\s*255,\s*255,\s*0\.92\)/);
    expect(s).not.toContain("backdrop-filter");
    expect(s).toMatch(/capsule-message-dock[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/capsule-letter-card[\s\S]*min-height:\s*176px/);
    expect(s).toMatch(/capsule-letter-card[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/capsule-letter-card__surface[\s\S]*grid-template-rows:\s*auto minmax\(66px,\s*1fr\)/);
    expect(s).toMatch(/\.time-capsule-play-area \.mx2-score\s*\{[\s\S]*display:\s*none/);
    expect(source).toContain("OpenUiSegmented");
    expect(source).toContain("OpenUiTextField");
    expect(source).toContain("OpenUiTextArea");
    expect(source).not.toMatch(/<(input|textarea|select)\b/);
    expect(source).not.toContain('role="radio"');
    expect(source).not.toContain('role="tab"');
    expect(s).toMatch(/capsule-drawer-tabs__group\.mx2-open-segmented\.semi-radioGroup[\s\S]*display:\s*grid/);
    expect(s).toMatch(/capsule-drawer-tabs__group\.mx2-open-segmented\.semi-radioGroup[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/capsule-drawer-tabs \.semi-radio-addon-buttonRadio[\s\S]*min-height:\s*54px/);
    expect(s).toMatch(/capsule-drawer-tab strong[\s\S]*font-size:\s*0\.7rem/);
    expect(s).toMatch(/capsule-drawer-tabs \.semi-radio-checked[\s\S]*background:\s*var\(--mx2-brand-light\)/);
    expect(s).toMatch(/capsule-drawer__panel\.mx2-open-panel\.semi-card[\s\S]*border-radius:\s*18px/);
    expect(s).toMatch(/capsule-drawer__panel-body[\s\S]*display:\s*grid/);
    expect(s).not.toContain("capsule-drawer-tabs em");
    expect(s).not.toContain("capsule-drawer__section h4");
    expect(s).toMatch(/capsule-lock-presets__group\.mx2-open-segmented\.semi-radioGroup[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/capsule-lock-presets \.semi-radio-checked[\s\S]*background:\s*var\(--mx2-brand-light\)/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.time-capsule-play-area \.mx2-stage\s*\{[\s\S]*padding:\s*14px 14px 16px/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.capsule-stage-stack\s*\{[\s\S]*gap:\s*10px/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.capsule-scene\s*\{[\s\S]*min-height:\s*252px/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.capsule-scene__token\s*\{[\s\S]*height:\s*134px/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.capsule-scene__hud span\s*\{[\s\S]*min-height:\s*36px/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.capsule-letter-card\s*\{[\s\S]*min-height:\s*124px/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.capsule-letter-card__surface\s*\{[\s\S]*grid-template-rows:\s*auto minmax\(42px,\s*1fr\)/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.capsule-lock-presets \.capsule-lock-presets__group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*overflow-x:\s*auto/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.capsule-lock-presets \.semi-radio\s*\{[\s\S]*flex:\s*1 0 72px/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.capsule-drawer-tab strong\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.capsule-seal-summary\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/capsule-visibility \.capsule-visibility__group\.mx2-open-segmented\.semi-radioGroup[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).not.toContain("repeating-linear-gradient(180deg, transparent 0 30px");
    expect(s).not.toContain("linear-gradient(180deg, #ecfdf5, #fff7ed)");
    expect(s).not.toContain("capsule-beam-breathe");
    expect(s).not.toContain("font-size: clamp(");
    expect(s).toMatch(/capsule-input--title[\s\S]*background:\s*transparent/);
    expect(s).toMatch(/capsule-input--textarea[\s\S]*resize:\s*none/);
    expect(s).toMatch(/capsule-input--textarea[\s\S]*min-height:\s*68px/);
    expect(s).toMatch(/capsule-quick-seal[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/capsule-quick-seal[\s\S]*grid-template-areas:[\s\S]*"head summary"[\s\S]*"locks locks"[\s\S]*"visibility visibility"/);
    expect(s).toMatch(/capsule-seal-summary span[\s\S]*gap:\s*5px/);
    expect(s).toMatch(/@keyframes capsule-letter-card-seal/);
    expect(s).toMatch(/\.time-capsule-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 190px/);
    expect(s).not.toContain("capsule-input {\n  width: 100%;\n  border: 1.5px solid rgba(70, 160, 147, 0.25);");
    expect(s).not.toMatch(/capsule-(lock-presets|chip-row|category-grid|visibility|drawer-tabs) button/);
  });
});
