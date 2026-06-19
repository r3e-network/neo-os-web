import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import type { PlatformServices } from "../services";
import PlayArea from "../../oracle-compute-lab/src/PlayArea";
import { messages } from "../../oracle-compute-lab/src/appConfig";

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

function state(): ObservableState {
  return {
    networkLabel: createObservable("Morpheus Testnet"),
    endpointLabel: createObservable("Compute workflow"),
    requestCount: createObservable(0),
    lastDigest: createObservable("N/A"),
    lastStatus: createObservable("Ready"),
  };
}

function services(copy = vi.fn(async () => undefined)) {
  return {
    clipboard: { copy },
  } as unknown as PlatformServices;
}

function props(copy = vi.fn(async () => undefined)) {
  return {
    t,
    state: state(),
    dispatch: vi.fn(async () => undefined),
    services: services(copy),
    status: null,
    setStatus: vi.fn(),
    clearStatus: vi.fn(),
    loadError: null,
    retryLoad: vi.fn(async () => undefined),
    launchContext: { params: {}, network: "testnet" },
  };
}

afterEach(() => cleanup());

describe("Oracle Compute Lab PlayArea", () => {
  it("builds a sealed preview without leaking the textarea secret", async () => {
    const copy = vi.fn(async () => undefined);
    const { container } = render(<PlayArea {...props(copy)} />);

    fireEvent.change(screen.getByLabelText("Input Payload"), {
      target: { value: "{\"secret\":\"do-not-leak\",\"asset\":\"GAS\"}" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Build Preview" }));

    const payload = container.querySelector(".console-tool__payload-card pre");
    expect(payload?.textContent).toContain("oracle.compute.request");
    expect(payload?.textContent).toContain("inputDigest");
    expect(payload?.textContent).toContain("[sealed input redacted]");
    expect(payload?.textContent).not.toContain("do-not-leak");

    fireEvent.click(screen.getByRole("button", { name: "Copy" }));
    await waitFor(() => expect(copy).toHaveBeenCalled());
    expect(copy.mock.calls[0]?.[0]).not.toContain("do-not-leak");
  });

  it("shows raw input only after the user switches to public mode", () => {
    const { container } = render(<PlayArea {...props()} />);

    fireEvent.click(screen.getByRole("radio", { name: "Privacy: Public" }));
    fireEvent.change(screen.getByLabelText("Input Payload"), {
      target: { value: "{\"sample\":\"public-data\"}" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Build Preview" }));

    const payload = container.querySelector(".console-tool__payload-card pre");
    expect(payload?.textContent).toContain("\"privacy\": \"public\"");
    expect(payload?.textContent).toContain("public-data");
  });
});
