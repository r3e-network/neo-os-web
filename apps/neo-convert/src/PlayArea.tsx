/**
 * neo-convert -- foreground-first format conversion workbench.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  Braces,
  Check,
  CircleAlert,
  Copy,
  Download,
  Eraser,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { OpenUiProvider, OpenUiTextField, PlayStage } from "@shared/components-react/v2";
import { CoinArt } from "@shared/art";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import type { ConversionResult } from "./composables/useConverter";
import { MAX_SOURCE_CHARS, type NeoAccount } from "./services/neo";
import "./PlayArea.scss";

const keyWorkbenchArt = new URL("../public/key-workbench-stage.webp", import.meta.url).href;

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

const EMPTY_RESULT: ConversionResult = {
  address: "",
  publicKey: "",
  wif: "",
  privateKey: "",
  opcodes: [],
  scriptHash: "",
  scriptHashLE: "",
};

const FORMAT_GUIDES = [
  { key: "address", labelKey: "address", hintKey: "formatAddressHint" },
  { key: "wif", labelKey: "wifLabel", hintKey: "formatWifShortHint" },
  { key: "publicKey", labelKey: "pubKey", hintKey: "formatPublicKeyShortHint" },
  { key: "scriptHash", labelKey: "scriptHashShortLabel", hintKey: "formatScriptHashHint" },
  { key: "opcodes", labelKey: "formatOpcodesLabel", hintKey: "formatOpcodesHint" },
] as const;

type ResultKind = (typeof FORMAT_GUIDES)[number]["key"] | "privateKey" | "output";

function compact(value: string | undefined, empty = "-"): string {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return empty;
  if (trimmed.length <= 24) return trimmed;
  return `${trimmed.slice(0, 12)}...${trimmed.slice(-8)}`;
}

function hasConversionResult(result: ConversionResult): boolean {
  return Boolean(
    result.address
      || result.publicKey
      || result.wif
      || result.privateKey
      || result.scriptHash
      || result.scriptHashLE
      || result.opcodes.length > 0,
  );
}

function resultKind(result: ConversionResult): ResultKind {
  if (result.address) return "address";
  if (result.scriptHash) return "scriptHash";
  if (result.publicKey) return "publicKey";
  if (result.wif) return "wif";
  if (result.privateKey) return "privateKey";
  if (result.opcodes.length > 0) return "opcodes";
  return "output";
}

function resultValue(result: ConversionResult): string {
  return result.address
    || result.scriptHash
    || result.publicKey
    || result.wif
    || result.privateKey
    || (result.opcodes.length > 0 ? `${result.opcodes.length} opcodes` : "");
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);
  const dispatchSafely = useCallback((name: string, ...args: unknown[]) => {
    void dispatch(name, ...args).catch(() => undefined);
  }, [dispatch]);
  const activeTab = str("activeTab", "convert");
  const inputKey = str("inputKey");
  const conversionResult = val<ConversionResult>("conversionResult", EMPTY_RESULT) ?? EMPTY_RESULT;
  const generatedAccount = val<NeoAccount | null>("generatedAccount", null);
  const accountsGenerated = str("accountsGenerated", "0");
  const conversionStatus = str("conversionStatus");
  const conversionStatusType = str("conversionStatusType");
  const showGeneratedSecrets = bool("showGeneratedSecrets");
  const showConversionSecrets = bool("showConversionSecrets");
  const copyStatus = str("copyStatus");
  const copyStatusType = str("copyStatusType");
  const walletConnected = bool("walletConnected");
  const balancesLoading = bool("balancesLoading");
  const balanceStatus = str("balanceStatus", "idle");
  const formattedNeoBalance = str("formattedNeoBalance", "—");
  const formattedGasBalance = str("formattedGasBalance", "—");

  const [input, setInput] = useState(inputKey);
  const [showSourceMaterial, setShowSourceMaterial] = useState(false);
  const [convertPreview, setConvertPreview] = useState(false);
  const convertTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setInput(inputKey);
    if (!inputKey) setShowSourceMaterial(false);
  }, [inputKey]);

  useEffect(() => () => {
    if (convertTimeout.current) clearTimeout(convertTimeout.current);
  }, []);

  const hasResult = hasConversionResult(conversionResult);
  const hasVisibleResult = hasResult || (!input.trim() && Boolean(generatedAccount));
  const primaryValue = hasResult
    ? resultValue(conversionResult)
    : !input.trim()
      ? generatedAccount?.address ?? ""
      : "";
  const busy = convertPreview;
  const modeLabel = activeTab === "generate" || activeTab === t("tabGenerate")
    ? t("tabGenerate")
    : t("tabConvert");
  const statusLabel = busy
    ? t("convertStatusConverting")
    : hasResult
      ? t("convertStatusReady")
      : conversionStatusType === "error"
        ? t("convertStatusAttention")
        : t("convertStatusIdle");
  const detectedKind = resultKind(conversionResult);
  const detectedLabel = hasResult && conversionStatus
    ? t(conversionStatus) || conversionStatus
    : generatedAccount && !input.trim()
      ? t("generatedAccount")
      : detectedKind === "privateKey"
        ? t("privKeyLabel")
        : detectedKind === "output"
          ? t("conversionOutputLabel")
          : t(FORMAT_GUIDES.find((format) => format.key === detectedKind)?.labelKey ?? "conversionOutputLabel");

  const detailRows = useMemo(
    () => [
      ["address", conversionResult.address],
      ["scriptHashLabel", conversionResult.scriptHash],
      ["scriptHashLeLabel", conversionResult.scriptHashLE],
      ["pubKey", conversionResult.publicKey],
      ["formatOpcodesLabel", conversionResult.opcodes.join(" / ")],
    ].filter(([, value]) => Boolean(value)) as Array<[string, string]>,
    [conversionResult],
  );

  const updateInput = (next: string) => {
    // Retain one character beyond the processing limit so the converter can
    // show an explicit recoverable error without holding an unbounded paste in
    // React and observable state.
    const bounded = next.slice(0, MAX_SOURCE_CHARS + 1);
    setInput(bounded);
    state.inputKey?.set(bounded);
  };

  const startConvertPreview = () => {
    if (convertTimeout.current) clearTimeout(convertTimeout.current);
    setConvertPreview(true);
    convertTimeout.current = setTimeout(() => {
      setConvertPreview(false);
      convertTimeout.current = null;
    }, 480);
  };

  const handleConvert = () => {
    if (!input.trim() || busy) return;
    setShowSourceMaterial(false);
    startConvertPreview();
    dispatchSafely("convert", input);
  };

  const scene = (
    <div className="convert-workbench" data-state={busy ? "converting" : hasVisibleResult ? "result" : "idle"}>
      <section className="convert-card convert-card--source" aria-label={t("sourceMaterialLabel")}>
        <div className="convert-card__head">
          <span className="convert-card__icon"><KeyRound size={18} /></span>
          <span>{t("sourceMaterialLabel")}</span>
          <em>{t("autoDetectShort")}</em>
        </div>
        <div className="convert-source-grid">
          <div className="convert-source-grid__controls">
            <div className="convert-material convert-material--entry convert-material--scene" data-ready={input.trim() ? "true" : "false"}>
              <span className="convert-material__icon" aria-hidden="true"><KeyRound size={16} /></span>
              <OpenUiTextField
                className="convert-entry-field"
                inputClassName="convert-entry-input"
                label={t("sourceCredentialLabel")}
                mono
                type={showSourceMaterial ? "text" : "password"}
                value={input}
                onChange={(event) => updateInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  handleConvert();
                }}
                placeholder={t("sourceCredentialPlaceholder")}
                disabled={busy}
                spellCheck={false}
                autoComplete="off"
                autoCapitalize="none"
                autoCorrect="off"
                data-1p-ignore
                data-lpignore="true"
              />
              <button
                type="button"
                className="convert-source-visibility"
                onClick={() => setShowSourceMaterial((visible) => !visible)}
                aria-label={showSourceMaterial ? t("hideSource") : t("showSource")}
                disabled={!input}
              >
                {showSourceMaterial ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="convert-format-rail" aria-label={t("formatRailTitle")}>
              <span className="convert-format-rail__label">{t("formatRailTitle")}</span>
              <div className="convert-format-rail__items">
                {FORMAT_GUIDES.map((format) => (
                  <span key={format.key} data-active={hasResult && detectedKind === format.key ? "true" : "false"}>
                    <strong>{t(format.labelKey)}</strong>
                    <small>{t(format.hintKey)}</small>
                  </span>
                ))}
              </div>
            </div>
          </div>
          <figure className="convert-resource-card">
            <img src={keyWorkbenchArt} alt="" aria-hidden="true" />
            <figcaption>
              <strong>{t("offlineBenchTitle")}</strong>
              <span>{t("localOnlyShort")}</span>
            </figcaption>
          </figure>
        </div>
      </section>

      <div className="convert-rail" aria-hidden="true">
        <span className="convert-rail__line" />
        <span className="convert-rail__pulse" />
        <ArrowRight size={22} />
      </div>

      <section className="convert-card convert-card--output" aria-label={t("conversionOutputLabel")}>
        <div className="convert-card__head">
          <span className="convert-card__icon"><Braces size={18} /></span>
          <span>{detectedLabel}</span>
        </div>
        <div className="convert-output-preview">
          <span className="convert-output-preview__icon" aria-hidden="true"><Braces size={18} /></span>
          <strong>{hasVisibleResult ? compact(primaryValue) : t("emptyOutputTitle")}</strong>
        </div>
        <small>
          {busy
            ? t("checkingFormat")
            : conversionStatus
              ? t(conversionStatus) || conversionStatus
              : generatedAccount && !input.trim()
                ? t("generatedAccountStatus", { address: compact(generatedAccount.address) })
                : t("localConversionNote")}
        </small>
      </section>

      <div className="convert-workbench__status" data-tone={conversionStatusType === "error" ? "warning" : "ok"}>
        <ShieldCheck size={15} />
        <span>{statusLabel}</span>
      </div>
    </div>
  );

  const drawer = (
    <div className="convert-drawer">
      {detailRows.length > 0 ? (
        <dl className="convert-result-list">
          {detailRows.map(([labelKey, value]) => (
            <div key={labelKey}>
              <dt>{t(labelKey)}</dt>
              <dd><code>{value}</code></dd>
              <button
                type="button"
                onClick={() => dispatchSafely("copy", value)}
                aria-label={t("iconCopy")}
              >
                <Copy size={14} />
              </button>
            </div>
          ))}
        </dl>
      ) : !generatedAccount ? (
        <p>{t("conversionDrawerEmpty")}</p>
      ) : null}
      {hasResult && (conversionResult.wif || conversionResult.privateKey) && (
        <section className="convert-secret-card" aria-label={t("safetyReveal")}>
          <header>
            <span><ShieldCheck size={16} /> {t("safetyReveal")}</span>
            <button
              type="button"
              onClick={() => dispatchSafely("toggleConversionSecrets")}
            >
              {showConversionSecrets ? <EyeOff size={15} /> : <Eye size={15} />}
              {showConversionSecrets ? t("hideSecrets") : t("showSecrets")}
            </button>
          </header>
          {conversionResult.wif && (
            <div>
              <span>{t("wifWarning")}</span>
              <code>{showConversionSecrets ? conversionResult.wif : t("secretHidden")}</code>
              <button
                type="button"
                onClick={() => dispatchSafely("copy", conversionResult.wif)}
                disabled={!showConversionSecrets}
                aria-label={t("copyWif")}
              >
                <Copy size={14} />
              </button>
            </div>
          )}
          {conversionResult.privateKey && (
            <div>
              <span>{t("privKeyWarning")}</span>
              <code>{showConversionSecrets ? conversionResult.privateKey : t("secretHidden")}</code>
              <button
                type="button"
                onClick={() => dispatchSafely("copy", conversionResult.privateKey)}
                disabled={!showConversionSecrets}
                aria-label={t("copyPrivateKey")}
              >
                <Copy size={14} />
              </button>
            </div>
          )}
        </section>
      )}
      {generatedAccount && (
        <section className="convert-account-card" aria-label={t("generatedAccount")}>
          <header>
            <span>{t("generatedAccount")}</span>
            <button
              type="button"
              onClick={() => dispatchSafely("toggleGeneratedSecrets")}
            >
              {showGeneratedSecrets ? <EyeOff size={15} /> : <Eye size={15} />}
              {showGeneratedSecrets ? t("hideSecrets") : t("showSecrets")}
            </button>
          </header>
          <div>
            <span>{t("address")}</span>
            <code>{generatedAccount.address}</code>
            <button type="button" onClick={() => dispatchSafely("copy", generatedAccount.address)} aria-label={t("copyAddress")}><Copy size={14} /></button>
          </div>
          <div>
            <span>{t("pubKey")}</span>
            <code>{generatedAccount.publicKey}</code>
            <button type="button" onClick={() => dispatchSafely("copy", generatedAccount.publicKey)} aria-label={t("copyPublicKey")}><Copy size={14} /></button>
          </div>
          <div data-secret="true">
            <span>{t("wifWarning")}</span>
            <code>{showGeneratedSecrets ? generatedAccount.wif : t("secretHidden")}</code>
            <button type="button" onClick={() => dispatchSafely("copy", generatedAccount.wif)} disabled={!showGeneratedSecrets} aria-label={t("copyWif")}><Copy size={14} /></button>
          </div>
          <div data-secret="true">
            <span>{t("privKeyWarning")}</span>
            <code>{showGeneratedSecrets ? generatedAccount.privateKey : t("secretHidden")}</code>
            <button type="button" onClick={() => dispatchSafely("copy", generatedAccount.privateKey)} disabled={!showGeneratedSecrets} aria-label={t("copyPrivateKey")}><Copy size={14} /></button>
          </div>
          <small>{showGeneratedSecrets ? t("generatedAccountRevealWarning") : t("generatedAccountPrivacy")}</small>
          <button
            type="button"
            className="convert-account-card__export"
            onClick={() => dispatchSafely("downloadPaperWallet")}
            disabled={!showGeneratedSecrets}
          >
            <Download size={15} />
            {t("downloadPdf")}
          </button>
        </section>
      )}
      <section className="convert-wallet-snapshot" aria-label={t("walletSnapshotTitle")}>
        <header>
          <span>{t("walletSnapshotTitle")}</span>
          <small data-tone={balanceStatus === "error" ? "error" : "neutral"}>
            {balanceStatus === "error" ? t("balanceReadFailed") : t("balanceReadOnly")}
          </small>
        </header>
        {walletConnected ? (
          <div>
            <article>
              <CoinArt size={28} variant="neo" decorative />
              <span>NEO</span>
              <strong>{balancesLoading ? t("loadingShort") : formattedNeoBalance}</strong>
            </article>
            <article>
              <CoinArt size={28} variant="gas" decorative />
              <span>GAS</span>
              <strong>{balancesLoading ? t("loadingShort") : formattedGasBalance}</strong>
            </article>
          </div>
        ) : (
          <p>{t("connectForBalances")}</p>
        )}
      </section>
      {copyStatus && (
        <p className="convert-copy-status" data-tone={copyStatusType === "error" ? "error" : "success"} role="status">
          {copyStatusType === "error" ? <CircleAlert size={14} /> : <Check size={14} />} {copyStatus}
        </p>
      )}
      <button type="button" className="convert-reset" onClick={() => dispatchSafely("reset")}>
        <Eraser size={15} />
        {t("clearWorkbench")}
      </button>
    </div>
  );

  return (
    <OpenUiProvider>
      <div className="neo-convert-play-area mx2 mx2-cat-tool">
        <PlayStage
          category="tool"
          stage={{
            eyebrow: t("appTitle"),
            title: t("convTitle"),
            subtitle: t("docSubtitle"),
            badges: <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> {modeLabel}</span>,
          }}
          scene={scene}
          score={[
            { label: t("sidebarMode"), value: modeLabel, accent: true },
            { label: t("accountsGenerated"), value: accountsGenerated },
            { label: t("conversionResultLabel"), value: hasVisibleResult ? t("readyShort") : t("conversionResultNone") },
          ]}
          actions={{
            primary: {
              label: busy ? t("convertStatusConverting") : t("convert"),
              icon: <RefreshCw size={16} />,
              onClick: handleConvert,
              loading: busy,
              disabled: busy || !input.trim(),
            },
            secondary: [
              {
                label: t("generateNewAccount"),
                icon: <KeyRound size={15} />,
                onClick: () => dispatchSafely("generate"),
                disabled: busy,
              },
            ],
          }}
          drawerToggleLabel={t("inspectDetails")}
          drawer={{ title: t("conversionDetails"), children: drawer }}
        />
      </div>
    </OpenUiProvider>
  );
}
