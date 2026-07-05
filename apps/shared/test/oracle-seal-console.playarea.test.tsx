import { readFileSync } from "node:fs";
import React from "react";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../oracle-seal-console/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    statusReady: "Ready",
    digestPlaceholder: "-",
    panelTitle: "Request Envelope Reference Builder",
    panelEyebrow: "Oracle request envelope reference",
    sealHeroCopy: "Prepare a plain reference envelope.",
    sealComposerTitle: "Reference package",
    sealPlan: "Reference plan",
    sealValidationReady: "Reference ready",
    sealPayloadStateInvalid: "Needs repair",
    sealPurposeTitle: "Envelope purpose",
    purposeInput: "Oracle input",
    purposeInputHint: "Reference data intended for an oracle request.",
    purposeCallback: "Callback secret",
    purposeCallbackHint: "Route-bound value, still not encrypted here.",
    purposeAttestation: "Attestation",
    purposeAttestationHint: "Package claim metadata for later review.",
    sealRecipientTitle: "Recipient or route",
    recipientPlaceholder: "Enter recipient or oracle route",
    sealPayloadTitle: "Payload reference",
    payloadPlaceholder: "Paste JSON",
    sealPayloadStateReady: "Valid JSON",
    payloadReadyHint: "JSON is valid.",
    payloadInvalidHint: "Fix JSON.",
    sealPayloadChars: "{count} chars",
    sealStageTitle: "Envelope workbench",
    sealReferenceOnly: "Reference only",
    purpose: "Purpose",
    recipient: "Recipient",
    statDigest: "Checksum",
    sealEmptyTitle: "Build a reference receipt",
    protectionValue: "Not encrypted - reference checksum only",
    sealProtectionCopy: "Checksum reference only.",
    sealReceipt: "Envelope receipt",
    sealEmptyCopy: "The receipt will show protection truth.",
    sealFlowTitle: "Envelope reference flow",
    sealFlowPlain: "Plain reference",
    sealFlowPlainDesc: "Checksum only, no encryption.",
    sealFlowRoute: "Route context",
    sealFlowRouteDesc: "Purpose and recipient bind the preview.",
    sealFlowChecksum: "Checksum receipt",
    sealFlowChecksumDesc: "Copy metadata for downstream review.",
    statRequests: "Envelopes",
    lastStatus: "Last Status",
    statEndpoint: "Mode",
    runAction: "Build Reference",
    reset: "Reset",
    sealBuildActionActive: "Building Reference",
    payloadValid: "Payload is valid JSON",
    protectionLabel: "Protection",
    yes: "Yes",
    no: "No",
  };
  return (messages[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => String(params?.[name] ?? ""));
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    networkLabel: "Morpheus Mainnet",
    endpointLabel: "Envelope reference",
    lastStatus: "Ready",
    lastDigest: "-",
    requestCount: 0,
    ...overrides,
  };

  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  ) as ObservableState;
}

describe("oracle-seal-console PlayArea", () => {
  it("renders a foreground-led reference workspace instead of a dirty backdrop scene", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".seal-workspace")).toBeTruthy();
    expect(container.querySelector(".seal-envelope")).toBeTruthy();
    expect(container.querySelector(".seal-builder")).toBeTruthy();
    expect(container.querySelector(".seal-source-summary")).toBeTruthy();
    expect(container.querySelector(".seal-source-summary__card")).toBeTruthy();
    expect(container.querySelector(".seal-source-panel")).toBeFalsy();
    expect(container.querySelector(".seal-builder input:not([type='radio'])")).toBeFalsy();
    expect(container.querySelector(".seal-builder textarea")).toBeFalsy();
    expect(container.querySelector(".oracle-console-scene")).toBeFalsy();
    expect(container.querySelector(".oracle-console-scene__backdrop")).toBeFalsy();

    const image = container.querySelector(".seal-preview__image") as HTMLImageElement | null;
    expect(image?.src).toContain("seal-reference-stage.webp");
    expect(container.querySelectorAll(".seal-envelope__lane")).toHaveLength(3);
    expect(container.querySelector(".seal-purpose__options-group.mx2-open-segmented.semi-radioGroup")).toBeTruthy();
    expect(container.querySelectorAll(".seal-purpose__options-group .semi-radio")).toHaveLength(3);
    expect(container.querySelectorAll(".seal-purpose__options-group .semi-radio-checked")).toHaveLength(1);
    expect(container.querySelectorAll(".seal-purpose__option-icon svg")).toHaveLength(3);
    expect(container.querySelectorAll(".seal-field.mx2-open-field")).toHaveLength(0);
    expect(container.querySelector(".seal-purpose__active-hint")?.textContent).toContain("Reference data intended for an oracle request.");
    expect(container.querySelector(".seal-purpose em")).toBeFalsy();
    expect(container.textContent).toContain("Not encrypted - reference checksum only");
  });

  it("uses Open UI panels for receipt details instead of local drawer cards", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as HTMLButtonElement);

    expect(container.querySelector(".seal-drawer__switcher-group.mx2-open-segmented.semi-radioGroup")).toBeTruthy();
    expect(container.querySelectorAll(".seal-drawer__switcher-group .semi-radio")).toHaveLength(3);
    expect(container.querySelectorAll('.seal-drawer__switcher [role="tab"]')).toHaveLength(0);
    expect(container.querySelectorAll(".seal-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(container.querySelector(".seal-drawer__empty.mx2-open-notice.semi-banner")).toBeTruthy();
    expect(container.querySelector(".seal-drawer__head")).toBeNull();
    expect(container.querySelectorAll(".seal-drawer__panel > .semi-card-header")).toHaveLength(1);

    const tabs = container.querySelectorAll(".seal-drawer__switcher-group .semi-radio");
    fireEvent.click(tabs[1]);
    expect(container.querySelectorAll(".seal-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(container.querySelector(".seal-flow")).toBeTruthy();

    fireEvent.click(tabs[2]);
    expect(container.querySelectorAll(".seal-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(container.querySelector(".seal-drawer__source")).toBeTruthy();
    expect(container.querySelectorAll(".mx2-drawer--open .seal-field.mx2-open-field")).toHaveLength(2);
    expect(container.querySelector(".mx2-drawer--open .seal-field--route .mx2-open-field__control input.semi-input")).toBeTruthy();
    expect(container.querySelector(".mx2-drawer--open .seal-field--payload .mx2-open-field__control--textarea textarea.semi-input-textarea")).toBeTruthy();
  });

  it("keeps the visual asset bounded so it cannot read as the PlayArea background", () => {
    const styles = readFileSync(`${process.cwd()}/../oracle-seal-console/src/PlayArea.scss`, "utf8");
    const source = readFileSync(`${process.cwd()}/../oracle-seal-console/src/PlayArea.tsx`, "utf8");

    expect(styles).toContain('@use "@shared/components-react/v2/v2" as *;');
    expect(styles).toMatch(/\.seal-workspace\s*\{[\s\S]*background:\s*var\(--mx2-surface-2\);/);
    expect(styles).toMatch(/\.seal-workspace\s*\{[\s\S]*box-shadow:\s*none;/);
    expect(styles).toMatch(/\.seal-workspace\s*\{[\s\S]*grid-template-columns:\s*minmax\(430px,\s*1\.08fr\) minmax\(320px,\s*0\.92fr\)/);
    expect(styles).toMatch(/\.seal-workspace\s*\{[\s\S]*align-items:\s*start/);
    expect(styles).toMatch(/\.oracle-console-play-area \.mx2-action-rail__row \.mx2-btn--primary\s*\{[\s\S]*flex:\s*0 0 176px/);
    expect(styles).toMatch(/\.seal-envelope__body\s*\{[\s\S]*grid-template-columns:\s*minmax\(128px,\s*0\.42fr\) minmax\(0,\s*0\.58fr\)/);
    expect(styles).toMatch(/\.seal-envelope__asset\s*\{[\s\S]*background:\s*var\(--mx2-surface-2\);/);
    expect(styles).toMatch(/\.seal-envelope__lane\s*\{[\s\S]*background:\s*var\(--mx2-surface-2\);/);
    expect(styles).toMatch(/\.seal-purpose__options-group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.seal-purpose__active-hint\s*\{[\s\S]*background:\s*#f8fffd/);
    expect(styles).toMatch(/\.seal-source-summary\s*\{[\s\S]*display:\s*grid/);
    expect(styles).toMatch(/\.seal-source-summary__card\s*\{[\s\S]*background:\s*var\(--mx2-surface-2\)/);
    expect(styles).toMatch(/\.seal-source-summary\[data-valid="true"\] \.seal-source-summary__card\s*\{[\s\S]*background:\s*#f8fffd/);
    expect(styles).toMatch(/\.seal-preview__image\s*\{[\s\S]*object-fit:\s*contain;/);
    expect(styles).toMatch(/\.seal-preview__image\s*\{[\s\S]*filter:\s*none;/);
    expect(styles).toMatch(/\.seal-preview__image\s*\{[\s\S]*max-height:\s*132px/);
    expect(styles).toMatch(/\.seal-input--payload\s*\{[\s\S]*min-height:\s*74px/);
    expect(styles).toMatch(/\.seal-input--payload\s*\{[\s\S]*max-height:\s*96px/);
    expect(styles).toMatch(/\.seal-input--payload\s*\{[\s\S]*resize:\s*none/);
    expect(styles).toMatch(/\.seal-input--payload\s*\{[\s\S]*box-shadow:\s*inset 3px 0 0 rgba\(79,\s*70,\s*229,\s*0\.1\)/);
    expect(styles).toMatch(/\.seal-drawer__switcher-group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.seal-drawer__panel\s*\{[\s\S]*border-radius:\s*20px/);
    expect(styles).toMatch(/\.seal-drawer__source\s*\{[\s\S]*grid-template-areas:\s*[\s\S]*"route payload"[\s\S]*"validation validation"/);
    expect(styles).toMatch(/\.seal-drawer__source \.seal-input--payload\s*\{[\s\S]*min-height:\s*132px/);
    expect(styles).toMatch(/\.seal-drawer__source \.seal-input--payload\s*\{[\s\S]*resize:\s*vertical/);
    expect(styles).toMatch(/\.seal-drawer \.mx2-open-panel__copy span,[\s\S]*\.seal-drawer \.mx2-open-notice \.semi-banner-title,[\s\S]*\.seal-drawer \.mx2-open-notice \.semi-banner-description\s*\{[\s\S]*white-space:\s*normal/);
    expect(styles).toMatch(/\.seal-drawer__empty\.mx2-open-notice\.semi-banner\s*\{[\s\S]*min-height:\s*82px/);
    expect(styles).toMatch(/\.seal-builder\s*\{[\s\S]*order:\s*-1/);
    expect(styles).toMatch(/@media \(max-width: 560px\)[\s\S]*\.seal-drawer__source\s*\{[\s\S]*grid-template-areas:\s*[\s\S]*"route"[\s\S]*"payload"[\s\S]*"validation"/);
    expect(styles).toMatch(/@media \(max-width: 560px\)[\s\S]*\.seal-drawer__switcher-group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width: 560px\)[\s\S]*\.seal-drawer-tab strong\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/\.seal-preview__receipt div:not\(:last-child\)\s*\{[\s\S]*display:\s*none/);
    expect(styles).not.toMatch(/\.seal-input--payload\s*\{[\s\S]*min-height:\s*130px/);
    expect(styles).not.toMatch(/seal-drawer__head/);
    expect(styles).not.toMatch(/\.seal-purpose em/);
    expect(styles).not.toMatch(/\.seal-preview__media/);
    expect(styles).not.toMatch(/object-fit:\s*cover/);
    expect(styles).not.toMatch(/backdrop-filter|radial-gradient|AI-generated scene backdrop|oracle-console-scene__backdrop/);
    expect(source).toContain("OpenUiSegmented");
    expect(source).not.toContain('role="tablist"');
    expect(source).not.toContain('role="tab"');
    expect(source).not.toContain("oracle-console-scene");
    expect(source).not.toContain("⚡");
  });

  it("has reduced-motion guards for the remaining foreground animation", () => {
    const styles = readFileSync(`${process.cwd()}/../oracle-seal-console/src/PlayArea.scss`, "utf8");

    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(/animation-duration:\s*0\.001ms/);
  });
});
