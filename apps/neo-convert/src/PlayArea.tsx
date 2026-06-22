/**
 * PlayArea.tsx — Neo Convert PlayArea.
 *
 * Key conversion, account generation, and balance checking tool.
 */

import { useState, type KeyboardEvent } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  Download,
  Eye,
  EyeOff,
  FileCode2,
  KeyRound,
  LockKeyhole,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
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
  const formatSpecs = [
    { key: "wif", icon: KeyRound, label: t("formatWifLabel"), desc: t("formatWifDesc") },
    {
      key: "private",
      icon: LockKeyhole,
      label: t("formatPrivateKeyLabel"),
      desc: t("formatPrivateKeyDesc"),
    },
    {
      key: "public",
      icon: WalletCards,
      label: t("formatPublicKeyLabel"),
      desc: t("formatPublicKeyDesc"),
    },
    {
      key: "script",
      icon: FileCode2,
      label: t("formatScriptLabel"),
      desc: t("formatScriptDesc"),
    },
  ];
  const safetyNotes = [
    { key: "local", icon: ShieldCheck, label: t("safetyLocal") },
    { key: "reveal", icon: EyeOff, label: t("safetyReveal") },
    { key: "rpc", icon: RefreshCw, label: t("safetyRpc") },
  ];
  const keyInputReady = keyInput.trim().length > 0;
  const pipelineState = isLoading
    ? "processing"
    : conversionStatusType === "error"
      ? "error"
      : hasConversionResult
        ? "complete"
        : keyInputReady
          ? "armed"
          : "idle";
  const pipelineSteps = [
    {
      key: "input",
      icon: KeyRound,
      label: t("flowInputLabel"),
      detail: keyInputReady ? t("flowInputReady") : t("flowInputIdle"),
      state: keyInputReady || hasConversionResult ? "complete" : "idle",
    },
    {
      key: "derive",
      icon: RefreshCw,
      label: t("flowDeriveLabel"),
      detail: isLoading
        ? t("flowDeriveActive")
        : hasConversionResult
          ? t("flowDeriveComplete")
          : keyInputReady
            ? t("flowDeriveReady")
            : t("flowDeriveIdle"),
      state: isLoading ? "active" : hasConversionResult ? "complete" : keyInputReady ? "ready" : "idle",
    },
    {
      key: "output",
      icon: FileCode2,
      label: t("flowOutputLabel"),
      detail:
        conversionStatusType === "error"
          ? t("flowOutputError")
          : hasConversionResult
            ? t("flowOutputReady")
            : t("flowOutputIdle"),
      state: conversionStatusType === "error" ? "error" : hasConversionResult ? "complete" : "idle",
    },
  ];

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
                className="result-copy-button"
                onClick={() => dispatch("copy", row.value)}
              >
                <Copy size={14} aria-hidden="true" />
                <span>{t("copy")}</span>
              </NeoButton>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="neo-convert-play-area">
      <section className="convert-hero" aria-label={t("heroTitle")}>
        <img
          className="convert-hero__image"
          src="./key-workbench-stage.jpg"
          alt=""
          loading="eager"
          decoding="async"
        />
        <div className="convert-hero__shade" aria-hidden="true" />
        <div className="convert-hero__content">
          <div className="convert-hero__copy">
            <span className="convert-hero__eyebrow">{t("appTitle")}</span>
            <h2>{t("heroTitle")}</h2>
            <p>{t("heroSubtitle")}</p>
            <div className="convert-hero__pills" aria-label={t("safetyTitle")}>
              <span><ShieldCheck size={14} aria-hidden="true" />{t("localOnlyPill")}</span>
              <span><Sparkles size={14} aria-hidden="true" />{t("formatAutodetectPill")}</span>
              <span><QrCode size={14} aria-hidden="true" />{t("paperWalletPill")}</span>
            </div>
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
        <div className="convert-stage-caption">
          <span>{t("workbenchStageEyebrow")}</span>
          <strong>{t("workbenchStageTitle")}</strong>
          <small>{t("workbenchStageCopy")}</small>
        </div>
      </section>

      <section className="convert-safety-strip" aria-label={t("safetyTitle")}>
        {!walletConnected ? (
          <p className="convert-balance-note">{t("connectForBalances")}</p>
        ) : (
          <p className="convert-balance-note">{t("balanceRpcNote")}</p>
        )}
        <div className="convert-safety-strip__items">
          {safetyNotes.map((note) => {
            const Icon = note.icon;
            return (
              <span key={note.key}>
                <Icon size={15} aria-hidden="true" />
                {note.label}
              </span>
            );
          })}
        </div>
      </section>

      <div className="convert-workbench">
        <NeoCard variant="erobo" className="convert-panel convert-panel--primary">
          <div className="convert-panel__head">
            <span className="convert-panel__icon" aria-hidden="true">
              <RefreshCw size={20} />
            </span>
            <div>
              <span>{t("convertKey")}</span>
              <strong>{t("convertPanelTitle")}</strong>
              <p>{t("convertPanelCopy")}</p>
            </div>
          </div>
          <div className="convert-format-rail" aria-label={t("formatRailTitle")}>
            {formatSpecs.map((format) => {
              const Icon = format.icon;
              return (
                <span key={format.key}>
                  <Icon size={14} aria-hidden="true" />
                  {format.label}
                </span>
              );
            })}
          </div>
          <div
            className={`convert-pipeline convert-pipeline--${pipelineState}`}
            aria-label={t("flowStageTitle")}
          >
            <figure className="convert-pipeline__media">
              <img
                src="./key-workbench-stage.jpg"
                alt=""
                loading="lazy"
                decoding="async"
              />
              <figcaption>
                <span>{t("flowStageEyebrow")}</span>
                <strong>{statusLabel || t("flowStageResting")}</strong>
              </figcaption>
            </figure>
            <div className="convert-pipeline__steps">
              {pipelineSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.key}
                    className={`convert-pipeline-step convert-pipeline-step--${step.state}`}
                  >
                    <span className="convert-pipeline-step__icon" aria-hidden="true">
                      {step.state === "complete" ? <CheckCircle2 /> : <Icon />}
                    </span>
                    <span className="convert-pipeline-step__copy">
                      <strong>{step.label}</strong>
                      <small>{step.detail}</small>
                    </span>
                    {index < pipelineSteps.length - 1 && (
                      <ArrowRight className="convert-pipeline-step__arrow" aria-hidden="true" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="convert-section convert-input-desk">
            <p className="convert-hint">{t("convertHint")}</p>
            <div onKeyDown={handleConvertKeyDown}>
              <NeoInput
                className="convert-key-input"
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
              <RefreshCw size={16} aria-hidden="true" />
              <span>{t("convert")}</span>
            </NeoButton>
            {showConversionStatus ? (
              <div className={`conversion-status conversion-status--${conversionStatusType}`}>
                <div className="conversion-status__head">
                  <span>{statusLabel}</span>
                  {hasSensitiveConversion && (
                    <NeoButton
                      size="sm"
                      variant="secondary"
                      onClick={() => dispatch("toggleConversionSecrets")}
                    >
                      {showConversionSecrets ? (
                        <EyeOff size={14} aria-hidden="true" />
                      ) : (
                        <Eye size={14} aria-hidden="true" />
                      )}
                      <span>{showConversionSecrets ? t("hideSecrets") : t("showSecrets")}</span>
                    </NeoButton>
                  )}
                </div>
                {/* Success rows when present; an error (e.g. unknownFormat) shows
                    only the localized status head above with no result body. */}
                {conversionRows.length > 0 && renderResultRows(conversionRows, showConversionSecrets)}
              </div>
            ) : (
              <div className="convert-empty-output">
                <FileCode2 size={18} aria-hidden="true" />
                <div>
                  <strong>{t("emptyOutputTitle")}</strong>
                  <span>{t("emptyOutputCopy")}</span>
                </div>
              </div>
            )}
          </div>
        </NeoCard>

        <NeoCard variant="erobo" className="convert-panel convert-panel--vault">
          <div className="convert-panel__head">
            <span className="convert-panel__icon" aria-hidden="true">
              <KeyRound size={20} />
            </span>
            <div>
              <span>{t("generateNewAccount")}</span>
              <strong>{t("generatePanelTitle")}</strong>
              <p>{t("generatePanelCopy")}</p>
            </div>
          </div>
        <div className="convert-section">
          <NeoButton
            variant="primary"
            block
            loading={isLoading}
            onClick={() => dispatch("generate")}
          >
            <Sparkles size={16} aria-hidden="true" />
            <span>{t("generateNewAccount")}</span>
          </NeoButton>
          {hasGeneratedAccount && generatedAccount && (
            <div className="generated-result">
              {renderResultRows(generatedRows, showGeneratedSecrets)}
              <NeoButton
                size="sm"
                variant="secondary"
                onClick={() => dispatch("toggleGeneratedSecrets")}
              >
                {showGeneratedSecrets ? (
                  <EyeOff size={14} aria-hidden="true" />
                ) : (
                  <Eye size={14} aria-hidden="true" />
                )}
                <span>{showGeneratedSecrets ? t("hideSecrets") : t("showSecrets")}</span>
              </NeoButton>
              <NeoButton
                size="sm"
                variant="secondary"
                disabled={!showGeneratedSecrets}
                onClick={() => dispatch("downloadPaperWallet")}
              >
                <Download size={14} aria-hidden="true" />
                <span>{t("downloadPdf")}</span>
              </NeoButton>
              {!showGeneratedSecrets && (
                <span className="convert-secret-note">
                  {t("paperWalletRequiresReveal")}
                </span>
              )}
              {copyStatus && <span className="convert-copy-status">{copyStatus}</span>}
            </div>
          )}
          {!hasGeneratedAccount && (
            <div className="convert-vault-empty">
              <LockKeyhole size={22} aria-hidden="true" />
              <strong>{t("genEmptyState")}</strong>
              <span>{t("genEmptySub")}</span>
            </div>
          )}
        </div>
      </NeoCard>
      </div>

      {/* Reference card — anchors the resting page with purposeful guidance on
          the accepted input formats plus the on-device security note, instead
          of leaving the lower half of the viewport blank. */}
      <NeoCard variant="erobo" title={t("formatsTitle")} className="convert-formats">
        <ul className="convert-formats__list">
          {formatSpecs.map((format) => {
            const Icon = format.icon;
            return (
              <li key={format.key}>
                <Icon size={17} aria-hidden="true" />
                <span className="convert-formats__label">{format.label}</span>
                <span className="convert-formats__desc">{format.desc}</span>
              </li>
            );
          })}
        </ul>
        <p className="convert-formats__note">
          <ShieldCheck size={16} aria-hidden="true" />
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
