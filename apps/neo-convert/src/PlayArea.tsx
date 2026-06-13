/**
 * PlayArea.tsx — Neo Convert PlayArea.
 *
 * Key conversion, account generation, and balance checking tool.
 */

import { useState, type KeyboardEvent } from "react";
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
  scriptHash?: string;
  scriptHashLE?: string;
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
  const showGeneratedSecrets = bool("showGeneratedSecrets");
  const showConversionSecrets = bool("showConversionSecrets");
  const accountsGenerated = str("accountsGenerated", "0");
  const conversionView = val<ConversionView | null>("conversionResult", null);
  const conversionStatus = str("conversionStatus");
  const conversionStatusType = str("conversionStatusType");
  const copyStatus = str("copyStatus");
  const walletConnected = bool("walletConnected");
  // Without a connected wallet the balance refs hold their createObservable(0)
  // defaults — show the calm em-dash placeholder instead of "0 NEO / 0 GAS",
  // which reads as a real zero balance.
  const BALANCE_PLACEHOLDER = "—";
  const formattedNeoBalance = walletConnected ? str("formattedNeoBalance", "0") : BALANCE_PLACEHOLDER;
  const formattedGasBalance = walletConnected ? str("formattedGasBalance", "0") : BALANCE_PLACEHOLDER;
  const generatedRows: ResultRow[] =
    hasGeneratedAccount && generatedAccount
      ? [
          {
            key: "address",
            label: t("address"),
            value: generatedAccount.address ?? "",
          },
          {
            key: "publicKey",
            label: t("pubKey"),
            value: generatedAccount.publicKey ?? "",
          },
          {
            key: "privateKey",
            label: t("privKeyLabel"),
            value: generatedAccount.privateKey ?? "",
            sensitive: true,
          },
          {
            key: "wif",
            label: t("wifLabel"),
            value: generatedAccount.wif ?? "",
            sensitive: true,
          },
        ].filter((row) => row.value)
      : [];
  const conversionRows: ResultRow[] = conversionView
    ? [
        {
          key: "address",
          label: t("address"),
          value: conversionView.address ?? "",
        },
        {
          key: "scriptHash",
          label: t("scriptHashLabel"),
          value: conversionView.scriptHash ?? "",
        },
        {
          key: "scriptHashLE",
          label: t("scriptHashLeLabel"),
          value: conversionView.scriptHashLE ?? "",
        },
        {
          key: "publicKey",
          label: t("pubKey"),
          value: conversionView.publicKey ?? "",
        },
        {
          key: "privateKey",
          label: t("privKeyLabel"),
          value: conversionView.privateKey ?? "",
          sensitive: true,
        },
        {
          key: "wif",
          label: t("wifLabel"),
          value: conversionView.wif ?? "",
          sensitive: true,
        },
        {
          key: "opcodes",
          label: t("disassembledOpcodes"),
          value: conversionView.opcodes?.join("\n") ?? "",
          multiline: true,
        },
      ].filter((row) => row.value)
    : [];
  const hasSensitiveConversion = conversionRows.some((row) => row.sensitive);
  // conversionStatus is always one of the detected*/unknownFormat message keys,
  // all of which are defined in the locale — translate it directly.
  const statusLabel = conversionStatus ? t(conversionStatus) : "";
  // The conversion-status box must also render the error state. unknownFormat
  // clears the result (so hasConversionResult is false), which previously left
  // the only error feedback as a 3s toast and the panel looking untouched.
  const showConversionStatus = hasConversionResult || conversionStatusType === "error";

  // Enter-to-submit for the converter input. The shared NeoInput renders a real
  // <input> whose keydown bubbles to this wrapper, so catch it here rather than
  // modifying the shared component.
  const handleConvertKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter") return;
    if (!keyInput.trim() || isLoading) return;
    event.preventDefault();
    void dispatch("convert", keyInput);
  };

  const renderResultRows = (rows: ResultRow[], showSecrets: boolean) => (
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
                {t("copy")}
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
            <span className="convert-hero__eyebrow">{t("appTitle")}</span>
            <h2 className="convert-hero__title">{t("heroTitle")}</h2>
            <p className="convert-hero__subtitle">
              {t("heroSubtitle")}
            </p>
          </div>
          <div className="convert-hero__stats">
            <div className="convert-stat">
              <span className="convert-stat__value">{accountsGenerated}</span>
              <span className="convert-stat__label">{t("accountsGenerated")}</span>
            </div>
            {/* The NEO/GAS balance tiles only carry meaning once a wallet is
                connected. Disconnected they would read as two "—" tiles that
                merely repeat the connect note below them, so reveal them on
                connect and let the note carry the disconnected state. */}
            {walletConnected && (
              <>
                <div className="convert-stat">
                  <span className="convert-stat__value">{formattedNeoBalance}</span>
                  <span className="convert-stat__label">{t("neoBalance")}</span>
                </div>
                <div className="convert-stat">
                  <span className="convert-stat__value">{formattedGasBalance}</span>
                  <span className="convert-stat__label">{t("gasBalance")}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {!walletConnected && (
          <p className="convert-balance-note">{t("connectForBalances")}</p>
        )}

        <div className="convert-section">
          <NeoButton
            variant="primary"
            block
            loading={isLoading}
            onClick={() => dispatch("generate")}
          >
            {t("generateNewAccount")}
          </NeoButton>
          {hasGeneratedAccount && generatedAccount && (
            <div className="generated-result">
              {renderResultRows(generatedRows, showGeneratedSecrets)}
              <NeoButton
                size="sm"
                variant="secondary"
                onClick={() => dispatch("toggleGeneratedSecrets")}
              >
                {showGeneratedSecrets ? t("hideSecrets") : t("showSecrets")}
              </NeoButton>
              <NeoButton
                size="sm"
                variant="secondary"
                disabled={!showGeneratedSecrets}
                onClick={() => dispatch("downloadPaperWallet")}
              >
                {t("downloadPdf")}
              </NeoButton>
              {!showGeneratedSecrets && (
                <span className="convert-secret-note">
                  {t("paperWalletRequiresReveal")}
                </span>
              )}
              {copyStatus && <span className="convert-copy-status">{copyStatus}</span>}
            </div>
          )}
        </div>
      </NeoCard>

      <NeoCard variant="erobo" title={t("convertKey")}>
        <div className="convert-section">
          <p className="convert-hint">
            {t("convertHint")}
          </p>
          <div onKeyDown={handleConvertKeyDown}>
            <NeoInput
              value={keyInput}
              onChange={(v) => setKeyInput(v)}
              placeholder={t("enterKeyPlaceholder")}
            />
          </div>
          <NeoButton
            variant="primary"
            block
            loading={isLoading}
            disabled={!keyInput.trim()}
            onClick={() => dispatch("convert", keyInput)}
          >
            {t("convert")}
          </NeoButton>
          {showConversionStatus && (
            <div className={`conversion-status conversion-status--${conversionStatusType}`}>
              <div className="conversion-status__head">
                <span>{statusLabel}</span>
                {hasSensitiveConversion && (
                  <NeoButton
                    size="sm"
                    variant="secondary"
                    onClick={() => dispatch("toggleConversionSecrets")}
                  >
                    {showConversionSecrets ? t("hideSecrets") : t("showSecrets")}
                  </NeoButton>
                )}
              </div>
              {/* Success rows when present; an error (e.g. unknownFormat) shows
                  only the localized status head above with no result body. */}
              {conversionRows.length > 0 && renderResultRows(conversionRows, showConversionSecrets)}
            </div>
          )}
        </div>
      </NeoCard>

      {/* Reference card — anchors the resting page with purposeful guidance on
          the accepted input formats plus the on-device security note, instead
          of leaving the lower half of the viewport blank. */}
      <NeoCard variant="erobo" title={t("formatsTitle")} className="convert-formats">
        <ul className="convert-formats__list">
          <li>
            <span className="convert-formats__label">{t("formatWifLabel")}</span>
            <span className="convert-formats__desc">{t("formatWifDesc")}</span>
          </li>
          <li>
            <span className="convert-formats__label">{t("formatPrivateKeyLabel")}</span>
            <span className="convert-formats__desc">{t("formatPrivateKeyDesc")}</span>
          </li>
          <li>
            <span className="convert-formats__label">{t("formatPublicKeyLabel")}</span>
            <span className="convert-formats__desc">{t("formatPublicKeyDesc")}</span>
          </li>
          <li>
            <span className="convert-formats__label">{t("formatScriptLabel")}</span>
            <span className="convert-formats__desc">{t("formatScriptDesc")}</span>
          </li>
        </ul>
        <p className="convert-formats__note">
          <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
          <span>{t("onDeviceNote")}</span>
        </p>
      </NeoCard>

      {balancesLoading && (
        <div className="loading-state">
          <div className="loading-spinner" />
          <span>{t("loadingBalances")}</span>
        </div>
      )}
    </div>
  );
}
