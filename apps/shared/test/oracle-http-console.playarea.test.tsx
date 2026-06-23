import { readFileSync } from "node:fs";
import React from "react";
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
import PlayArea from "../../oracle-http-console/src/PlayArea";
import { messages } from "../../oracle-http-console/src/appConfig";

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

function clickPreview() {
  const buttons = screen.getAllByRole("button", { name: "Preview Request" });
  fireEvent.click(buttons[buttons.length - 1]);
}

afterEach(() => cleanup());

describe("Oracle HTTP Console PlayArea", () => {
  it("builds a POST receipt from the request pipeline without a global success toast", () => {
    const state = makeState();
    const setStatus = vi.fn();
    const { container } = render(<PlayArea {...makeProps(state, setStatus)} />);

    expect(container.querySelector(".http-pipeline-panel")).toBeTruthy();
    expect(container.querySelector(".http-route-stage")).toBeTruthy();
    expect(container.querySelector(".http-route-node--source")).toBeTruthy();
    expect(container.querySelector(".http-route-node--extract")).toBeTruthy();
    expect(container.querySelector(".http-route-node--digest")).toBeTruthy();
    expect(
      container.querySelectorAll(".http-route-connector__packet").length,
    ).toBe(2);
    expect(container.querySelectorAll(".http-signal-chip--ok").length).toBe(3);
    expect((screen.getByLabelText("URL") as HTMLInputElement).value).toBe(
      "https://oracle.meshmini.app/mainnet/health",
    );
    expect(screen.getByText("Live oracle route")).toBeTruthy();
    expect(screen.getByText("Digest beacon")).toBeTruthy();

    fireEvent.click(screen.getByRole("radio", { name: "Method: POST" }));
    const body = container.querySelector(
      ".http-body-editor textarea",
    ) as HTMLTextAreaElement;
    expect(body.disabled).toBe(false);
    fireEvent.change(body, { target: { value: '{"sample":true}' } });

    clickPreview();

    expect(screen.getByText("POST oracle request prepared")).toBeTruthy();
    expect(
      container.querySelector(".http-payload-card pre")?.textContent,
    ).toContain("sample");
    expect(state.requestCount?.get?.()).toBe(1);
    expect(state.lastDigest?.get?.()).toBe("0xe052e509");
    expect(setStatus).not.toHaveBeenCalled();
  });

  it("keeps invalid input visible and announces a warning status", () => {
    const state = makeState();
    const setStatus = vi.fn();
    render(<PlayArea {...makeProps(state, setStatus)} />);

    fireEvent.change(screen.getByLabelText("URL"), {
      target: { value: "ftp://example.com/data" },
    });
    clickPreview();

    expect(document.querySelector(".http-route-stage--warn")).toBeTruthy();
    expect(document.querySelector(".http-signal-chip--warn")).toBeTruthy();
    expect(
      screen.getAllByText("Enter a valid http(s) URL").length,
    ).toBeGreaterThan(0);
    expect(state.requestCount?.get?.()).toBe(0);
    expect(state.lastDigest?.get?.()).toBe("—");
    expect(setStatus).toHaveBeenCalledWith(
      "Enter a valid http(s) URL",
      "warning",
    );
  });

  it("keeps one primary preview action and exposes local route and copy motion", async () => {
    const state = makeState();
    const services = makeServices();
    const { container } = render(
      <PlayArea {...makeProps(state)} services={services} />,
    );

    expect(container.querySelector(".http-summary-strip")).toBeNull();
    expect(
      screen.getAllByRole("button", { name: "Preview Request" }),
    ).toHaveLength(1);

    clickPreview();

    await waitFor(() => {
      expect(container.querySelector(".http-play-area--routing")).toBeTruthy();
      expect(
        container.querySelector(".http-route-stage--routing"),
      ).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "Routing request..." }),
      ).toBeTruthy();
    });
    expect(container.firstElementChild?.getAttribute("aria-busy")).toBe("true");
    expect(
      container.querySelector(".http-route-stage")?.getAttribute("aria-busy"),
    ).toBe("true");

    fireEvent.click(screen.getByRole("button", { name: "Routing request..." }));
    expect(state.requestCount?.get?.()).toBe(1);

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));

    await waitFor(() => {
      expect(container.querySelector(".http-play-area--copying")).toBeTruthy();
      expect(
        container.querySelector(".http-result-card--copying"),
      ).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "Copying payload..." }),
      ).toBeTruthy();
    });
    expect(services.clipboard.copy).toHaveBeenCalledTimes(1);
  });

  it("keeps HTTP route motion with a reduced-motion fallback", () => {
    const styles = readFileSync(
      "../oracle-http-console/src/PlayArea.scss",
      "utf8",
    );

    expect(styles).toContain(".http-route-stage--routing");
    expect(styles).toContain("@keyframes http-route-node-routing");
    expect(styles).toContain("@keyframes http-action-sweep");
    expect(styles).toContain(".http-result-card--copying");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
    expect(styles).toContain(".http-route-stage--routing::after");
    expect(styles).toContain(".http-result-card--copying::after");
  });
});
