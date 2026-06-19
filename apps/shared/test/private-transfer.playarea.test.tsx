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
import { messages as privateTransferMessages } from "../../private-transfer/src/appConfig";
import {
  clearSealedIntents,
  readSealedIntents,
} from "../../private-transfer/src/history";

// The seal flow's real X25519-HKDF-AES envelope relies on WebCrypto X25519,
// which jsdom does not provide. Mock the envelope module so the copy-affordance
// test can exercise the stored state deterministically without crypto support.
vi.mock("../utils/morpheus-confidential-envelope", () => ({
  buildConfidentialTransferPackage: vi.fn(async () => ({
    confidentialPayload: { sealed: true },
    publicEnvelope: {
      note_commitment: "commitment-abc",
      nullifier_hash: "nullifier-def",
    },
  })),
  encryptJsonWithOraclePublicKey: vi.fn(async () => "ciphertext-stub"),
}));

(globalThis as typeof globalThis & { React: typeof React }).React = React;

const VALID_NEO_ADDRESS = "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32";
const originalFetch = globalThis.fetch;

// Resolve t() against the app's real English locale (with {param} interpolation)
// so the UI renders the same copy a user sees instead of raw key names.
const en = privateTransferMessages as Record<string, { en: string }>;
function t(key: string, params?: Record<string, string | number>): string {
  const value = en[key]?.en ?? key;
  if (!params) {
    return value;
  }
  return value.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`));
}

function state(): ObservableState {
  return {
    requestCount: createObservable(0),
    lastStatus: createObservable("Ready"),
    lastDigest: createObservable("—"),
    networkLabel: createObservable("Mainnet"),
  };
}

function props(setStatus = vi.fn(), appState: ObservableState = state()) {
  return {
    t,
    state: appState,
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
      network: "mainnet",
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
  clearSealedIntents();
});

describe("Private Transfer PlayArea", () => {
  it("keeps sealing disabled until recipient and amount are valid", () => {
    render(<PlayArea {...props()} />);

    const sealButton = screen.getByRole("button", {
      name: "Seal private transfer intent",
    }) as HTMLButtonElement;
    expect(sealButton.disabled).toBe(true);
    expect(screen.queryByRole("combobox")).toBeNull();

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

  it("always shows the no-funds-moved disclosure and badges off-app lifecycle steps", () => {
    render(<PlayArea {...props()} />);

    // The honest framing: this app seals an intent and never moves funds, so
    // the disclosure must be visible up front (not only inside an error state).
    expect(
      screen.getByText(
        "No funds were moved — this seals an encrypted intent for Morpheus confidential compute, not a payment.",
      ),
    ).toBeTruthy();

    // Steps 1 (Deposit) and 4 (Release/refund) are not performed here, so they
    // are badged "Not in this app"; the local-encryption/TEE steps are "In this app".
    expect(screen.getAllByText("Not in this app")).toHaveLength(2);
    expect(screen.getAllByText("In this app")).toHaveLength(2);
  });

  it("rejects fractional NEO amounts because NEO is indivisible", () => {
    render(<PlayArea {...props()} />);

    fireEvent.change(screen.getByPlaceholderText("N..."), {
      target: { value: VALID_NEO_ADDRESS },
    });

    fireEvent.click(screen.getByRole("radio", { name: "Asset: NEO" }));

    const amountInput = screen.getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: "0.5" } });

    const sealButton = screen.getByRole("button", {
      name: "Seal private transfer intent",
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
    fireEvent.click(screen.getByRole("button", { name: "Seal private transfer intent" }));

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

  it("keeps the network stat tile in sync with the in-form network picker", () => {
    // No chain service is injected, so the form defaults to mainnet — the lane
    // that currently serves a live Morpheus key — rather than the degraded
    // testnet default.
    globalThis.fetch = vi.fn(async () => ({
      ok: false,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    const appState = state();
    render(<PlayArea {...props(vi.fn(), appState)} />);

    // Seeds to the active (mainnet) selection on mount instead of "Neo N3".
    expect(appState.networkLabel?.get()).toBe("Mainnet");

    const testnetRadio = screen
      .getAllByRole("radio")
      .find((element) =>
        element.getAttribute("aria-label")?.startsWith("Network: Testnet"),
      );
    expect(testnetRadio).toBeTruthy();
    fireEvent.click(testnetRadio!);
    expect(appState.networkLabel?.get()).toBe("Testnet");

    const mainnetRadio = screen
      .getAllByRole("radio")
      .find((element) =>
        element.getAttribute("aria-label")?.startsWith("Network: Mainnet"),
      );
    expect(mainnetRadio).toBeTruthy();
    fireEvent.click(mainnetRadio!);
    expect(appState.networkLabel?.get()).toBe("Mainnet");
  });

  it("re-floors a fractional amount when switching from GAS to NEO", () => {
    render(<PlayArea {...props()} />);

    const amountInput = screen.getByRole("spinbutton") as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: "1.5" } });
    expect(amountInput.value).toBe("1.5");

    fireEvent.click(screen.getByRole("radio", { name: "Asset: NEO" }));

    // Fractional part dropped so the value is valid for indivisible NEO.
    expect(amountInput.value).toBe("1");
    expect(
      screen.queryByText(
        "NEO is indivisible — enter a whole number greater than zero.",
      ),
    ).toBeNull();
  });

  it("copies a sealed output value to the clipboard", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(globalThis.navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    const secretRef = "secret-ref-xyz";
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("public-key")) {
        return {
          ok: true,
          json: async () => ({
            public_key: "0".repeat(64),
            algorithm: "X25519-HKDF-SHA256-AES-256-GCM",
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({ secret_ref: secretRef }),
      };
    }) as unknown as typeof fetch;

    render(<PlayArea {...props()} />);
    fireEvent.change(screen.getByPlaceholderText("N..."), {
      target: { value: VALID_NEO_ADDRESS },
    });
    fireEvent.click(screen.getByRole("button", { name: "1 GAS" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Seal private transfer intent" }),
    );

    // The secret ref appears both in the result aside and the persisted
    // "Sealed intents" history card; copy the first (the result aside).
    const copyButtons = await screen.findAllByRole("button", {
      name: "Copy Secret ref",
    });
    fireEvent.click(copyButtons[0]);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(secretRef);
    });
    await screen.findByRole("button", { name: "Secret ref copied" });
  });

  it("persists a successful seal to local history and renders the Sealed intents card", async () => {
    const secretRef = "secret-ref-persisted";
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("public-key")) {
        return {
          ok: true,
          json: async () => ({
            public_key: "0".repeat(64),
            algorithm: "X25519-HKDF-SHA256-AES-256-GCM",
          }),
        };
      }
      return {
        ok: true,
        json: async () => ({ secret_ref: secretRef }),
      };
    }) as unknown as typeof fetch;

    const appState = state();
    render(<PlayArea {...props(vi.fn(), appState)} />);
    fireEvent.change(screen.getByPlaceholderText("N..."), {
      target: { value: VALID_NEO_ADDRESS },
    });
    fireEvent.click(screen.getByRole("button", { name: "1 GAS" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Seal private transfer intent" }),
    );

    // The secret ref is written to safe-storage so it survives a remount.
    await waitFor(() => {
      expect(readSealedIntents()).toHaveLength(1);
    });
    expect(readSealedIntents()[0].secretRef).toBe(secretRef);

    // requestCount stat tracks the persisted count, not in-memory state only.
    expect(appState.requestCount?.get()).toBe(1);
    // The Sealed intents history card is now rendered.
    expect(screen.getByText("Sealed intents")).toBeTruthy();

    // Clearing the history wipes storage and resets the count.
    fireEvent.click(screen.getByRole("button", { name: "Clear sealed intents history" }));
    expect(readSealedIntents()).toHaveLength(0);
    expect(appState.requestCount?.get()).toBe(0);
  });

  it("surfaces the upstream store detail when the proxy returns an inline fallback", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("public-key")) {
        return {
          ok: true,
          json: async () => ({
            public_key: "0".repeat(64),
            algorithm: "X25519-HKDF-SHA256-AES-256-GCM",
          }),
        };
      }
      // The host proxy converts an upstream 404 into a 200 inline fallback.
      return {
        ok: true,
        json: async () => ({
          status: "inline_fallback",
          inline_fallback: true,
          store_available: false,
          upstream_status: 404,
          error: "not found",
        }),
      };
    }) as unknown as typeof fetch;

    render(<PlayArea {...props()} />);
    fireEvent.change(screen.getByPlaceholderText("N..."), {
      target: { value: VALID_NEO_ADDRESS },
    });
    fireEvent.click(screen.getByRole("button", { name: "1 GAS" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Seal private transfer intent" }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "Morpheus confidential storage is temporarily unavailable. Your transfer details remain local.",
        ),
      ).toBeTruthy();
    });
    // The upstream detail (status + reason) is surfaced, not discarded.
    expect(screen.getByText(/not found \(404\)/)).toBeTruthy();
    // Nothing was persisted on a failed seal.
    expect(readSealedIntents()).toHaveLength(0);
    expect(warnSpy).toHaveBeenCalled();
  });
});
