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
import PlayArea from "../../private-transfer/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const VALID_NEO_ADDRESS = "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32";
const originalFetch = globalThis.fetch;

function state(): ObservableState {
  return {
    requestCount: createObservable(0),
    lastStatus: createObservable("Ready"),
    lastDigest: createObservable("N/A"),
  };
}

function props(setStatus = vi.fn()) {
  return {
    t: (key: string) => key,
    state: state(),
    dispatch: vi.fn(async () => undefined),
    services: {},
    status: null,
    setStatus,
    clearStatus: vi.fn(),
    loadError: null,
    retryLoad: vi.fn(async () => undefined),
    launchContext: {
      appId: "miniapp-private-transfer",
      source: "url",
      operation: null,
      tab: null,
      network: "testnet",
      params: {},
      keys: [],
      hasParams: false,
      signature: "",
    },
  } as React.ComponentProps<typeof PlayArea>;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
});

describe("Private Transfer PlayArea", () => {
  it("keeps sealing disabled until recipient and amount are valid", () => {
    render(<PlayArea {...props()} />);

    const sealButton = screen.getByRole("button", {
      name: "Seal private transfer",
    }) as HTMLButtonElement;
    expect(sealButton.disabled).toBe(true);

    const recipientInput = screen.getByPlaceholderText("N...");

    fireEvent.change(recipientInput, {
      target: { value: "not-a-neo-address" },
    });
    expect(screen.getByText("Enter a valid Neo N3 address.")).toBeTruthy();

    fireEvent.change(recipientInput, {
      target: { value: VALID_NEO_ADDRESS },
    });
    fireEvent.click(screen.getByRole("button", { name: "1 GAS" }));

    expect(screen.queryByText("Enter a valid Neo N3 address.")).toBeNull();
    expect(sealButton.disabled).toBe(false);
  });

  it("rejects fractional NEO amounts because NEO is indivisible", () => {
    render(<PlayArea {...props()} />);

    fireEvent.change(screen.getByPlaceholderText("N..."), {
      target: { value: VALID_NEO_ADDRESS },
    });

    const assetSelect = screen.getByDisplayValue("GAS") as HTMLSelectElement;
    fireEvent.change(assetSelect, { target: { value: "NEO" } });

    const amountInput = screen.getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: "0.5" } });

    const sealButton = screen.getByRole("button", {
      name: "Seal private transfer",
    }) as HTMLButtonElement;
    expect(sealButton.disabled).toBe(true);
    expect(
      screen.getByText(
        "NEO is indivisible — enter a whole number greater than zero.",
      ),
    ).toBeTruthy();
    expect(amountInput.step).toBe("1");

    fireEvent.change(amountInput, { target: { value: "2" } });
    expect(
      screen.queryByText(
        "NEO is indivisible — enter a whole number greater than zero.",
      ),
    ).toBeNull();
    expect(sealButton.disabled).toBe(false);
  });

  it("normalizes Morpheus service errors before rendering them", async () => {
    const setStatus = vi.fn();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      json: async () => ({
        error: "DATABASE_PASSWORD=secret raw Morpheus stack trace",
      }),
    })) as unknown as typeof fetch;

    const { container } = render(<PlayArea {...props(setStatus)} />);

    fireEvent.change(screen.getByPlaceholderText("N..."), {
      target: { value: VALID_NEO_ADDRESS },
    });
    fireEvent.click(screen.getByRole("button", { name: "1 GAS" }));
    fireEvent.click(screen.getByRole("button", { name: "Seal private transfer" }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Morpheus sealing is unavailable for this network. Your transfer details remain local.",
        ),
      ).toBeTruthy();
    });

    expect(container.textContent).not.toContain("DATABASE_PASSWORD");
    expect(container.textContent).not.toContain("raw Morpheus stack trace");
    expect(setStatus).toHaveBeenLastCalledWith(
      "Morpheus sealing is unavailable for this network. Your transfer details remain local.",
      "error",
    );
    expect(warnSpy).toHaveBeenCalled();
  });
});
