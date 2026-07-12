import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../oracle-compute-lab/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());

function t(key: string, params: Record<string, string | number> = {}) {
  const dictionary: Record<string, string> = {
    boundaryAttestation: "Attestation",
    boundaryCopy: "No runtime credential and no job ID.",
    boundaryHeadline: "No compute job was submitted",
    boundaryProof: "Proof",
    boundaryRecovery: "No write exists, so pending, retry, and readback do not apply.",
    boundaryResult: "Result",
    boundaryTitle: "Runtime boundary",
    copyPackage: "Copy package",
    disclosureLabel: "Source disclosure",
    drawerPackage: "Package",
    drawerRoute: "Route",
    drawerSource: "Source",
    flowBoundary: "Result boundary",
    flowDraft: "Draft",
    flowLabel: "Request preparation flow",
    flowNotRun: "Not run",
    flowPackage: "Request package",
    flowPolicy: "Policy",
    flowPrepared: "Prepared locally",
    flowReady: "Ready",
    flowSource: "Source",
    inputDigestLabel: "Source SHA-256",
    networkTargetBadge: "Registry target",
    noDigest: "Not prepared",
    packageCopyReady: "Review the package.",
    packageCountLabel: "Local packages",
    packageDigestLabel: "Request SHA-256",
    packageEmpty: "Prepare once to create a cryptographic request digest.",
    packageTitle: "Request package",
    packageScopeLabel: "Digest covers",
    packageScopeValue: "Payload + registry target",
    panelEyebrow: "Morpheus compute workbench",
    panelSubtitle: "Local package only — no compute job is submitted",
    panelTitle: "Prepare a confidential compute request",
    policyDigestOnly: "Keep source local",
    policyDigestOnlyHint: "Omission, not encryption.",
    policyPublic: "Include public source",
    policyPublicHint: "Use only for intentionally public JSON.",
    policyTitle: "Policy",
    prepareAction: "Prepare request package",
    preparingAction: "Hashing source locally…",
    profileBatch: "Batch transform",
    profileBatchHint: "Prepare transforms.",
    profileLabel: "Intent preset",
    profileProof: "Proof review",
    profileProofHint: "No proof is verified here.",
    profileRisk: "Risk signal",
    profileRiskHint: "Prepare risk signals.",
    routeContract: "Registry Oracle contract",
    routeCopy: "Reference metadata, not a live service check.",
    routeEndpoint: "Authenticated route",
    routeEnvelope: "Envelope version",
    routePolicies: "Runtime policies",
    routeDelivery: "Delivery mode",
    routeRuntime: "Runtime target",
    routeTee: "TEE required",
    routeTitle: "Registry route snapshot",
    routeWorkflow: "Workflow",
    sourceBytes: "{count} bytes",
    sourceEditorHint: "Stored only in component memory.",
    sourceEditorTitle: "Edit source JSON",
    sourceImageAlt: "Bright confidential compute workspace",
    sourceInvalidJson: "Fix the JSON before preparing a package.",
    sourceJson: "JSON source",
    sourceLocalBadge: "Source stays in this browser",
    sourcePublicBadge: "Package includes source",
    sourceNeedsFix: "Needs attention",
    sourcePreviewTitle: "Package visibility",
    sourceRedacted: "Raw source omitted",
    sourceRequired: "Add JSON source data.",
    sourceShapeArray: "Array · {count} items",
    sourceShapeObject: "Object · {keys}",
    sourceShapeValue: "JSON value",
    sourceStageCopy: "Shape the source locally, bind it, then review what leaves.",
    sourceStageTitle: "Source chamber",
    sourceTooLarge: "Keep source data at or below 64 KB.",
    sourceTooDeep: "Keep JSON nesting at or below 64 levels.",
    sourceUnsafeNumber: "Use finite and exact numbers.",
    sourceValid: "Valid JSON",
    statusReady: "Ready to prepare",
    unavailable: "Unavailable",
    workbenchDetails: "Source & package",
    yes: "Yes",
    no: "No",
  };
  let text = dictionary[key] ?? key;
  for (const [name, value] of Object.entries(params)) {
    text = text.replace(`{${name}}`, String(value));
  }
  return text;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    endpointLabel: "compute.execute · /compute/execute",
    deliveryMode: "api_response",
    envelopeVersion: "2026-04-tee-v1",
    inputDigest: "",
    isPreparing: false,
    lastStatus: "Ready to prepare",
    networkLabel: "Neo N3 Mainnet",
    oracleContract: "0xf54d8584ef82315c1800373272ab08ae0db2d5ef",
    packageState: "draft",
    policiesLabel: "tenant · risk",
    requestCount: 0,
    requestDigest: "",
    requestPackage: "",
    requestDigestScope: "oracle-compute-lab/payload+route-snapshot-v1",
    route: "/compute/execute",
    runtimeBaseUrl: "https://oracle.meshmini.app/mainnet",
    teeRequired: true,
    workflow: "compute.execute",
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  );
}

function styles(): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return readFileSync(path.join(appsRoot, "oracle-compute-lab/src/PlayArea.scss"), "utf8");
}

function source(): string {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return readFileSync(path.join(appsRoot, "oracle-compute-lab/src/PlayArea.tsx"), "utf8");
}

function openDrawer(container: HTMLElement) {
  fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as Element);
  return container.querySelector(".mx2-drawer--open") as HTMLElement;
}

describe("Oracle Compute Lab designed workbench", () => {
  it("makes the real compute-stage resource the primary surface", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(container.querySelector(".compute-source-stage")).toBeTruthy();
    expect(screen.getByAltText("Bright confidential compute workspace").getAttribute("src"))
      .toContain("compute-privacy-stage.webp");
    expect(container.querySelector(".compute-policy-board")).toBeTruthy();
    expect(container.querySelectorAll(".compute-flow li")).toHaveLength(4);
    expect(container.querySelector(".compute-runtime-boundary")).toBeTruthy();
    expect(screen.getByText("No compute job was submitted")).toBeTruthy();
    expect(screen.getAllByText("Unavailable")).toHaveLength(3);
    expect(container.querySelector("select")).toBeNull();
    expect(container.textContent).not.toContain("⚡");
  });

  it("keeps exactly one dominant preparation action wired to the local package builder", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    fireEvent.click(screen.getByRole("button", { name: "Prepare request package" }));

    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith("prepareRequest", {
      profile: "risk-signal",
      disclosure: "digest-only",
      source: '{"asset":"GAS","window":"24h","signals":["price","volume"]}',
    });
    expect((screen.getByRole("button", { name: "Copy package" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("blocks malformed JSON instead of dispatching an invalid request", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    const drawer = openDrawer(container);
    const textarea = drawer.querySelector("textarea") as HTMLTextAreaElement;

    fireEvent.change(textarea, { target: { value: "{not json" } });

    expect(screen.getByRole("alert").textContent).toContain("Fix the JSON");
    expect((screen.getByRole("button", { name: "Prepare request package" }) as HTMLButtonElement).disabled).toBe(true);
    expect(dispatch).not.toHaveBeenCalledWith("prepareRequest", expect.anything());
    expect(dispatch).toHaveBeenCalledWith("invalidateRequest");
  });

  it("sends compact intent and disclosure choices without turning them into primary cards", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);

    expect(container.querySelectorAll(".compute-profile-switch__group .semi-radio")).toHaveLength(3);
    expect(container.querySelectorAll(".compute-disclosure-switch__group .semi-radio")).toHaveLength(2);
    fireEvent.click(screen.getByRole("radio", { name: "Proof review" }));
    fireEvent.click(screen.getByRole("radio", { name: "Include public source" }));
    expect(screen.getByText("Package includes source")).toBeTruthy();
    const drawer = openDrawer(container);
    fireEvent.change(drawer.querySelector("textarea") as HTMLTextAreaElement, {
      target: { value: '{"claim":"public"}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Prepare request package" }));

    expect(dispatch).toHaveBeenLastCalledWith("prepareRequest", {
      profile: "proof-review",
      disclosure: "public-input",
      source: '{"claim":"public"}',
    });
  });

  it("shows the prepared package as a local receipt while result proof and attestation stay unavailable", () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const requestPackage = JSON.stringify({
      payload: { dispatchReady: false, execution: "not_dispatched" },
      boundary: { result: "unavailable", proof: "unavailable", attestation: "unavailable" },
    }, null, 2);
    const { container } = render(<PlayArea t={t} state={state({
      packageState: "ready",
      requestCount: 2,
      requestDigest: `0x${"a".repeat(64)}`,
      inputDigest: `0x${"b".repeat(64)}`,
      requestPackage,
    })} dispatch={dispatch} />);

    expect(container.querySelector(".compute-workbench")?.getAttribute("data-state")).toBe("ready");
    expect(container.querySelector(".compute-package-ticket")?.getAttribute("data-ready")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Copy package" }));
    expect(dispatch).toHaveBeenCalledWith("copyRequestPackage");

    const drawer = openDrawer(container);
    const modes = drawer.querySelectorAll(".compute-drawer__switcher-group .semi-radio");
    fireEvent.click(modes[1] as Element);
    expect(drawer.querySelector(".compute-package-json")?.textContent).toContain("not_dispatched");
    expect(drawer.querySelector(".compute-package-json")?.textContent).toContain("unavailable");
  });

  it("labels route data as a registry snapshot rather than a live dispatch state", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    const drawer = openDrawer(container);
    const modes = drawer.querySelectorAll(".compute-drawer__switcher-group .semi-radio");
    fireEvent.click(modes[2] as Element);

    expect(drawer.textContent).toContain("Registry route snapshot");
    expect(drawer.textContent).toContain("not a live service check");
    expect(drawer.textContent).toContain("compute.execute");
    expect(drawer.textContent).toContain("/compute/execute");
    expect(drawer.textContent).toContain("https://oracle.meshmini.app/mainnet");
    expect(drawer.textContent).toContain("tenant · risk");
    expect(drawer.textContent).toContain("api_response");
  });

  it("uses bright high-contrast layout rules with responsive and reduced-motion fallbacks", () => {
    const css = styles();
    const tsx = source();

    expect(css).toMatch(/\.compute-workbench\s*\{[\s\S]*background:\s*#fffdfa/);
    expect(css).toMatch(/\.compute-source-stage__visual img\s*\{[\s\S]*object-fit:\s*cover/);
    expect(css).toMatch(/\.compute-source-stage__badge\[data-disclosure="public-input"\]/);
    expect(css).toMatch(/\.compute-runtime-boundary\s*\{[\s\S]*background:\s*#fff8f3/);
    expect(css).toMatch(/\.compute-profile-switch__group\.mx2-open-segmented\.semi-radioGroup\s*\{[\s\S]*grid-template-columns:\s*repeat\(3/);
    expect(css).toContain("@media (max-width: 560px)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toMatch(/animation-duration:\s*0\.001ms/);
    expect(tsx).toContain("compute-privacy-stage.webp");
    expect(tsx).toContain("@shared/components-react/v2/OpenUiLite");
    expect(tsx).not.toContain("<svg");
    expect(tsx).not.toMatch(/[⚡🔒🧠🎨]/u);
  });
});
