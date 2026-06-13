import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable, type ObservableState } from "../react/context";
import PlayArea from "../../neo-convert/src/PlayArea";

(globalThis as typeof globalThis & { React: typeof React }).React = React;

afterEach(() => cleanup());

function t(key: string) {
  const messages: Record<string, string> = {
    accountsGenerated: "Accounts",
    address: "Address",
    convert: "Convert",
    convertHint:
      "Paste a WIF, private key, public key, or NeoVM script. Everything is processed locally.",
    convertKey: "Convert Key",
    detectedPrivKey: "Detected: Private Key",
    disassembledOpcodes: "Disassembled Opcodes",
    downloadPdf: "Download Paper Wallet (PDF)",
    enterKeyPlaceholder: "Enter WIF, hex, or address...",
    gasBalance: "GAS Balance",
    generateNewAccount: "Generate New Account",
    heroSubtitle: "Securely generate accounts and convert keys client-side.",
    heroTitle: "Neo N3 Toolset",
    hideSecrets: "Hide secrets",
    neoBalance: "NEO Balance",
    paperWalletRequiresReveal:
      "Reveal secrets before exporting the WIF-backed paper wallet.",
    privKeyLabel: "Private Key",
    pubKey: "Public Key",
    showSecrets: "Show secrets",
    wifLabel: "WIF",
  };
  return messages[key] ?? key;
}

function state(overrides: Partial<Record<string, unknown>> = {}): ObservableState {
  const values: Record<string, unknown> = {
    isLoading: false,
    balancesLoading: false,
    hasGeneratedAccount: false,
    generatedAccount: null,
    hasConversionResult: false,
    showGeneratedSecrets: false,
    showConversionSecrets: false,
    walletConnected: true,
    accountsGenerated: "0",
    conversionResult: {
      address: "",
      publicKey: "",
      privateKey: "",
      wif: "",
      opcodes: [],
      scriptHash: "",
      scriptHashLE: "",
    },
    conversionStatus: "",
    conversionStatusType: "",
    copyStatus: "",
    formattedNeoBalance: "0 NEO",
    formattedGasBalance: "0 GAS",
    ...overrides,
  };

  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      createObservable(value),
    ]),
  );
}

describe("Neo Convert PlayArea", () => {
  it("keeps generated private material hidden until the user reveals it", () => {
    const privateKey = "ab".repeat(32);
    const wif = "K".repeat(52);
    const { rerender } = render(
      <PlayArea
        t={t}
        state={state({
          hasGeneratedAccount: true,
          generatedAccount: {
            address: "NabcGeneratedAddress",
            publicKey: "03" + "cd".repeat(32),
            privateKey,
            wif,
          },
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(screen.getByText("NabcGeneratedAddress")).toBeTruthy();
    expect(screen.queryByText(privateKey)).toBeNull();
    expect(screen.queryByText(wif)).toBeNull();
    expect(screen.getAllByText(/\*{8}/).length).toBeGreaterThan(0);

    rerender(
      <PlayArea
        t={t}
        state={state({
          hasGeneratedAccount: true,
          showGeneratedSecrets: true,
          generatedAccount: {
            address: "NabcGeneratedAddress",
            publicKey: "03" + "cd".repeat(32),
            privateKey,
            wif,
          },
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(screen.getByText(privateKey)).toBeTruthy();
    expect(screen.getByText(wif)).toBeTruthy();
  });

  it("renders converted fields instead of object placeholders", () => {
    render(
      <PlayArea
        t={t}
        state={state({
          hasConversionResult: true,
          conversionStatus: "detectedPrivKey",
          conversionStatusType: "success",
          conversionResult: {
            address: "NconvertedAddress",
            publicKey: "03" + "11".repeat(32),
            privateKey: "22".repeat(32),
            wif: "L".repeat(52),
            opcodes: [],
          },
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(screen.getByText("Detected: Private Key")).toBeTruthy();
    expect(screen.getByText("NconvertedAddress")).toBeTruthy();
    expect(screen.queryByText("[object Object]")).toBeNull();
  });

  it("enables paper wallet export only after secrets are revealed", () => {
    const dispatch = vi.fn();
    const { rerender } = render(
      <PlayArea
        t={t}
        state={state({
          hasGeneratedAccount: true,
          generatedAccount: {
            address: "NabcGeneratedAddress",
            publicKey: "03" + "cd".repeat(32),
            privateKey: "ab".repeat(32),
            wif: "K".repeat(52),
          },
        })}
        dispatch={dispatch}
      />,
    );

    expect(
      screen.getByText("Download Paper Wallet (PDF)").hasAttribute("disabled"),
    ).toBe(true);
    expect(
      screen.getByText(
        "Reveal secrets before exporting the WIF-backed paper wallet.",
      ),
    ).toBeTruthy();

    rerender(
      <PlayArea
        t={t}
        state={state({
          hasGeneratedAccount: true,
          showGeneratedSecrets: true,
          generatedAccount: {
            address: "NabcGeneratedAddress",
            publicKey: "03" + "cd".repeat(32),
            privateKey: "ab".repeat(32),
            wif: "K".repeat(52),
          },
        })}
        dispatch={dispatch}
      />,
    );

    expect(
      screen.getByText("Download Paper Wallet (PDF)").hasAttribute("disabled"),
    ).toBe(false);
  });
});
