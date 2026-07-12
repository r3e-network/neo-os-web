import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../oracle-vrf-console/src/PlayArea";
import {
  buildVrfRequestDraft,
  getVrfEnvironment,
  type VrfServiceSnapshot,
} from "../../oracle-vrf-console/src/vrf-workbench";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string, params: Record<string, string | number> = {}) {
  let value = key;
  for (const [name, replacement] of Object.entries(params)) {
    value = value.replace(`{${name}}`, String(replacement));
  }
  return value;
}

function snapshot(): VrfServiceSnapshot {
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

function appScssPath() {
  const appsRoot = process.cwd().endsWith(`${path.sep}apps${path.sep}shared`)
    ? path.resolve(process.cwd(), "..")
    : path.resolve(process.cwd(), "apps");
  return path.join(appsRoot, "oracle-vrf-console", "src/PlayArea.scss");
}

describe("Oracle VRF Workbench integration", () => {
  it("renders the resource workspace and the three-state verification path", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    expect(container.querySelector(".vrf-workbench__visual img")?.getAttribute("src"))
      .toContain("oracle-workspace-stage.webp");
    expect(container.querySelectorAll(".vrf-path li")).toHaveLength(3);
    expect(container.querySelectorAll(".vrf-purpose-grid button")).toHaveLength(3);
    expect(container.textContent).toContain("draftNotSubmitted");
  });

  it("builds an honest local draft from the selected use case", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<PlayArea t={t} state={state()} dispatch={dispatch} />);
    const purposeButtons = container.querySelectorAll<HTMLButtonElement>(".vrf-purpose-grid button");
    fireEvent.click(purposeButtons[1]);
    fireEvent.click(container.querySelector(".mx2-btn--primary") as HTMLButtonElement);

    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("buildDraft", {
      consumer: "miniapp-oracle-vrf-console",
      purpose: "raffle",
      reference: "weekly-raffle",
    }));
    expect(dispatch).not.toHaveBeenCalledWith("buildRequest", expect.anything());
  });

  it("progressively reveals context, service evidence, verifier, and exact payload", async () => {
    const dispatch = vi.fn().mockResolvedValue(undefined);
    const draft = buildVrfRequestDraft({}, "mainnet", { nonce: () => "test" });
    const { container } = render(<PlayArea t={t} state={state({ draft })} dispatch={dispatch} />);
    fireEvent.click(container.querySelector(".mx2-action-rail__drawer-toggle") as HTMLButtonElement);
    const tabs = Array.from(container.querySelectorAll<HTMLElement>(".vrf-drawer__switcher-group .semi-radio"));
    expect(tabs).toHaveLength(4);

    fireEvent.click(tabs[0]);
    expect(container.querySelectorAll(".vrf-context-grid input.semi-input")).toHaveLength(2);

    fireEvent.click(tabs[1]);
    expect(container.querySelectorAll(".vrf-service-grid > div")).toHaveLength(7);
    expect(container.textContent).toContain("MorpheusOracle");

    fireEvent.click(tabs[2]);
    const response = container.querySelector(".vrf-response-field textarea") as HTMLTextAreaElement;
    fireEvent.change(response, { target: { value: '{"request_id":"test"}' } });
    fireEvent.click(container.querySelector(".vrf-inline-action--primary") as HTMLButtonElement);
    await waitFor(() => expect(dispatch).toHaveBeenCalledWith("verifyResponse", {
      responseText: '{"request_id":"test"}',
    }));

    fireEvent.click(tabs[3]);
    expect(container.querySelector(".vrf-payload")?.textContent).toContain('"target_chain": "neo_n3"');
    expect(container.querySelector(".vrf-payload")?.textContent).not.toContain("rounds");
  });

  it("keeps live refresh and request copy secondary to the single draft action", () => {
    const { container } = render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);
    expect(container.querySelectorAll(".mx2-action-rail__row .mx2-btn--primary")).toHaveLength(1);
    expect(container.querySelectorAll(".mx2-action-rail__secondary .mx2-btn").length).toBeLessThanOrEqual(2);
    expect(container.querySelector(".vrf-inline-action--danger")).toBeNull();
  });

  it("has a reduced-motion guard", () => {
    const scss = readFileSync(appScssPath(), "utf8");
    expect(scss).toContain("@media (prefers-reduced-motion: reduce)");
    expect(scss).toMatch(/animation-duration:\s*0\.001ms/);
  });
});
