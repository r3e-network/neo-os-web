import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import type { PlatformServices } from "../services";
import PlayArea from "../../oracle-seal-console/src/PlayArea";
import { messages } from "../../oracle-seal-console/src/appConfig";

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
    endpointLabel: createObservable("Envelope reference"),
    requestCount: createObservable(0),
    lastDigest: createObservable("—"),
    lastStatus: createObservable("Ready"),
  };
}

function makeServices(copy = vi.fn(async () => undefined)) {
  return {
    clipboard: { copy },
  } as unknown as PlatformServices;
}

function makeProps(
  state = makeState(),
  setStatus = vi.fn(),
  copy = vi.fn(async () => undefined),
) {
  return {
    t,
    state,
    dispatch: vi.fn(async () => undefined),
    services: makeServices(copy),
    status: null,
    setStatus,
    clearStatus: vi.fn(),
    loadError: null,
    retryLoad: vi.fn(async () => undefined),
    launchContext: { params: {}, network: "mainnet" },
  };
}

function buildReference() {
  fireEvent.click(screen.getByRole("button", { name: "Build Reference" }));
}

afterEach(() => cleanup());

describe("Oracle Seal Console PlayArea", () => {
  it("builds a compact reference package without leaking the JSON source", async () => {
    const state = makeState();
    const setStatus = vi.fn();
    const copy = vi.fn(async () => undefined);
    const { container } = render(
      <PlayArea {...makeProps(state, setStatus, copy)} />,
    );

    expect(container.querySelector(".seal-composer-panel")).toBeTruthy();
    expect(container.querySelector(".seal-purpose-track")).toBeTruthy();
    expect(container.querySelector(".seal-process-stage")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Payload chamber" })).toBeTruthy();
    expect(
      container.querySelector(".seal-payload-chamber--ready"),
    ).toBeTruthy();
    expect(screen.getByText("JSON payload chamber")).toBeTruthy();
    expect(screen.getByText("Valid JSON")).toBeTruthy();
    expect(screen.getByText("Ready to build reference")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("radio", { name: "Purpose: Attestation" }),
    );
    fireEvent.change(screen.getByLabelText("Recipient"), {
      target: { value: "oracle-route-alpha" },
    });
    fireEvent.change(screen.getByLabelText("Request Payload (not encrypted)"), {
      target: { value: '{"secret":"do-not-leak","asset":"GAS"}' },
    });
    buildReference();

    expect(
      screen.getByText("Attestation envelope reference prepared"),
    ).toBeTruthy();
    expect(
      container.querySelector(".seal-process-stage--building"),
    ).toBeTruthy();
    expect(screen.getByText("Building envelope reference...")).toBeTruthy();
    const payload = container.querySelector(".console-tool__payload-card pre");
    expect(payload?.textContent).toContain("oracle.seal.envelope");
    expect(payload?.textContent).toContain("payloadDigest");
    expect(payload?.textContent).not.toContain("do-not-leak");
    expect(state.requestCount?.get?.()).toBe(1);
    expect(setStatus).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(copy).toHaveBeenCalled());
    expect(
      container.querySelector(".seal-process-stage--copying"),
    ).toBeTruthy();
    expect(screen.getByText("Copying reference metadata...")).toBeTruthy();
    expect(copy.mock.calls[0]?.[0]).not.toContain("do-not-leak");
  });

  it("keeps invalid JSON in a warning state without incrementing envelopes", () => {
    const state = makeState();
    const setStatus = vi.fn();
    render(<PlayArea {...makeProps(state, setStatus)} />);

    fireEvent.change(screen.getByLabelText("Request Payload (not encrypted)"), {
      target: { value: "{not json" },
    });
    expect(screen.getByText("Needs repair")).toBeTruthy();
    expect(
      document.querySelector(".seal-payload-chamber--invalid"),
    ).toBeTruthy();
    buildReference();

    expect(
      screen.getAllByText("Enter a valid JSON payload").length,
    ).toBeGreaterThan(0);
    expect(state.requestCount?.get?.()).toBe(0);
    expect(state.lastDigest?.get?.()).toBe("—");
    expect(setStatus).toHaveBeenCalledWith(
      "Enter a valid JSON payload",
      "warning",
    );
  });

  it("keeps the envelope workbench motion and reduced-motion fallback covered", () => {
    const styles = readFileSync(
      resolve(process.cwd(), "../oracle-seal-console/src/PlayArea.scss"),
      "utf8",
    );

    expect(styles).toContain("@keyframes seal-stage-package-route");
    expect(styles).toContain("@keyframes seal-stage-copy-pulse");
    expect(styles).toContain("@keyframes seal-stage-route-scan");
    expect(styles).toContain("@keyframes seal-payload-chamber-scan");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toMatch(
      /\.seal-process-stage--building \.seal-process-stage__packet[\s\S]*animation:\s*seal-stage-package-route/,
    );
    expect(styles).toMatch(
      /\.seal-process-stage--copying \.seal-process-stage__packet[\s\S]*animation:\s*seal-stage-copy-pulse/,
    );
    expect(styles).toMatch(
      /\.seal-play-area--building \.seal-payload-chamber::after[\s\S]*animation:\s*seal-payload-chamber-scan/,
    );
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.seal-process-stage__packet[\s\S]*animation:\s*none/,
    );
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.seal-payload-chamber::after[\s\S]*animation:\s*none/,
    );
  });
});
