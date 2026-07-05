import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../aa-relay-console/src/PlayArea";
(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
function t(k: string) {
  const messages: Record<string, string> = {
    aaCoreLabel: "AA Core",
    aaAddress: "AA Address",
    aaAddressHint: "This route key opens sponsor checks and relay broadcast.",
    aaAddressPlaceholder: "N...",
    dappId: "dApp ID",
    dappIdHint: "Optional app route for sponsor policy checks.",
    dappIdPlaceholder: "miniapp-id",
    network: "Network",
    notAvailable: "not available",
    payloadJson: "Relay Payload JSON",
    payloadJsonPlaceholder: "{\"scriptHash\":\"...\",\"operation\":\"transfer\"}",
    payloadInvalid: "Fix the JSON payload before submitting it to the relayer.",
    relayAccountEyebrow: "Account routing",
    relayAccountCapsule: "AA account capsule",
    relayAccountWaiting: "Route key waiting",
    relayAccountReady: "Route key locked",
    relayAccountCapsuleHint: "Attach an account to open the relay line.",
    relayBoardAA: "AA account",
    relayBoardDraft: "Attach an AA account to open the relay line.",
    relayBoardKicker: "Relay line",
    relayBoardPaymaster: "Paymaster",
    relayBoardPayload: "Payload",
    relayCommandTitle: "Sponsor Preflight",
    relayEndpointMetric: "Relay Endpoint",
    relayFlowLabel: "AA relay workflow",
    relayMetricsLabel: "Relay environment summary",
    relayNeedsAA: "AA capsule waiting",
    relayNeedsPayload: "Payload packet needs JSON",
    relayPayloadReady: "Relay payload is readable",
    relayRiskCopy: "The console keeps dapp id optional, but blocks empty AA addresses and invalid JSON before a relayed write.",
    relayBlocked: "Account capsule and payload packet gate the broadcast.",
    relaySubmitExplainer: "Submit sends the payload to a relayer that broadcasts the transaction on-chain on the account's behalf.",
    relaySubmitTitle: "Relay packet ready",
    relayStageKicker: "Paymaster relay",
    relayStageTitle: "Sponsor GAS, validate the AA payload, then hand the transaction to the relayer.",
    relayStationCaption: "Paymaster coverage, AA identity, and payload broadcast stay on one guarded desk.",
    relayStationLabel: "Relay station",
    relayStateLabel: "Relay Runtime",
    relayStateTitle: "Sponsorship state",
    relayHeroTitle: "Sponsored relay desk for AA payloads",
    relayTxLabel: "On-chain transaction",
    sponsorCheck: "Check Sponsorship",
    sponsorAmount: "Sponsor Amount",
    sponsorAmountHint: "GAS requested for the sponsored relay.",
    sponsorAmountPlaceholder: "0.1",
    sponsorDirectionNote: "Run sponsor checks before submitting a paid relay.",
    sponsorRequest: "Request Sponsorship",
    submitRelay: "Submit Relay Payload",
    unset: "unset",
  };
  return messages[k] ?? k;
}
function state(o: Partial<Record<string, unknown>> = {}): ObservableState { return Object.fromEntries(Object.entries(o).map(([k, v]) => [k, createObservable(v)])) as ObservableState; }
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
describe("aa-relay-console PlayArea (v2)", () => {
  it("renders a foreground relay board instead of a backdrop desk", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".relay-scene__board")).toBeTruthy();
    expect(container.querySelector(".relay-scene__account-panel")).toBeTruthy();
    expect(container.querySelector(".relay-scene__account-capsule")).toBeTruthy();
    expect(container.querySelector(".relay-scene__account-orb")).toBeTruthy();
    expect(container.querySelector(".relay-scene__mode-strip-group.mx2-open-segmented.semi-radioGroup")).toBeTruthy();
    expect(container.querySelectorAll(".relay-scene__mode-chip")).toHaveLength(3);
    expect(container.querySelectorAll(".relay-scene__mode-strip-group .semi-radio")).toHaveLength(3);
    expect(container.querySelectorAll('.relay-scene__mode-strip [role="tab"]')).toHaveLength(0);
    expect(container.querySelector(".relay-scene__account-input")).toBeNull();
    expect(container.querySelector(".relay-scene__station-card")).toBeTruthy();
    expect(container.querySelector<HTMLImageElement>(".relay-scene__station-card img")?.getAttribute("src")).toBe("aa-relay-station.webp");
    expect(container.querySelector(".relay-scene__line-card")).toBeTruthy();
    expect(container.querySelector(".relay-scene__track")).toBeTruthy();
    expect(container.querySelector(".relay-scene__state-card")).toBeTruthy();
    expect(container.querySelectorAll(".relay-scene__node")).toHaveLength(3);
    expect(container.querySelectorAll(".relay-scene__node-icon svg")).toHaveLength(3);
    expect(container.querySelector(".relay-scene__backdrop")).toBeFalsy();
    expect(container.textContent).toContain("Route key waiting");
    expect(container.textContent).toContain("Account capsule and payload packet gate the broadcast.");
    expect(container.textContent).not.toContain("Enter an AA address");
    expect(container.textContent).not.toMatch(/[📡⛽🚀]/u);
  });

  it("requires an AA address before submit relay dispatches", async () => {
    vi.useFakeTimers();
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    const submit = screen.getByRole("button", { name: /Submit Relay Payload/ });

    expect((submit as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
    fireEvent.change(container.querySelector(".relay-drawer__field .mx2-open-field__control input.semi-input") as Element, {
      target: { value: "NZTbZjNcFVb5AkVVTT8knybCuhPhSmBCEH" },
    });
    expect((submit as HTMLButtonElement).disabled).toBe(false);
    expect(document.querySelector(".relay-scene__account-capsule[data-ready='true']")).toBeTruthy();
    expect(screen.getByText("Route key locked")).toBeTruthy();

    fireEvent.click(submit);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1300);
    });

    expect(dispatch).toHaveBeenCalledWith("submitRelay", "NZTbZjNcFVb5AkVVTT8knybCuhPhSmBCEH", "", "{}");
  });

  it("keeps relay command controls in one tabbed drawer panel at a time", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);

    expect(container.querySelector(".relay-drawer-tabs__group.mx2-open-segmented.semi-radioGroup")).toBeTruthy();
    expect(container.querySelectorAll(".relay-drawer-tabs__group .semi-radio")).toHaveLength(3);
    expect(container.querySelectorAll('.relay-drawer-tabs [role="tab"]')).toHaveLength(0);
    expect(container.querySelector(".relay-drawer__panel-shell")?.getAttribute("data-mode")).toBe("route");
    expect(container.querySelectorAll(".relay-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(container.querySelector(".relay-drawer__panel--route")).toBeTruthy();
    expect(container.querySelectorAll(".relay-drawer__field.mx2-open-field")).toHaveLength(2);
    expect(container.querySelectorAll(".relay-drawer__field .mx2-open-field__control input.semi-input")).toHaveLength(2);
    expect(container.querySelector(".relay-drawer__facts")).toBeTruthy();
    const tabs = container.querySelectorAll(".relay-drawer-tabs__group .semi-radio");
    fireEvent.click(tabs[1]);
    expect(container.querySelector(".relay-drawer__panel-shell")?.getAttribute("data-mode")).toBe("sponsor");
    expect(container.querySelectorAll(".relay-drawer__field .mx2-open-field__control input.semi-input")).toHaveLength(1);
    expect(container.querySelectorAll(".relay-drawer__row .mx2-btn.mx2-btn--ghost")).toHaveLength(2);
    fireEvent.click(tabs[2]);
    expect(container.querySelector(".relay-drawer__panel-shell")?.getAttribute("data-mode")).toBe("payload");
    expect(container.querySelector(".mx2-open-field__control--textarea textarea.semi-input-textarea")).toBeTruthy();
    expect(container.querySelector(".relay-drawer__payload.mx2-open-field--compact")).toBeTruthy();
    expect(container.querySelector(".relay-drawer__notice.mx2-open-notice.semi-banner")).toBeTruthy();
    expect(container.querySelector(".relay-drawer__section")).toBeNull();
    expect(container.querySelector(".relay-drawer__note")).toBeNull();
    expect(container.querySelector(".relay-drawer h4")).toBeNull();
  });

  it("keeps the scene background clean and motion-accessible", () => {
    const s = playAreaStyles("aa-relay-console");
    const source = playAreaSource("aa-relay-console");

    expect(s).toMatch(/prefers-reduced-motion/);
    expect(s).toMatch(/\.relay-scene\s*\{[\s\S]*background:\s*#ffffff/);
    expect(s).toMatch(/\.relay-scene__board\s*\{[\s\S]*grid-template-columns/);
    expect(s).toMatch(/\.relay-scene__account-panel\s*\{[\s\S]*min-height:\s*176px/);
    expect(s).toMatch(/\.relay-scene__station-card\s*\{[\s\S]*grid-column:\s*1 \/ 4/);
    expect(s).toMatch(/\.relay-scene__station-card img\s*\{[\s\S]*object-fit:\s*cover/);
    expect(s).toMatch(/\.relay-scene__account-capsule\s*\{[\s\S]*grid-template-columns:\s*auto minmax\(0,\s*1fr\)/);
    expect(s).toMatch(/\.relay-scene__account-copy small\s*\{[\s\S]*white-space:\s*normal/);
    expect(s).toMatch(/\.relay-scene__mode-strip-group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*display:\s*grid/);
    expect(s).toMatch(/\.relay-scene__mode-chip\s*\{[\s\S]*min-height:\s*34px/);
    expect(s).not.toMatch(/relay-scene__account-input/);
    expect(s).toMatch(/\.relay-scene__line-card\s*\{[\s\S]*background:\s*var\(--mx2-surface-2\)/);
    expect(s).toMatch(/\.relay-scene__track\s*\{[\s\S]*display:\s*grid/);
    expect(s).toMatch(/\.relay-scene__node-icon\s*\{[\s\S]*display:\s*grid/);
    expect(s).toMatch(/\.relay-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 190px/);
    expect(s).toMatch(/\.relay-play-area \.mx2-action-rail__row \.mx2-btn--primary:not\(:disabled\)\s*\{[\s\S]*background:\s*var\(--mx2-brand-hover\)/);
    expect(s).toMatch(/\.relay-play-area \.mx2-action-rail__row \.mx2-btn--primary:disabled\s*\{[\s\S]*background:\s*var\(--mx2-surface-hover\)/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.relay-scene__station-card\s*\{[\s\S]*height:\s*92px/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.relay-scene__account-panel > p\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.relay-scene__state-card small\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/\.relay-play-area \.mx2-score\s*\{[\s\S]*display:\s*none/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.relay-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex-basis:\s*184px/);
    expect(s).toMatch(/\.relay-drawer-tabs__group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.relay-drawer__panel--route > \.semi-card-body\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.relay-drawer__facts\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(s).toMatch(/\.relay-drawer \.mx2-open-panel__copy span\s*\{[\s\S]*white-space:\s*normal/);
    expect(s).toMatch(/\.relay-drawer__row \.mx2-btn\s*\{[\s\S]*min-height:\s*38px/);
    expect(s).toMatch(/\.relay-drawer__payload\.mx2-open-field--textarea \.mx2-open-field__control--textarea\s*\{[\s\S]*resize:\s*none/);
    expect(s).toMatch(/\.relay-drawer__notice\s*\{[\s\S]*min-height:\s*72px/);
    expect(s).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.relay-drawer__panel--route > \.semi-card-body,[\s\S]*\.relay-drawer__facts\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(s).toMatch(/@keyframes relay-line-flow/);
    expect(source).toContain("OpenUiSegmented");
    expect(source).not.toContain('role="tablist"');
    expect(source).not.toContain('role="tab"');
    expect(s).not.toMatch(/[📡⛽🚀]/u);
    expect(s).not.toMatch(/relay-scene__backdrop|relay-drawer__section|relay-drawer__note|& textarea|background-image:\s*url|var\(--mx2-scene-wash/);
  });
});
