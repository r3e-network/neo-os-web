import React from "react";
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import type { PlatformServices } from "../services";
import PlayArea from "../../oracle-neodid-console/src/PlayArea";
import { messages } from "../../oracle-neodid-console/src/appConfig";

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
    endpointLabel: createObservable("Verification preview builder"),
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

function clickPreview() {
  const buttons = screen.getAllByRole("button", { name: "Preview Verification" });
  fireEvent.click(buttons[buttons.length - 1]);
}

afterEach(() => cleanup());

describe("Oracle NeoDID Console PlayArea", () => {
  it("presents the default DID request as a visual identity verification track", () => {
    const state = makeState();
    const setStatus = vi.fn();
    const { container } = render(<PlayArea {...makeProps(state, setStatus)} />);

    expect(screen.getByLabelText("Identity verification track")).toBeTruthy();
    expect(container.querySelector(".neodid-identity-track.is-ready.has-did.has-claim.has-callback")).toBeTruthy();
    expect(container.querySelector('.neodid-identity-track__token img[src="./logo.jpg"]')).toBeTruthy();
    expect(container.querySelectorAll(".neodid-identity-track__node").length).toBe(4);
    expect(screen.getByText("Subject")).toBeTruthy();
    expect(screen.getAllByText("NeoDID registry").length).toBeGreaterThan(0);
    expect(screen.getAllByText("profile.kyc").length).toBeGreaterThan(0);
    expect(screen.getByText("Preview only")).toBeTruthy();

    clickPreview();

    expect(screen.getAllByText("Verification preview ready").length).toBeGreaterThan(0);
    expect(state.requestCount?.get?.()).toBe(1);
    expect(String(state.lastDigest?.get?.())).toMatch(/^0x[0-9a-f]+$/);
    expect(setStatus).toHaveBeenCalledWith("Verification preview ready", "success");
  });

  it("turns a malformed DID into a blocked track and warning receipt", () => {
    const state = makeState();
    const setStatus = vi.fn();
    const { container } = render(<PlayArea {...makeProps(state, setStatus)} />);

    fireEvent.change(screen.getByLabelText("DID"), {
      target: { value: "hello world" },
    });
    clickPreview();

    expect(container.querySelector(".neodid-identity-track.is-blocked")).toBeTruthy();
    expect(container.querySelector(".neodid-identity-track__node.is-blocked")).toBeTruthy();
    expect(screen.getAllByText("Enter a valid did:neo identifier").length).toBeGreaterThan(0);
    expect(state.requestCount?.get?.()).toBe(0);
    expect(state.lastDigest?.get?.()).toBe("—");
    expect(setStatus).toHaveBeenCalledWith(
      "Enter a valid did:neo identifier",
      "warning",
    );
  });

  it("keeps identity-track motion explicit and disabled for reduced-motion users", () => {
    const css = readFileSync(
      `${process.cwd()}/../oracle-neodid-console/src/PlayArea.scss`,
      "utf8",
    );

    expect(css).toContain("@keyframes neodid-track-sheen");
    expect(css).toContain("@keyframes neodid-track-rail-flow");
    expect(css).toContain("@keyframes neodid-track-token-route");
    expect(css).toContain("@keyframes neodid-track-token-route-mobile");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(".neodid-identity-track__token");
    expect(css).toContain("animation: none !important");
  });
});
