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
    convertPanelCopy: "Paste once and inspect the safe derived values.",
    convertPanelTitle: "Decode a key, address, or script",
    detectedPrivKey: "Detected: Private Key",
    disassembledOpcodes: "Disassembled Opcodes",
    downloadPdf: "Download Paper Wallet (PDF)",
    emptyOutputCopy: "Unknown or malformed input shows a clear status.",
    emptyOutputTitle: "Output appears after a valid paste",
    enterKeyPlaceholder: "Enter WIF, hex, or address...",
    formatAutodetectPill: "Format auto-detect",
    formatPrivateKeyDesc: "64-character hex private key.",
    formatPrivateKeyLabel: "Private key",
    formatPublicKeyDesc: "Compressed public key.",
    formatPublicKeyLabel: "Public key",
    formatRailTitle: "Supported formats",
    formatScriptDesc: "Verification script hex.",
    formatScriptLabel: "NeoVM script",
    formatsTitle: "What you can paste",
    formatWifDesc: "Wallet Import Format private key.",
    formatWifLabel: "WIF",
    gasBalance: "GAS Balance",
    generatePanelCopy: "Generate a Neo N3 account locally.",
    generatePanelTitle: "Create an offline-ready wallet",
    generateNewAccount: "Generate New Account",
    genEmptyState: "Click Generate to create a new Neo N3 account safely on your device.",
    genEmptySub: "Click Generate to create a new offline wallet",
    heroSubtitle: "Securely generate accounts and convert keys client-side.",
    heroTitle: "Neo N3 Toolset",
    hideSecrets: "Hide secrets",
    localOnlyPill: "Local-only key work",
    neoBalance: "NEO Balance",
    onDeviceNote: "Key generation and conversion run entirely on your device.",
    paperWalletPill: "Paper wallet export",
    paperWalletRequiresReveal:
      "Reveal secrets before exporting the WIF-backed paper wallet.",
    privKeyLabel: "Private Key",
    pubKey: "Public Key",
    safetyLocal: "Secrets stay in this device session",
    safetyReveal: "Private values stay masked by default",
    safetyRpc: "Balances are optional read-only RPC",
    safetyTitle: "Safety model",
    showSecrets: "Show secrets",
    workbenchStageCopy: "The default view keeps secrets masked.",
    workbenchStageEyebrow: "Secure workbench",
    workbenchStageTitle: "Paste, derive, reveal only when you choose.",
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
  it("renders the key workbench stage and resting output state", () => {
    render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(
      document.querySelector('.convert-hero__image[src="./key-workbench-stage.jpg"]'),
    ).toBeTruthy();
    expect(screen.getByText("Output appears after a valid paste")).toBeTruthy();
  });

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

    const lockedDownloadButton = screen
      .getByText("Download Paper Wallet (PDF)")
      .closest("button");
    expect(lockedDownloadButton?.hasAttribute("disabled")).toBe(true);
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

    const revealedDownloadButton = screen
      .getByText("Download Paper Wallet (PDF)")
      .closest("button");
    expect(revealedDownloadButton?.hasAttribute("disabled")).toBe(false);
  });
});
