import React from "react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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
    flowDeriveActive: "Deriving formats on this device.",
    flowDeriveComplete: "Derived values are ready to inspect.",
    flowDeriveIdle: "No derivation runs until you convert.",
    flowDeriveLabel: "Derive",
    flowDeriveReady: "Ready to derive address and script data.",
    flowInputIdle: "Paste key material to arm the workbench.",
    flowInputLabel: "Input",
    flowInputReady: "Key material is staged locally.",
    flowOutputError: "Format was not recognized.",
    flowOutputIdle: "Results stay masked until output is available.",
    flowOutputLabel: "Inspect",
    flowOutputReady: "Copy only the value you verified.",
    flowStageEyebrow: "Local pipeline",
    flowStageResting: "Waiting for key material",
    flowStageTitle: "Local conversion flow",
    formatAutodetectPill: "Format auto-detect",
    formatPrivateKeyDesc: "64-character hex private key.",
    formatPrivateKeyLabel: "Private key",
    formatPrivateKeyPlaceholder: "Paste 64-character private key hex...",
    formatPrivateKeyWorkbenchHint:
      "Private key hex is raw secret material. The workbench keeps derived WIF and address values masked until you reveal them.",
    formatPublicKeyDesc: "Compressed public key.",
    formatPublicKeyLabel: "Public key",
    formatPublicKeyPlaceholder:
      "Paste compressed public key starting with 02 or 03...",
    formatPublicKeyWorkbenchHint:
      "Public keys are not secret. Use this lane to derive addresses and script hashes before sharing or wiring contracts.",
    formatRailTitle: "Supported formats",
    formatScriptDesc: "Verification script hex.",
    formatScriptLabel: "NeoVM script",
    formatScriptPlaceholder: "Paste NeoVM verification script hex...",
    formatScriptWorkbenchHint:
      "Script mode turns verification hex into script hash and opcode output so you can inspect the contract-facing shape.",
    formatsTitle: "What you can paste",
    formatWifDesc: "Wallet Import Format private key.",
    formatWifLabel: "WIF",
    formatWifPlaceholder: "Paste WIF starting with K or L...",
    formatWifWorkbenchHint:
      "WIF is the safest import/export lane. Paste it here to derive the address, public key, and private hex locally.",
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
    expect(screen.getByText("Local pipeline")).toBeTruthy();
    expect(screen.getByText("Waiting for key material")).toBeTruthy();
    expect(document.querySelector(".convert-pipeline--idle")).toBeTruthy();
    expect(document.querySelector(".convert-format-rail")).toBeTruthy();
    expect(document.querySelectorAll(".convert-format-card img")).toHaveLength(4);
    expect(screen.getByText("Output appears after a valid paste")).toBeTruthy();
  });

  it("uses format resource cards to tune the input lane", () => {
    render(<PlayArea t={t} state={state()} dispatch={vi.fn()} />);

    expect(
      screen.getByPlaceholderText("Paste WIF starting with K or L..."),
    ).toBeTruthy();

    const publicKeyCard = screen.getByRole("radio", { name: /Public key/ });
    fireEvent.click(publicKeyCard);

    expect(publicKeyCard.getAttribute("aria-checked")).toBe("true");
    expect(
      screen.getByText(
        "Public keys are not secret. Use this lane to derive addresses and script hashes before sharing or wiring contracts.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByPlaceholderText(
        "Paste compressed public key starting with 02 or 03...",
      ),
    ).toBeTruthy();
  });

  it("turns the converter panel into an active local pipeline while processing", () => {
    render(
      <PlayArea
        t={t}
        state={state({
          isLoading: true,
        })}
        dispatch={vi.fn()}
      />,
    );

    expect(screen.getByText("Deriving formats on this device.")).toBeTruthy();
    expect(document.querySelector(".convert-pipeline--processing")).toBeTruthy();
    expect(document.querySelector(".convert-pipeline-step--active")).toBeTruthy();
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

    expect(screen.getAllByText("Detected: Private Key").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Derived values are ready to inspect.")).toBeTruthy();
    expect(screen.getByText("Copy only the value you verified.")).toBeTruthy();
    expect(document.querySelector(".convert-pipeline--complete")).toBeTruthy();
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

  it("keeps format card visuals and motion reduced-motion safe", () => {
    const styles = readFileSync(
      resolve(process.cwd(), "../neo-convert/src/PlayArea.scss"),
      "utf8",
    );

    expect(styles).toContain(".convert-format-card");
    expect(styles).toContain(".convert-format-card__media img");
    expect(styles).toContain("@keyframes convert-format-card-lock");
    expect(styles).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
