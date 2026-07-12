import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../oracle-vrf-console/src/PlayArea";
import {
  buildVrfRequestDraft,
  getVrfEnvironment,
  type VrfServiceSnapshot,
  type VrfVerificationResult,
} from "../../oracle-vrf-console/src/vrf-workbench";

(globalThis as typeof globalThis & { React: typeof React }).React = React;
afterEach(() => cleanup());

function t(key: string) {
  return key;
}

function snapshot(overrides: Partial<VrfServiceSnapshot> = {}): VrfServiceSnapshot {
  const environment = getVrfEnvironment("mainnet");
  return {
    network: "mainnet",
    freshness: "live",
    availability: "protected",
    checkedAt: "2026-07-11T00:00:00.000Z",
    apiBaseUrl: environment.apiBaseUrl,
    requestEndpoint: environment.requestEndpoint,
    rpcUrl: environment.rpcUrl,
    reportedNetwork: "mainnet",
    healthReady: true,
    runtimeOperational: true,
    workflowAdvertised: false,
    dispatchMode: "authenticated-consumer-integration",
    apiVerifierKey: `03${"11".repeat(32)}`,
    healthVerifierKey: `03${"11".repeat(32)}`,
    contractVerifierKey: `03${"11".repeat(32)}`,
    responseSignerKey: environment.responseSignerKey,
    responseSignerPinned: true,
    registryFulfillmentKey: environment.fulfillmentVerifierKey,
    keysMatch: true,
    runtimeKeyMatches: true,
    oracleContract: environment.oracleContract,
    oracleContractName: "MorpheusOracle",
    oracleChecksum: 454480263,
    callbackConsumer: environment.callbackConsumer,
    callbackContractName: "OracleCallbackConsumer",
    callbackChecksum: 1435370910,
    callbackBound: true,
    totalRequests: 7,
    totalFulfilled: 6,
    pendingRequests: 1,
    requestFeeGas: 0.01,
    errors: [],
    ...overrides,
  };
}

function verifiedResult(): VrfVerificationResult {
  return {
    status: "verified",
    reason: "ok",
    requestId: "vrf:mainnet:consumer:test",
    randomness: "ab".repeat(32),
    outputHash: "cd".repeat(32),
    signerKey: `03${"11".repeat(32)}`,
    verifiedAt: "2026-07-11T00:00:00.000Z",
    requestCorrelationSigned: false,
    attestation: "hash-bound-not-independently-verified",
    checks: [
      { key: "schema", status: "pass" },
      { key: "request", status: "pass" },
      { key: "network-key", status: "pass" },
      { key: "attestation", status: "info" },
    ],
  };
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    networkLabel: "Neo N3 Mainnet",
    serviceLabel: "Integration only",
    lastStatus: "Ready",
    lastDigest: "No draft",
    serviceSnapshot: snapshot(),
    draft: null,
    responseText: "",
    verification: null,
    actionBusy: false,
    actionKind: "",
    serviceBusy: false,
    ...overrides,
  };
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, createObservable(value)]),
  ) as ObservableState;
}

function appFile(file: string) {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return path.join(appsRoot, "oracle-vrf-console", "src", file);
}

describe("Oracle VRF Workbench PlayArea", () => {
  it("uses real bright workspace art with clean foreground surfaces", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    const scss = readFileSync(appFile("PlayArea.scss"), "utf8");
    const image = container.querySelector<HTMLImageElement>(".vrf-workbench__visual img");

    expect(image?.getAttribute("src")).toContain("oracle-workspace-stage.webp");
    expect(image?.getAttribute("alt")).toBe("heroAlt");
    expect(scss).toMatch(/\.vrf-workbench,\s*\n\.vrf-request-board\s*\{[\s\S]*background:\s*#ffffff/);
    expect(scss).toMatch(/\.vrf-workbench__visual img\s*\{[\s\S]*object-fit:\s*cover/);
    expect(scss).toMatch(/\.vrf-path\s*\{[\s\S]*background:\s*var\(--vrf-mint\)/);
    expect(scss).not.toContain("background-image: url");
    expect(scss).not.toContain("backdrop-filter");
    expect(scss).not.toContain("#000000");
  });

  it("keeps the core business path visually dominant and unsupported parameters absent", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    const source = readFileSync(appFile("PlayArea.tsx"), "utf8");

    expect(container.querySelector(".vrf-path")).toBeTruthy();
    expect(container.querySelectorAll(".vrf-path li")).toHaveLength(3);
    expect(container.querySelector(".vrf-request-board")).toBeTruthy();
    expect(container.querySelectorAll(".vrf-purpose-grid button")).toHaveLength(3);
    expect(source).not.toMatch(/batch-proof|single-proof|adjustRounds|roundsPlaceholder|saltPlaceholder/);
    expect(source).toContain('dispatch("buildDraft", context)');
    expect(source).toContain('dispatch("verifyResponse", { responseText })');
  });

  it("keeps parameter fields behind the drawer and disables payload until a draft exists", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    expect(container.querySelector(".vrf-context-grid")).toBeNull();

    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as HTMLButtonElement);
    const tabs = Array.from(container.querySelectorAll<HTMLElement>(".vrf-drawer__switcher-group .semi-radio"));
    expect(tabs).toHaveLength(4);
    expect(container.querySelectorAll(".vrf-context-grid input.semi-input")).toHaveLength(2);
    expect(tabs[3].classList.contains("semi-radio-disabled")).toBe(true);
    expect(container.querySelector(".vrf-payload")).toBeNull();
  });

  it("renders service mismatch as a warning instead of calling it ready", () => {
    const mismatch = snapshot({
      availability: "network-mismatch",
      reportedNetwork: "mainnet",
      runtimeKeyMatches: false,
    });
    const { container } = render(<PlayArea t={t} state={state({ serviceSnapshot: mismatch })} dispatch={vi.fn()} />);
    expect(container.querySelector(".vrf-workbench__service-seal")?.getAttribute("data-tone"))
      .toBe("network-mismatch");
    expect(container.textContent).toContain("serviceMismatch");
  });

  it("keeps an in-session draft usable while clearly marking failed local recovery", () => {
    const draft = buildVrfRequestDraft({}, "mainnet", { nonce: () => "local-only" });
    const { container } = render(<PlayArea
      t={t}
      state={state({ draft, storageHealthy: false, draftPersisted: false })}
      dispatch={vi.fn()}
    />);

    expect(container.textContent).toContain("draftLocalOnly");
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as HTMLButtonElement);
    const tabs = Array.from(container.querySelectorAll<HTMLElement>(".vrf-drawer__switcher-group .semi-radio"));
    fireEvent.click(tabs[0]);
    expect(container.querySelector(".vrf-storage-notice")).toBeTruthy();
    expect(container.textContent).toContain("storageUnavailableCopy");
  });

  it("shows a verified response with check-level evidence and limited attestation scope", () => {
    const draft = buildVrfRequestDraft({}, "mainnet", { nonce: () => "test" });
    const { container } = render(
      <PlayArea
        t={t}
        state={state({ draft, verification: verifiedResult(), responseText: "{}" })}
        dispatch={vi.fn()}
      />,
    );
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as HTMLButtonElement);
    const tabs = Array.from(container.querySelectorAll<HTMLElement>(".vrf-drawer__switcher-group .semi-radio"));
    fireEvent.click(tabs[2]);

    expect(container.querySelector(".vrf-verification")?.getAttribute("data-state")).toBe("verified");
    expect(container.querySelectorAll(".vrf-verification li")).toHaveLength(4);
    expect(container.textContent).toContain("attestationLimited");
    expect(container.textContent).toContain("checkAttestation");
  });

  it("has compact responsive hierarchy rather than stretched controls", () => {
    const scss = readFileSync(appFile("PlayArea.scss"), "utf8");
    expect(scss).toMatch(/\.vrf-stage-layout\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1\.32fr\) minmax\(310px,\s*0\.68fr\)/);
    expect(scss).toMatch(/\.vrf-inline-action\s*\{[\s\S]*width:\s*fit-content/);
    expect(scss).toMatch(/@media \(max-width:\s*680px\)[\s\S]*\.vrf-workbench\s*\{[\s\S]*grid-template-columns:\s*1fr/);
    expect(scss).toMatch(/@media \(max-width:\s*680px\)[\s\S]*\.vrf-purpose-grid\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
    expect(scss).toMatch(/@media \(max-width:\s*460px\)[\s\S]*\.oracle-vrf-play-area \.mx2-score\s*\{[\s\S]*display:\s*none/);
  });
});
