import React from "react";
import fs from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import type { PlatformServices } from "../services";
import PlayArea from "../../oracle-vrf-console/src/PlayArea";
import { messages } from "../../oracle-vrf-console/src/appConfig";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

type LocalizedMessage = {
  en: string;
  zh: string;
};

const appMessages = messages as Record<string, LocalizedMessage>;

function t(key: string, params: Record<string, string | number> = {}) {
  let text = appMessages[key]?.en ?? key;
  for (const [param, value] of Object.entries(params)) {
    text = text.replace(`{${param}}`, String(value));
  }
  return text;
}

function makeState(): ObservableState {
  return {
    networkLabel: createObservable("Morpheus Mainnet"),
    endpointLabel: createObservable("Request builder (preview)"),
    requestCount: createObservable(0),
    lastDigest: createObservable("—"),
    lastStatus: createObservable("Ready"),
  };
}

function makeServices() {
  return {
    clipboard: { copy: vi.fn(async () => undefined) },
  } as unknown as PlatformServices;
}

function makeProps(state = makeState(), setStatus = vi.fn()) {
  return {
    t,
    state,
    dispatch: vi.fn(async () => undefined),
    services: makeServices(),
    status: null,
    setStatus,
    clearStatus: vi.fn(),
    loadError: null,
    retryLoad: vi.fn(async () => undefined),
    launchContext: { params: {}, network: "mainnet" },
  };
}

function buildRequest() {
  fireEvent.click(screen.getByRole("button", { name: "Build VRF Request" }));
}

afterEach(() => cleanup());

describe("Oracle VRF Console PlayArea", () => {
  it("builds a batch randomness ticket without a global success toast", () => {
    const state = makeState();
    const setStatus = vi.fn();
    const { container } = render(<PlayArea {...makeProps(state, setStatus)} />);

    expect(container.querySelector(".vrf-play-area--draft")).toBeTruthy();
    expect(
      container.querySelector(
        '.vrf-hero__media[src="./vrf-randomness-stage.jpg"]',
      ),
    ).toBeTruthy();
    expect(
      container.querySelector(
        '.vrf-proof-oracle img[src="./oracle-workspace-stage.jpg"]',
      ),
    ).toBeTruthy();
    expect(container.querySelectorAll(".vrf-flow span.is-ready").length).toBe(
      3,
    );
    expect(container.querySelector(".vrf-ticket-panel")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Increase rounds" }));
    fireEvent.click(
      screen.getByRole("radio", { name: "Proof Mode: Batch proof" }),
    );
    buildRequest();

    expect(container.querySelector(".vrf-play-area--ready")).toBeTruthy();
    expect(container.querySelector(".vrf-ticket-board--built")).toBeTruthy();
    expect(container.querySelector(".vrf-proof-card--ready")).toBeTruthy();
    expect(screen.getByText("2 randomness round(s) prepared")).toBeTruthy();
    expect(
      container.querySelector(".vrf-payload-card pre")?.textContent,
    ).toContain('"mode": "batch-proof"');
    expect(state.requestCount?.get?.()).toBe(1);
    expect(state.lastDigest?.get?.()).toBe("0xbc263cb7");
    expect(setStatus).not.toHaveBeenCalled();
  });

  it("announces missing seed values as a warning", () => {
    const state = makeState();
    const setStatus = vi.fn();
    render(<PlayArea {...makeProps(state, setStatus)} />);

    fireEvent.change(screen.getByLabelText("Consumer"), {
      target: { value: "" },
    });
    buildRequest();

    expect(document.querySelector(".vrf-play-area--warn")).toBeTruthy();
    expect(document.querySelector(".vrf-ticket-board--warn")).toBeTruthy();
    expect(document.querySelector(".vrf-proof-card--warn")).toBeTruthy();
    expect(
      screen.getAllByText("Required fields missing").length,
    ).toBeGreaterThan(0);
    expect(state.requestCount?.get?.()).toBe(0);
    expect(state.lastDigest?.get?.()).toBe("—");
    expect(setStatus).toHaveBeenCalledWith(
      "Required fields missing",
      "warning",
    );
  });

  it("keeps the VRF console motion backed by reduced-motion fallbacks", () => {
    const styles = fs.readFileSync(
      `${process.cwd()}/../oracle-vrf-console/src/PlayArea.scss`,
      "utf8",
    );

    expect(styles).toContain("@keyframes vrf-stage-drift");
    expect(styles).toContain("@keyframes vrf-ticket-scan");
    expect(styles).toContain("@keyframes vrf-round-pulse");
    expect(styles).toContain("@keyframes vrf-proof-ready");
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.vrf-proof-card--ready \.vrf-result-hero/,
    );
  });
});
