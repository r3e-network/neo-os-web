import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../oracle-compute-lab/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string) {
  const messages: Record<string, string> = {
    buildRequest: "Build Request",
    computeCapsuleCopy: "Assemble workflow, privacy, and input as one package.",
    computeCapsuleTitle: "Compute capsule",
    computeBuildActive: "Building preview...",
    computeControlsLabel: "Compute package controls",
    computeDrawerNoDigest: "Build a preview to generate an auditable digest.",
    computeDrawerRouteTitle: "Preview route",
    computeEmptyCopy: "The receipt will show workflow, privacy mode, and input digest.",
    computeInputBytes: "24 chars",
    computeInputInvalidHint: "Fix JSON.",
    computeInputPublicCopy: "Public mode includes the raw JSON.",
    computeInputReadyHint: "JSON is valid.",
    computeInputSealedCopy: "Raw input stays local to this editor.",
    computeInputSize: "Input size",
    computeInputTitle: "Input package",
    computePipelineBuilt: "Preview package built",
    computePipelineDigest: "Digest",
    computePipelineDraft: "Draft",
    computePipelineInput: "JSON input",
    computePipelineKicker: "Service pipeline",
    computePipelineLabel: "Compute request pipeline",
    computePipelinePrivacy: "Privacy seal",
    computePipelineReady: "Request package ready",
    computePipelineWorkflow: "Workflow",
    computePlan: "Compute plan",
    computePlanCopy: "Build a small, reviewable compute package.",
    computePreviewOnly: "Review mode",
    computeReceipt: "Compute receipt",
    computeValidationReady: "Inputs ready",
    computeVisibility: "Visibility",
    detailsLabel: "Details",
    digestPlaceholder: "No digest",
    inputPublic: "Public",
    inputRedacted: "Redacted",
    lastStatus: "Last Status",
    no: "No",
    panelEyebrow: "Oracle",
    panelTitle: "Console",
    privacyPublicHint: "Raw input is visible.",
    privacyPublic: "Public",
    privacySealed: "Sealed",
    privacySealedHint: "Payload redacts raw input.",
    runAction: "Build Preview",
    statDigest: "Digest",
    statEndpoint: "Mode",
    statNetwork: "Network",
    statRequests: "Requests",
    statusReady: "Ready",
    workflowRisk: "Risk score",
    workflowRiskHint: "Score a compact signal.",
    workflowProof: "Proof check",
    workflowProofHint: "Check a proof.",
    workflowBatch: "Batch transform",
    workflowBatchHint: "Prepare batch transforms.",
    yes: "Yes",
  };
  return messages[key] ?? key;
}

function state(o: Partial<Record<string, unknown>> = {}): ObservableState {
  const base: Record<string, unknown> = {
    endpointLabel: "Preview",
    lastDigest: "No digest",
    lastStatus: "Ready",
    networkLabel: "Mainnet",
    requestCount: 0,
    ...o,
  };
  return Object.fromEntries(
    Object.entries(base).map(([key, value]) => [key, createObservable(value)]),
  );
}

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

function openPayloadEditor(container: HTMLElement): HTMLTextAreaElement {
  fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
  const tabs = Array.from(container.querySelectorAll<HTMLElement>(".compute-drawer__switcher-group .semi-radio"));
  expect(tabs).toHaveLength(3);
  fireEvent.click(tabs[2]);
  const textarea = container.querySelector<HTMLTextAreaElement>(".compute-drawer__payload textarea");
  expect(textarea).toBeTruthy();
  return textarea as HTMLTextAreaElement;
}

describe("oracle-compute-lab PlayArea (v2)", () => {
  it("renders a clean compute desk instead of a backdrop terminal", () => {
    const { container } = render(
      <PlayArea t={t} state={state()} dispatch={vi.fn()} />,
    );

    expect(container.querySelector(".oracle-compute-desk")).toBeTruthy();
    expect(container.querySelector(".compute-request-card")).toBeTruthy();
    expect(container.querySelector(".compute-control-deck")).toBeTruthy();
    expect(container.querySelector(".compute-payload-card")).toBeTruthy();
    expect(container.querySelector(".compute-control-deck textarea")).toBeNull();
    expect(container.querySelector(".compute-option-grid__group.mx2-open-segmented.semi-radioGroup")).toBeTruthy();
    expect(container.querySelector(".compute-privacy-switch__group.mx2-open-segmented.semi-radioGroup")).toBeTruthy();
    expect(container.querySelectorAll(".compute-option-grid__group .semi-radio")).toHaveLength(3);
    expect(container.querySelectorAll(".compute-privacy-switch__group .semi-radio")).toHaveLength(2);
    expect(container.querySelectorAll(".compute-pipeline__item")).toHaveLength(4);
    expect(container.querySelector(".compute-stage-art img")?.getAttribute("src"))
      .toContain("compute-privacy-stage.webp");
    expect(container.querySelector("select")).toBeNull();
    expect(container.querySelector(".oracle-console-scene__backdrop")).toBeNull();
    expect(container.textContent).not.toContain("⚡");
  });

  it("keeps Build Preview wired to the preview action", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: /Build Preview/ }));

    expect(dispatch).toHaveBeenCalledWith("buildRequest", {
      workflow: "risk-score",
      privacy: "sealed",
      input: "{\"asset\":\"GAS\",\"window\":\"24h\"}",
    });
  });

  it("dispatches the workflow, privacy, and JSON package selected on the desk", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("radio", { name: /Proof check/ }));
    fireEvent.click(screen.getByRole("radio", { name: /Public/ }));
    fireEvent.change(openPayloadEditor(container), {
      target: { value: "{\"proof\":\"ok\"}" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Build Preview/ }));

    expect(dispatch).toHaveBeenCalledWith("buildRequest", {
      workflow: "proof-check",
      privacy: "public",
      input: "{\"proof\":\"ok\"}",
    });
  });

  it("marks malformed JSON in the compact input capsule without blocking dispatch", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    const inputCapsule = container.querySelector(".compute-payload-card");

    fireEvent.change(openPayloadEditor(container), {
      target: { value: "{not json" },
    });

    expect(inputCapsule?.getAttribute("data-valid")).toBe("false");
    fireEvent.click(screen.getByRole("button", { name: /Build Preview/ }));
    expect(dispatch).toHaveBeenCalledWith("buildRequest", expect.objectContaining({
      input: "{not json",
    }));
  });

  it("renders the details drawer as designed panels and keeps sealed input redacted", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);

    const drawer = container.querySelector(".mx2-drawer--open");
    expect(drawer).toBeTruthy();
    expect(drawer?.querySelector(".compute-drawer")).toBeTruthy();
    expect(drawer?.querySelector(".compute-drawer__switcher-group.mx2-open-segmented.semi-radioGroup")).toBeTruthy();
    expect(drawer?.querySelectorAll(".compute-drawer__switcher-group .semi-radio")).toHaveLength(3);
    expect(drawer?.querySelectorAll('.compute-drawer__switcher [role="tab"]')).toHaveLength(0);
    expect(drawer?.querySelectorAll(".compute-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(drawer?.querySelector(".compute-drawer__facts")).toBeTruthy();

    fireEvent.click(drawer?.querySelectorAll(".compute-drawer__switcher-group .semi-radio")[1] as Element);
    expect(drawer?.querySelectorAll(".compute-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(drawer?.querySelector(".compute-drawer__route")).toBeTruthy();

    fireEvent.click(drawer?.querySelectorAll(".compute-drawer__switcher-group .semi-radio")[2] as Element);
    expect(drawer?.querySelectorAll(".compute-drawer__panel.mx2-open-panel.semi-card")).toHaveLength(1);
    expect(drawer?.querySelector(".compute-drawer__json")?.getAttribute("data-visibility")).toBe("sealed");
    expect(drawer?.querySelector(".compute-drawer__json pre")?.textContent).toBe("Redacted");
    expect(drawer?.querySelector(".compute-drawer__payload textarea")).toBeTruthy();
    expect(drawer?.querySelector("h4")).toBeNull();
  });

  it("shows public drawer input only when the user chooses public visibility", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    fireEvent.click(screen.getByRole("radio", { name: /Public/ }));
    fireEvent.change(openPayloadEditor(container), {
      target: { value: "{\"proof\":\"ok\"}" },
    });

    const json = container.querySelector(".mx2-drawer--open .compute-drawer__json");
    expect(json?.getAttribute("data-visibility")).toBe("public");
    expect(json?.querySelector("pre")?.textContent).toBe("{\"proof\":\"ok\"}");
  });

  it("surfaces digest state without turning art into the foreground", () => {
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ lastDigest: "0x1234567890abcdef1234567890abcdef" })}
        dispatch={vi.fn()}
      />,
    );

    expect(container.querySelector(".oracle-compute-desk")?.getAttribute("data-state"))
      .toBe("ready");
    expect(container.textContent).toContain("0x1234567890ab...7890abcdef");
    expect(container.querySelector(".compute-stage-art")?.getAttribute("aria-hidden"))
      .toBe("true");
  });

  it("keeps the scene scoped, clean, and motion-accessible", () => {
    const styles = playAreaStyles("oracle-compute-lab");
    const source = playAreaSource("oracle-compute-lab");

    expect(source).toContain("OpenUiSegmented");
    expect(source).not.toContain('role="tablist"');
    expect(source).not.toContain('role="tab"');
    expect(source).not.toContain('role="radiogroup"');
    expect(source).not.toContain('role="radio"');
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(/animation-duration:\s*0\.001ms/);
    expect(styles).toMatch(
      /\.oracle-compute-play-area\s*\{[\s\S]*--mx2-stage-floor:\s*#ffffff/,
    );
    expect(styles).toMatch(
      /\.oracle-compute-play-area \.mx2-stage__scene\s*\{[\s\S]*background:\s*#ffffff/,
    );
    expect(styles).toMatch(/\.oracle-compute-desk\s*\{[\s\S]*box-shadow:\s*none/);
    expect(styles).toMatch(/\.compute-control-deck\s*\{[\s\S]*grid-template-areas:\s*[\s\S]*"workflow privacy"[\s\S]*"payload payload"/);
    expect(styles).toMatch(/\.compute-option-grid__group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.compute-privacy-switch__group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(styles).toMatch(/\.compute-payload-card\s*\{[\s\S]*grid-area:\s*payload/);
    expect(styles).toMatch(/\.compute-payload-card\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\) minmax\(150px,\s*0\.42fr\)/);
    expect(styles).toMatch(/\.compute-payload-card__preview,[\s\S]*\.compute-payload-card__metric\s*\{[\s\S]*border:\s*1px solid/);
    expect(styles).toMatch(/\.compute-drawer__switcher-group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.compute-drawer__panel\s*\{[\s\S]*border-radius:\s*20px/);
    expect(styles).toMatch(/\.compute-drawer__facts\s*\{[\s\S]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/\.compute-drawer__payload-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.05fr\) minmax\(260px,\s*0\.95fr\)/);
    expect(styles).toMatch(/\.compute-drawer__payload \.mx2-open-field__control--textarea\s*\{[\s\S]*min-height:\s*142px/);
    expect(styles).toMatch(/\.compute-drawer__json pre\s*\{[\s\S]*max-height:\s*148px/);
    expect(styles).toMatch(/\.compute-drawer__json\[data-visibility="sealed"\] pre\s*\{[\s\S]*border:\s*1px dashed/);
    expect(styles).toMatch(/\.compute-stage-art\s*\{[\s\S]*background:\s*#ffffff/);
    expect(styles).toMatch(/\.compute-stage-art\s*\{[\s\S]*padding:\s*12px/);
    expect(styles).toMatch(/\.compute-stage-art img\s*\{[\s\S]*object-fit:\s*contain/);
    expect(styles).toMatch(/\.compute-stage-art img\s*\{[\s\S]*opacity:\s*1/);
    expect(styles).toMatch(/\.compute-stage-art img\s*\{[\s\S]*filter:\s*none/);
    expect(styles).toMatch(/\.compute-stage-art::after\s*\{[\s\S]*content:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.compute-request-card__copy\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.compute-pipeline\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.compute-pipeline__item small\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.compute-stage-art\s*\{[\s\S]*display:\s*grid/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.compute-stage-art\s*\{[\s\S]*height:\s*86px/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.compute-capsule-card__facts\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.compute-capsule-card__facts dd\s*\{[\s\S]*text-overflow:\s*clip/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.compute-capsule-card__facts dd\s*\{[\s\S]*white-space:\s*normal/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.compute-route-card\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.oracle-compute-play-area \.mx2-score\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.compute-drawer,[\s\S]*\.compute-drawer__facts\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.compute-drawer__switcher-group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*640px\)[\s\S]*\.compute-drawer-tab strong\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.compute-option-grid__group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.compute-option-card small\s*\{[\s\S]*display:\s*none/);
    expect(styles).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.compute-privacy-switch__group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
    expect(styles).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.compute-payload-card\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(styles).toMatch(/@media \(max-width:\s*720px\)[\s\S]*\.compute-drawer__payload-grid\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(styles).not.toMatch(/\.compute-stage-art img\s*\{[\s\S]*opacity:\s*0\.34/);
    expect(styles).not.toMatch(/\.compute-stage-art img\s*\{[\s\S]*filter:\s*saturate/);
    expect(styles).not.toMatch(/AI-generated scene backdrop/);
    expect(styles).not.toMatch(/__backdrop/);
    expect(styles).not.toMatch(/\.tool-scene__backdrop/);
    expect(styles).not.toMatch(/oracle-console-scene__icon/);
  });
});
