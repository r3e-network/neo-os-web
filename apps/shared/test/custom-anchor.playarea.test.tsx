import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../custom-anchor/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(k: string) { return k; }

function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    anchorAppId: "custom-anchor:team:nonce",
    anchorMode: 2,
    totalStaked: "42",
    rewardReserve: "3",
    userStake: "5",
    pendingRewards: "0.25",
    agentCount: 21,
    rewardPerNeo: "0.01",
    workflowStatus: "Ready",
    lastError: "",
    lastTxid: "",
    isLoading: false,
    submitting: false,
    neoCredit: "0",
    gasCredit: "0",
    dataStatus: "ready",
    creditStatus: "ready",
    networkStatus: "bound",
    storageStatus: "ready",
    pendingOperation: null,
    pendingState: "none",
    errorDetail: "",
    discoveredAnchors: [{ appId: "custom-anchor:alpha:001", mode: 2 }],
    ...o,
  };
  return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, createObservable(v)])) as ObservableState;
}

const appRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
  ? path.resolve(process.cwd(), "../custom-anchor")
  : path.resolve(process.cwd(), "apps/custom-anchor");

describe("custom-anchor PlayArea (v2)", () => {
  it("renders a function-first anchor workspace with bounded foreground art", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".anchor-workspace")).toBeTruthy();
    expect(container.querySelector(".anchor-console")).toBeTruthy();
    expect(container.querySelector(".anchor-control-deck")).toBeTruthy();
    expect(container.querySelector(".anchor-pass-card")).toBeTruthy();
    expect(container.querySelector(".anchor-stake-dial")).toBeTruthy();
    expect(container.querySelector(".anchor-stake-presets")).toBeTruthy();
    expect(container.querySelector(".anchor-console .anchor-input")).toBeFalsy();
    expect(container.querySelector(".anchor-route")).toBeTruthy();
    expect(container.querySelector(".anchor-visual__media")).toBeTruthy();
    expect(container.querySelector<HTMLImageElement>(".anchor-visual__image")?.src).toContain("custom-anchor-stage.webp");
    expect(container.querySelector('[aria-label="NEO token"]')).toBeTruthy();
    expect(container.querySelector(".mx2-score")).toBeNull();
    expect(container.querySelector(".mx2-action-rail__row")?.textContent).not.toContain("refreshStatus");
  });

  it("keeps stake payload correct while using the resource-led stake dial", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByRole } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(getByRole("radio", { name: /5 NEO/ }));
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);

    await waitFor(() =>
      expect(dispatch).toHaveBeenCalledWith("stake", {
        anchorAppId: "custom-anchor:team:nonce",
        amount: "5",
      }),
    );
  });

  it("keeps raw anchor and amount editing tucked inside the drawer", () => {
    const { container, getByRole } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".anchor-console .anchor-input--id")).toBeFalsy();
    expect(container.querySelector(".anchor-console .anchor-input--amount")).toBeFalsy();

    fireEvent.click(getByRole("button", { name: /discoverLabel/ }));
    expect(container.querySelectorAll(".anchor-drawer-tabs [role='tab']")).toHaveLength(4);
    expect(container.querySelectorAll(".anchor-drawer__panel")).toHaveLength(1);
    expect(container.querySelector(".anchor-drawer__panel--settings.mx2-open-panel.semi-card")).toBeTruthy();
    expect(container.querySelector(".anchor-drawer__panel--settings .anchor-field.mx2-open-field")).toBeTruthy();
    expect(container.querySelector(".anchor-drawer__panel--settings .mx2-open-field__control.anchor-input--id input.semi-input")).toBeTruthy();
    expect(container.querySelector(".anchor-drawer__panel--settings .mx2-open-field__control.anchor-input--amount input.semi-input")).toBeTruthy();
    expect(container.querySelector(".anchor-register-disclosure")).toBeNull();
  });

  it("keeps drawer NEO amount editing whole-number only", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByRole } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(getByRole("button", { name: /discoverLabel/ }));
    const amountInput = container.querySelector(".anchor-drawer__panel--settings .anchor-input--amount input.semi-input") as HTMLInputElement;
    expect(amountInput.inputMode).toBe("numeric");
    fireEvent.change(amountInput, { target: { value: "8.5" } });
    expect(amountInput.value).toBe("8");
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("stake", expect.objectContaining({ amount: "8" })));
  });

  it("keeps anchor registration as an advanced drawer mode", () => {
    const { container, getByRole } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    fireEvent.click(getByRole("button", { name: /discoverLabel/ }));
    expect(container.querySelector(".anchor-register textarea")).toBeNull();
    fireEvent.click(getByRole("tab", { name: /registerPanelLabel/ }));
    expect(container.querySelectorAll(".anchor-drawer__panel")).toHaveLength(1);
    expect(container.querySelector(".anchor-drawer__panel--register.mx2-open-panel.semi-card")).toBeTruthy();
    expect(container.querySelector(".anchor-drawer__notice.mx2-open-notice.semi-banner")).toBeTruthy();
    expect(container.querySelector(".anchor-mode.mx2-open-field .mx2-open-segmented")).toBeTruthy();
    expect(container.querySelector(".anchor-register .anchor-candidates-input textarea.semi-input-textarea")).toBeTruthy();
    expect(container.querySelector(".anchor-register-disclosure")).toBeNull();
  });

  it("turns the single primary action into recovery while a transaction is pending", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const pendingOperation = {
      version: 2,
      kind: "stake",
      stage: "stake",
      phase: "broadcast",
      network: "testnet",
      contractHash: "0xab079b4f9a0a2471d136392e25eb8e99898dcad0",
      aaCoreHash: "",
      walletHash: "0x6d0656f6dd91469db1c90cc1e574380613f43738",
      txid: `0x${"ab".repeat(32)}`,
      intent: { anchorAppId: "custom-anchor:team:nonce", amountBase: "1", beforeValue: "5", expectedValue: "6" },
      createdAt: 1,
      updatedAt: 2,
    };
    const { container, getByRole } = render(<PlayArea
      t={t}
      state={state({ pendingOperation, pendingState: "pending", lastTxid: pendingOperation.txid })}
      dispatch={dispatch}
    />);

    expect(container.querySelector(".anchor-pending")).toBeTruthy();
    expect(container.querySelector(".mx2-action-rail__row")?.textContent).not.toContain("withdrawAction");
    expect(container.querySelector(".mx2-action-rail__row")?.textContent).not.toContain("claimAction");
    fireEvent.click(getByRole("button", { name: "pendingCheck" }));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("recoverPending"));
    expect(dispatch).not.toHaveBeenCalledWith("stake", expect.anything());
  });

  it("shows unavailable credit as a secondary state instead of a fake zero balance", () => {
    const { container, getByRole } = render(<PlayArea
      t={t}
      state={state({ neoCredit: "—", gasCredit: "—", creditStatus: "unavailable" })}
      dispatch={vi.fn()}
    />);
    fireEvent.click(getByRole("button", { name: /discoverLabel/ }));
    fireEvent.click(getByRole("tab", { name: /docSafety/ }));
    expect(container.querySelector(".anchor-credit-unavailable")?.textContent).toContain("creditUnavailableTitle");
    expect(container.querySelector(".anchor-credit-card")).toBeNull();
  });

  it("keeps clearing an unbroadcast wallet rejection in the safety drawer", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const pendingOperation = {
      version: 2,
      kind: "stake",
      stage: "stake",
      phase: "attempted",
      network: "testnet",
      contractHash: "0xab079b4f9a0a2471d136392e25eb8e99898dcad0",
      aaCoreHash: "",
      walletHash: "0x6d0656f6dd91469db1c90cc1e574380613f43738",
      txid: "",
      intent: { anchorAppId: "custom-anchor:team:nonce", amountBase: "1", beforeValue: "5", expectedValue: "6" },
      createdAt: 1,
      updatedAt: 2,
    };
    const { getByRole } = render(<PlayArea
      t={t}
      state={state({ pendingOperation, pendingState: "attempted" })}
      dispatch={dispatch}
    />);
    fireEvent.click(getByRole("button", { name: /discoverLabel/ }));
    fireEvent.click(getByRole("tab", { name: /docSafety/ }));
    fireEvent.click(getByRole("button", { name: "pendingClearRejected" }));
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("clearUnbroadcastPending"));
  });

  it("keeps legacy backdrop art and default browser controls out of the PlayArea", () => {
    const styles = readFileSync(path.join(appRoot, "src/PlayArea.scss"), "utf8");
    const source = readFileSync(path.join(appRoot, "src/PlayArea.tsx"), "utf8");

    expect(styles).toContain('@use "@shared/components-react/v2/v2"');
    expect(styles).toMatch(/\.custom-anchor-play-area\s*\{[\s\S]*--mx2-stage-floor:\s*#ffffff/);
    expect(styles).toMatch(/\.anchor-workspace\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.anchor-workspace\s*\{[\s\S]*box-shadow:\s*none/);
    expect(styles).toMatch(/\.anchor-visual__media\s*\{[\s\S]*grid-template-rows:\s*minmax\(176px,\s*auto\) auto/);
    expect(styles).toMatch(/\.anchor-visual__image\s*\{[\s\S]*object-fit:\s*contain/);
    expect(styles).toMatch(/\.anchor-visual__image\s*\{[\s\S]*opacity:\s*1/);
    expect(styles).toMatch(/\.anchor-visual__image\s*\{[\s\S]*filter:\s*none/);
    expect(styles).toMatch(/\.anchor-visual__media::after\s*\{[\s\S]*content:\s*none/);
    expect(styles).toMatch(/\.anchor-visual__chip\s*\{[\s\S]*position:\s*relative/);
    expect(styles).toMatch(/\.anchor-pass-card,\n\.anchor-stake-dial,\n\.anchor-stake-presets button\s*\{[\s\S]*border-radius:\s*20px/);
    expect(styles).toMatch(/\.anchor-stake-dial__readout\s*\{[\s\S]*background:\s*var\(--mx2-brand-light\)/);
    expect(styles).toMatch(/\.anchor-stake-presets\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.anchor-console__mobile-art\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/\.custom-anchor-play-area \.mx2-action-rail,[\s\S]*\.custom-anchor-play-area \.mx2-drawer\s*\{[\s\S]*width:\s*min\(100%,\s*920px\)/);
    expect(styles).toMatch(/\.custom-anchor-play-area \.mx2-action-rail__row\s*\{[\s\S]*justify-content:\s*center/);
    expect(styles).toMatch(/\.custom-anchor-play-area \.mx2-action-rail__drawer-toggle\s*\{[\s\S]*margin-left:\s*0/);
    expect(styles).toMatch(/\.custom-anchor-play-area \.mx2-drawer__inner\s*\{[\s\S]*border-radius:\s*24px/);
    expect(styles).toMatch(/\.anchor-drawer-tabs\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.anchor-drawer-tabs button\s*\{[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\) auto/);
    expect(styles).toMatch(/\.anchor-drawer-tabs button\.is-active\s*\{[\s\S]*background:\s*var\(--mx2-brand-light\)/);
    expect(styles).toMatch(/\.anchor-drawer__panel\.mx2-open-panel\.semi-card\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.anchor-drawer__panel\.mx2-open-panel\.semi-card > \.semi-card-body\s*\{[\s\S]*display:\s*grid/);
    expect(styles).toMatch(/\.anchor-drawer__summary\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.anchor-credit-card\s*\{[\s\S]*background:\s*#fbfdff/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)\s*\{[\s\S]*\.custom-anchor-play-area \.mx2-score\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)\s*\{[\s\S]*\.custom-anchor-play-area \.mx2-action-rail\s*\{[\s\S]*margin-top:\s*8px/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)\s*\{[\s\S]*\.custom-anchor-play-area \.mx2-action-rail\s*\{[\s\S]*padding:\s*0 14px/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)\s*\{[\s\S]*\.custom-anchor-play-area \.mx2-action-rail__row\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)\s*\{[\s\S]*\.custom-anchor-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*grid-column:\s*1 \/ -1/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)\s*\{[\s\S]*\.custom-anchor-play-area \.mx2-action-rail__row \.mx2-btn--ghost:disabled\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)\s*\{[\s\S]*\.anchor-stake-presets\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)\s*\{[\s\S]*\.anchor-console__mobile-art\s*\{[\s\S]*display:\s*grid/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)\s*\{[\s\S]*\.anchor-console__mobile-art img\s*\{[\s\S]*height:\s*102px/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)\s*\{[\s\S]*\.anchor-route\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)\s*\{[\s\S]*\.anchor-insight,\n\s*\.anchor-visual\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*560px\)\s*\{[\s\S]*\.anchor-drawer-tabs\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).not.toMatch(/@media \(max-width:\s*560px\)[\s\S]*\.custom-anchor-play-area \.mx2-action-rail\s*\{[\s\S]*position:\s*fixed/);
    expect(styles).toMatch(/\.anchor-settings-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.35fr\) minmax\(132px,\s*0\.55fr\)/);
    expect(styles).toMatch(/\.anchor-drawer \.anchor-field\.mx2-open-field\s*\{[\s\S]*border-radius:\s*16px/);
    expect(styles).toMatch(/\.anchor-input\s*\{[\s\S]*border-bottom:\s*2px solid rgba\(59,\s*130,\s*246,\s*0\.16\)/);
    expect(styles).toMatch(/\.anchor-mode \.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*border-radius:\s*14px/);
    expect(styles).toMatch(/\.custom-anchor-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 176px/);
    expect(styles).not.toMatch(/\.custom-anchor-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*300px/);
    expect(styles).not.toMatch(/AI-generated scene backdrop|anchor-scene__backdrop|anchor-scene-art|backdrop-filter|radial-gradient/);
    expect(styles).not.toContain("background: linear-gradient(180deg, #fbfdff 0%, #f2fbff 100%)");
    expect(styles).not.toContain("anchor-stake-chip");
    expect(styles).not.toContain("anchor-pass,");
    expect(styles).not.toMatch(/anchor-register-disclosure/);
    expect(styles).not.toMatch(/anchor-status-line/);
    expect(styles).not.toMatch(/\.anchor-mode button\[data-active="true"\]/);
    expect(styles).not.toMatch(/\.anchor-visual__image\s*\{[\s\S]*object-fit:\s*cover/);
    expect(styles).not.toMatch(/\.anchor-visual__image\s*\{[\s\S]*filter:\s*saturate/);
    expect(source).toContain("custom-anchor-stage.webp");
    expect(source).toContain('from "@shared/components-react/v2/OpenUiLite"');
    expect(source).toContain('from "@shared/components-react/v2/PlayStage"');
    expect(source).not.toContain("anchor-scene__backdrop");
    expect(source).not.toContain("anchor-stake-chip");
  });

  it("has reduced-motion", () => {
    const styles = readFileSync(path.join(appRoot, "src/PlayArea.scss"), "utf8");
    expect(styles).toMatch(/prefers-reduced-motion/);
  });
});
