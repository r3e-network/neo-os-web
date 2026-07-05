import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../breakup-contract/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

const translations: Record<string, string> = {
  active: "Active",
  broken: "Broken",
  builderStepPartner: "Partner and title",
  builderStepStake: "Stake and duration",
  builderStepTerms: "Terms and confirmation",
  builderTitle: "Build pact",
  contractTermsPlaceholder: "Optional notes",
  contractTitle: "A promise, on-chain",
  contractTitlePlaceholder: "Our covenant",
  contracts: "Contracts",
  createContract: "Create Contract",
  createHintPartner: "Partner slot empty",
  createHintReady: "Ready for wallet",
  daysSuffix: "Days",
  docSubtitle: "Stake-backed agreements",
  duration: "Duration",
  durationLabel: "Contract Duration",
  durationPlaceholder: "Days",
  heroTagStakeBacked: "Stake-backed",
  noContracts: "No contracts yet",
  noContractsHint: "Connect your wallet to load them.",
  pactPreview: "Live pact preview",
  pactPreviewPartner: "Partner address appears here",
  pactPreviewRule: "If the pact is honored, both stakes can be refunded.",
  pactPreviewTerms: "Only stake and duration are enforced on-chain.",
  pactPreviewUntitled: "Untitled pact",
  pactDetails: "Pact details",
  partner: "Partner",
  partnerAddress: "Partner Address",
  partnerPlaceholder: "Enter partner address",
  partnerTermsOffChain: "Only the stake and duration are on-chain.",
  pending: "Pending",
  preparingWallet: "Preparing wallet",
  refreshRecords: "Refresh contracts",
  stake: "Stake",
  stakeLabel: "Stake Amount",
  stakePlaceholder: "Amount in GAS",
  termsLabel: "Contract Terms",
  title: "Breakup Contract",
  titleLabel: "Contract Title",
  walletAction: "Wallet action",
};

function t(k: string) { return translations[k] ?? k; }

function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    contracts: [],
    contractCount: 0,
    activeCount: 0,
    pendingCount: 0,
    brokenCount: 0,
    isLoading: false,
    hasCredit: false,
    ...o,
  };
  return Object.fromEntries(Object.entries(base).map(([k, v]) => [k, createObservable(v)])) as ObservableState;
}

const appRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
  ? path.resolve(process.cwd(), "../breakup-contract")
  : path.resolve(process.cwd(), "apps/breakup-contract");

describe("breakup-contract PlayArea (v2)", () => {
  it("renders a function-first pact workspace with bounded foreground art", () => {
    const { container, getAllByText } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".breakup-scene")).toBeTruthy();
    expect(container.querySelector(".breakup-preview")).toBeTruthy();
    expect(container.querySelector(".breakup-composer")).toBeNull();
    expect(container.querySelector(".breakup-pact-console")).toBeTruthy();
    expect(container.querySelector(".breakup-status-card")).toBeTruthy();
    expect(container.querySelector(".breakup-summary-grid")).toBeTruthy();
    expect(container.querySelectorAll(".breakup-summary-card")).toHaveLength(3);
    expect(container.querySelector(".mx2-stage__scene input")).toBeFalsy();
    expect(container.querySelector(".mx2-stage__scene textarea")).toBeFalsy();
    expect(container.querySelector(".mx2-score")).toBeNull();
    expect(container.querySelector(".breakup-desk__media")).toBeTruthy();
    expect(container.querySelector(".breakup-desk__pact")).toBeTruthy();
    expect(container.querySelector<HTMLImageElement>(".breakup-desk__image")?.src).toContain("pact-table.webp");
    expect(getAllByText("Live pact preview").length).toBeGreaterThanOrEqual(1);
    expect(container.querySelector('[aria-label="Build pact"]')).toBeTruthy();

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    expect(container.querySelector(".breakup-drawer-tabs .mx2-open-segmented.semi-radioGroup")).toBeTruthy();
    expect(container.querySelectorAll(".breakup-drawer-tabs .semi-radio")).toHaveLength(2);
    expect(container.querySelector(".breakup-drawer__panel")?.getAttribute("data-mode")).toBe("setup");
    expect(container.querySelectorAll(".breakup-drawer-panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(container.querySelectorAll(".breakup-drawer-editor .breakup-field.mx2-open-field")).toHaveLength(5);
    expect(container.querySelectorAll(".breakup-preset-board--drawer .breakup-preset-group button")).toHaveLength(6);
    expect(container.querySelector(".breakup-drawer-editor .breakup-input--terms textarea.semi-input-textarea")).toBeTruthy();
    expect(container.querySelector(".breakup-drawer-editor h4")).toBeFalsy();
    fireEvent.click(container.querySelectorAll(".breakup-drawer-tabs .semi-radio")[1]);
    expect(container.querySelector(".breakup-drawer__panel")?.getAttribute("data-mode")).toBe("contracts");
  });

  it("keeps create payload correct while using the compact composer", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container, getByText } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.change(container.querySelector(".breakup-input--title input.semi-input") as Element, { target: { value: "Clean pact" } });
    fireEvent.change(container.querySelector(".breakup-input--partner input.semi-input") as Element, { target: { value: "NpartnerAddress123" } });
    fireEvent.click(getByText("5 GAS"));
    fireEvent.click(getByText("90 Days"));
    fireEvent.click(container.querySelector(".mx2-btn--primary") as Element);

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("createContract", {
      partnerAddress: "NpartnerAddress123",
      stakeAmount: "5",
      duration: "90",
      title: "Clean pact",
      terms: "",
    }));
  });

  it("keeps the stage clean instead of using dirty image-led backgrounds", () => {
    const styles = readFileSync(path.join(appRoot, "src/PlayArea.scss"), "utf8");
    const source = readFileSync(path.join(appRoot, "src/PlayArea.tsx"), "utf8");

    expect(styles).toContain('@use "@shared/components-react/v2/v2"');
    expect(styles).toMatch(/\.breakup-contract-play-area\s*\{[\s\S]*--mx2-stage-floor:\s*var\(--mx2-bg-2\)/);
    expect(styles).toMatch(/\.breakup-scene\s*\{[\s\S]*background:\s*var\(--mx2-bg-2\)/);
    expect(styles).toMatch(/\.breakup-scene\s*\{[\s\S]*box-shadow:\s*none/);
    expect(styles).toMatch(/\.breakup-scene\s*\{[\s\S]*width:\s*min\(1180px,\s*100%\)/);
    expect(styles).toMatch(/\.breakup-scene\s*\{[\s\S]*grid-template-columns:\s*minmax\(320px,\s*0\.72fr\) minmax\(540px,\s*1\.28fr\)/);
    expect(styles).toMatch(/\.breakup-desk\s*\{[\s\S]*grid-template-rows:\s*minmax\(270px,\s*auto\) auto auto auto/);
    expect(styles).toMatch(/\.breakup-desk__pact\s*\{[\s\S]*background:\s*#fffaf3/);
    expect(styles).toMatch(/\.breakup-desk__pact dl\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.1fr\) minmax\(92px,\s*0\.72fr\) minmax\(92px,\s*0\.72fr\)/);
    expect(styles).toMatch(/\.breakup-summary-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.breakup-summary-card\s*\{[\s\S]*background:\s*var\(--mx2-surface-2\)/);
    expect(styles).toMatch(/\.breakup-desk__image\s*\{[\s\S]*object-fit:\s*contain/);
    expect(styles).toMatch(/\.breakup-desk__image\s*\{[\s\S]*opacity:\s*1/);
    expect(styles).toMatch(/\.breakup-desk__image\s*\{[\s\S]*filter:\s*none/);
    expect(styles).toMatch(/\.breakup-desk__media::after\s*\{[\s\S]*content:\s*none/);
    expect(styles).toMatch(/\.breakup-desk__chip\s*\{[\s\S]*position:\s*relative/);
    expect(styles).toMatch(/\.breakup-pact-console\s*\{[\s\S]*display:\s*grid/);
    expect(styles).toMatch(/\.breakup-status-card\s*\{[\s\S]*background:\s*var\(--mx2-surface-2\)/);
    expect(styles).toMatch(/\.breakup-preset-group button\.is-selected\s*\{[\s\S]*background:\s*#fff7ed/);
    expect(styles).not.toContain(".breakup-composer");
    expect(styles).not.toContain(".breakup-signature-board");
    expect(styles).toContain(".breakup-preset-board");
    expect(styles).toMatch(/\.breakup-input\s*\{[\s\S]*border-bottom:\s*2px solid rgba\(180,\s*83,\s*9,\s*0\.18\)/);
    expect(styles).toMatch(/\.breakup-drawer-panel\.mx2-open-panel\.semi-card,[\s\S]*\.breakup-notices\.mx2-open-notice\.semi-banner\s*\{[\s\S]*border-radius:\s*18px/);
    expect(styles).toMatch(/\.breakup-drawer-tabs \.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.breakup-drawer-editor__grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.breakup-field \.mx2-open-field__control\s*\{[\s\S]*min-height:\s*40px/);
    expect(styles).toMatch(/\.breakup-field\.mx2-open-field--textarea \.mx2-open-field__control--textarea\s*\{[\s\S]*min-height:\s*78px/);
    expect(styles).toMatch(/\.breakup-field\.mx2-open-field--textarea \.mx2-open-field__control--textarea\s*\{[\s\S]*max-height:\s*104px/);
    expect(styles).toMatch(/\.breakup-field\.mx2-open-field--textarea \.mx2-open-field__control--textarea\s*\{[\s\S]*resize:\s*none/);
    expect(styles).not.toMatch(/\.breakup-drawer-editor h4\s*\{/);
    expect(styles).toMatch(/@media \(max-width: 900px\)[\s\S]*\.breakup-desk\s*\{[\s\S]*order:\s*-1/);
    expect(styles).toMatch(/@media \(max-width: 560px\)[\s\S]*\.breakup-contract-play-area \.mx2-stage\s*\{[\s\S]*padding:\s*14px 14px 16px/);
    expect(styles).toMatch(/@media \(max-width: 560px\)[\s\S]*\.breakup-preview\s*\{[\s\S]*order:\s*-2/);
    expect(styles).toMatch(/@media \(max-width: 560px\)[\s\S]*\.breakup-preview__terms,[\s\S]*\.breakup-preview__rule\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width: 560px\)[\s\S]*\.breakup-summary-grid\s*\{[\s\S]*gap:\s*7px/);
    expect(styles).toMatch(/@media \(max-width: 560px\)[\s\S]*\.breakup-status-card\s*\{[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\)/);
    expect(styles).toMatch(/@media \(max-width: 560px\)[\s\S]*\.breakup-status-card span\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width: 560px\)[\s\S]*\.breakup-desk\s*\{[\s\S]*grid-template-rows:\s*minmax\(108px,\s*auto\)/);
    expect(styles).toMatch(/@media \(max-width: 560px\)[\s\S]*\.breakup-desk__media,[\s\S]*\.breakup-desk__image\s*\{[\s\S]*min-height:\s*108px/);
    expect(styles).toMatch(/@media \(max-width: 560px\)[\s\S]*\.breakup-desk__chip,[\s\S]*\.breakup-desk__pact,[\s\S]*\.breakup-desk__pact em,[\s\S]*\.breakup-desk__signatures\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width: 560px\)[\s\S]*\.breakup-drawer-editor__grid\s*\{[\s\S]*background:\s*#fffaf3/);
    expect(styles).toMatch(/@media \(max-width: 560px\)[\s\S]*\.breakup-field--stake,[\s\S]*\.breakup-field--duration\s*\{[\s\S]*grid-column:\s*auto/);
    expect(styles).toMatch(/@media \(max-width: 560px\)[\s\S]*\.breakup-field \.mx2-open-field__control\s*\{[\s\S]*min-height:\s*36px/);
    expect(styles).toMatch(/@media \(max-width: 560px\)[\s\S]*\.breakup-preset-group > div\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.breakup-contract-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 218px/);
    expect(styles).toMatch(/\.breakup-contract-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*white-space:\s*nowrap/);
    expect(styles).not.toMatch(/backdrop-filter|breakup-scene-art|radial-gradient/);
    expect(styles).not.toMatch(/\.breakup-desk__image\s*\{[^}]*object-fit:\s*cover/);
    expect(styles).not.toMatch(/\.breakup-desk__image\s*\{[^}]*filter:\s*saturate/);
    expect(styles).not.toContain("font-size: clamp(");
    expect(styles).not.toMatch(/\.breakup-desk__chip\s*\{[^}]*position:\s*absolute/);
    expect(styles).not.toContain("rgba(255, 255, 255, 0.88)");
    expect(styles).not.toContain("linear-gradient(180deg, #fffdf8 0%, #fff7ed 100%)");
    expect(styles).not.toContain("linear-gradient(180deg, #fff7ed 0%, #fffbeb 100%)");
    expect(styles).not.toMatch(/\.breakup-contract-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*300px/);
    expect(source).toContain("pact-table.webp");
    expect(source).toContain("OpenUiSegmented");
    expect(source).not.toContain("score={[");
    expect(source).not.toContain("📜");
    expect(source).not.toContain("breakup-builder");
  });

  it("has reduced-motion", () => {
    const styles = readFileSync(path.join(appRoot, "src/PlayArea.scss"), "utf8");
    expect(styles).toMatch(/prefers-reduced-motion/);
  });
});
