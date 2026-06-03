/**
 * PlayArea.tsx — Neo Convert PlayArea.
 *
 * Key conversion, account generation, and balance checking tool.
 */

import { useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

interface NeoAccountSummary {
  address?: string;
  publicKey?: string;
  privateKey?: string;
  wif?: string;
}

interface ConversionView {
  address?: string;
  publicKey?: string;
  privateKey?: string;
  wif?: string;
  opcodes?: string[];
}

type ResultRow = {
  key: string;
  label: string;
  value: string;
  sensitive?: boolean;
  multiline?: boolean;
};

function maskSecret(value: string) {
  if (!value) return "";
  if (value.length <= 12) return "********";
  return `${value.slice(0, 6)}********${value.slice(-6)}`;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);
  const [keyInput, setKeyInput] = useState("");

  const isLoading = bool("isLoading");
  const balancesLoading = bool("balancesLoading");
  const hasGeneratedAccount = bool("hasGeneratedAccount");
  const generatedAccount = val<NeoAccountSummary | null>("generatedAccount") ?? null;
  const hasConversionResult = bool("hasConversionResult");
  const showSecrets = bool("showSecrets");
  const accountsGenerated = str("accountsGenerated", "0");
  const conversionResult = str("conversionResult");
  const conversionView = val<ConversionView | null>("conversionResult", null);
  const conversionStatus = str("conversionStatus");
  const conversionStatusType = str("conversionStatusType");
  const copyStatus = str("copyStatus");
  const formattedNeoBalance = str("formattedNeoBalance", "0");
  const formattedGasBalance = str("formattedGasBalance", "0");
  const generatedRows: ResultRow[] =
    hasGeneratedAccount && generatedAccount
      ? [
          {
            key: "address",
            label: t("address") || "Address",
            value: generatedAccount.address ?? "",
          },
          {
            key: "publicKey",
            label: t("pubKey") || "Public key",
            value: generatedAccount.publicKey ?? "",
          },
          {
            key: "privateKey",
            label: t("privKeyLabel") || "Private key",
            value: generatedAccount.privateKey ?? "",
            sensitive: true,
          },
          {
            key: "wif",
            label: t("wifLabel") || "WIF",
            value: generatedAccount.wif ?? "",
            sensitive: true,
          },
        ].filter((row) => row.value)
      : [];
  const conversionRows: ResultRow[] = conversionView
    ? [
        {
          key: "address",
          label: t("address") || "Address",
          value: conversionView.address ?? "",
        },
        {
          key: "publicKey",
          label: t("pubKey") || "Public key",
          value: conversionView.publicKey ?? "",
        },
        {
          key: "privateKey",
          label: t("privKeyLabel") || "Private key",
          value: conversionView.privateKey ?? "",
          sensitive: true,
        },
        {
          key: "wif",
          label: t("wifLabel") || "WIF",
          value: conversionView.wif ?? "",
          sensitive: true,
        },
        {
          key: "opcodes",
          label: t("disassembledOpcodes") || "Disassembled opcodes",
          value: conversionView.opcodes?.join("\n") ?? "",
          multiline: true,
        },
      ].filter((row) => row.value)
    : [];
  const hasSensitiveConversion = conversionRows.some((row) => row.sensitive);
  const statusLabel = conversionStatus
    ? t(conversionStatus) || conversionStatus
    : "";

  const renderResultRows = (rows: ResultRow[]) => (
    <div className="convert-result-list">
      {rows.map((row) => {
        const hidden = Boolean(row.sensitive && !showSecrets);
        const displayValue = hidden ? maskSecret(row.value) : row.value;
        return (
          <div
            key={row.key}
            className={`result-row ${row.multiline ? "result-row--multiline" : ""}`}
          >
            <span className="result-label">{row.label}</span>
            {row.multiline ? (
              <pre className="result-value result-value--pre mono">
                {displayValue}
              </pre>
            ) : (
              <code className="result-value mono">{displayValue}</code>
            )}
            {!hidden && (
              <NeoButton
                size="sm"
                variant="ghost"
                onClick={() => dispatch("copy", row.value)}
              >
                {t("copy") || "Copy"}
              </NeoButton>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="neo-convert-play-area">
      {/* Hero — identity + primary generate action in one card */}
      <NeoCard variant="erobo" className="convert-hero">
        <div className="convert-hero__head">
          <div className="convert-hero__badge" aria-hidden="true">
            <svg
              viewBox="0 0 24 24"
              width="24"
              height="24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.9"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <path d="M7 11V8a5 5 0 0 1 10 0v3" />
              <circle cx="12" cy="16" r="1.5" />
            </svg>
          </div>
          <div className="convert-hero__text">
            <span className="convert-hero__eyebrow">{t("appTitle") || "Neo N3 Converter"}</span>
            <h2 className="convert-hero__title">{t("heroTitle") || "Neo N3 Toolset"}</h2>
            <p className="convert-hero__subtitle">
              {t("heroSubtitle") || "Securely generate accounts and convert keys client-side."}
            </p>
          </div>
          <div className="convert-hero__stats">
            <div className="convert-stat">
              <span className="convert-stat__value">{accountsGenerated}</span>
              <span className="convert-stat__label">{t("accountsGenerated") || "Accounts"}</span>
            </div>
            <div className="convert-stat">
              <span className="convert-stat__value">{formattedNeoBalance}</span>
              <span className="convert-stat__label">{t("neoBalance") || "NEO Balance"}</span>
            </div>
            <div className="convert-stat">
              <span className="convert-stat__value">{formattedGasBalance}</span>
              <span className="convert-stat__label">{t("gasBalance") || "GAS Balance"}</span>
            </div>
          </div>
        </div>

        <div className="convert-section">
          <NeoButton
            variant="primary"
            block
            loading={isLoading}
            onClick={() => dispatch("generate")}
          >
            {t("generateNewAccount") || "Generate New Account"}
          </NeoButton>
          {hasGeneratedAccount && generatedAccount && (
            <div className="generated-result">
              {renderResultRows(generatedRows)}
              <NeoButton
                size="sm"
                variant="secondary"
                onClick={() => dispatch("toggleSecrets")}
              >
                {showSecrets ? t("hideSecrets") || "Hide" : t("showSecrets") || "Show Secrets"}
              </NeoButton>
              <NeoButton
                size="sm"
                variant="secondary"
                disabled={!showSecrets}
                onClick={() => dispatch("downloadPaperWallet")}
              >
                {t("downloadPdf") || "Download Paper Wallet (PDF)"}
              </NeoButton>
              {!showSecrets && (
                <span className="convert-secret-note">
                  {t("paperWalletRequiresReveal") ||
                    "Reveal secrets before exporting the WIF-backed paper wallet."}
                </span>
              )}
              {copyStatus && <span className="convert-copy-status">{copyStatus}</span>}
            </div>
          )}
        </div>
      </NeoCard>

      <NeoCard variant="erobo" title={t("convertKey") || "Convert Key"}>
        <div className="convert-section">
          <p className="convert-hint">
            {t("convertHint") ||
              "Paste a WIF, private key, public key, or NeoVM script — everything is processed on your device."}
          </p>
          <NeoInput
            value={keyInput}
            onChange={(v) => setKeyInput(v)}
            placeholder={t("enterKeyPlaceholder") || "Enter WIF, hex, or address..."}
          />
          <NeoButton
            variant="primary"
            block
            loading={isLoading}
            disabled={!keyInput.trim()}
            onClick={() => dispatch("convert", keyInput)}
          >
            {t("convert") || "Convert"}
          </NeoButton>
          {hasConversionResult && (
            <div className={`conversion-status conversion-status--${conversionStatusType}`}>
              <div className="conversion-status__head">
                <span>{statusLabel}</span>
                {hasSensitiveConversion && (
                  <NeoButton
                    size="sm"
                    variant="secondary"
                    onClick={() => dispatch("toggleSecrets")}
                  >
                    {showSecrets ? t("hideSecrets") || "Hide" : t("showSecrets") || "Show Secrets"}
                  </NeoButton>
                )}
              </div>
              {conversionRows.length > 0 ? (
                renderResultRows(conversionRows)
              ) : (
                <pre className="conversion-result">{conversionResult}</pre>
              )}
            </div>
          )}
        </div>
      </NeoCard>

      {balancesLoading && (
        <div className="loading-state">
          <div className="loading-spinner" />
          <span>{t("loadingBalances") || "Loading balances..."}</span>
        </div>
      )}
    </div>
  );
}
