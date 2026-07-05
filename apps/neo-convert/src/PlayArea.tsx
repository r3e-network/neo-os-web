/**
 * neo-convert -- foreground-first format conversion workbench.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, Braces, KeyRound, RefreshCw, ShieldCheck } from "lucide-react";
import { OpenUiProvider, OpenUiTextField, PlayStage } from "@shared/components-react/v2";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import type { ConversionResult } from "./composables/useConverter";
import type { NeoAccount } from "./services/neo";
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
  const activeTab = str("activeTab", "convert");
  const isLoading = bool("isLoading");
  const inputKey = str("inputKey");
  const conversionResult = val<ConversionResult>("conversionResult", EMPTY_RESULT) ?? EMPTY_RESULT;
  const generatedAccount = val<NeoAccount | null>("generatedAccount", null);
  const accountsGenerated = str("accountsGenerated", "0");
  const conversionStatus = str("conversionStatus");
  const conversionStatusType = str("conversionStatusType");

  const [input, setInput] = useState(inputKey);
  const [convertPreview, setConvertPreview] = useState(false);
  const convertTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setInput(inputKey);
  }, [inputKey]);

  useEffect(() => () => {
    if (convertTimeout.current) clearTimeout(convertTimeout.current);
  }, []);

  const hasResult = hasConversionResult(conversionResult);
  const primaryValue = resultValue(conversionResult);
  const busy = isLoading || convertPreview;
  const modeLabel = activeTab === "generate" ? t("tabGenerate") : t("tabConvert");
  const statusLabel = busy
    ? t("convertStatusConverting")
    : hasResult
      ? t("convertStatusReady")
      : conversionStatusType === "error"
        ? t("convertStatusAttention")
        : t("convertStatusIdle");
  const detectedKind = resultKind(conversionResult);
  const detectedLabel = detectedKind === "privateKey"
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
    setInput(next);
    state.inputKey?.set(next);
  };

  const startConvertPreview = () => {
    if (convertTimeout.current) clearTimeout(convertTimeout.current);
    setConvertPreview(true);
    convertTimeout.current = setTimeout(() => {
      setConvertPreview(false);
      convertTimeout.current = null;
    }, 900);
  };

  const handleConvert = () => {
    if (!input.trim() || busy) return;
    startConvertPreview();
    void dispatch("convert", input);
  };

  const scene = (
    <div className="convert-workbench" data-state={busy ? "converting" : hasResult ? "result" : "idle"}>
      <section className="convert-card convert-card--source" aria-label={t("sourceMaterialLabel")}>
        <div className="convert-card__head">
          <span className="convert-card__icon"><KeyRound size={18} /></span>
          <span>{t("sourceMaterialLabel")}</span>
          <em>{t("autoDetectShort")}</em>
        </div>
        <div className="convert-source-grid">
          <div className="convert-source-grid__controls">
            <div className="convert-material convert-material--summary" data-ready={input.trim() ? "true" : "false"}>
              <span className="convert-material__icon" aria-hidden="true"><KeyRound size={16} /></span>
              <div>
                <span>{t("sourceCredentialLabel")}</span>
                <strong>{input.trim() ? compact(input, "") : t("sourceCredentialPlaceholder")}</strong>
                <small>{input.trim() ? t("localOnlyShort") : t("conversionDrawerEmpty")}</small>
              </div>
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
          <strong>{hasResult ? compact(primaryValue) : t("emptyOutputTitle")}</strong>
        </div>
        <small>
          {busy
            ? t("checkingFormat")
            : conversionStatus
              ? t(conversionStatus) || conversionStatus
              : generatedAccount
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
      <section className="convert-field convert-field--drawer" aria-label={t("sourceCredentialLabel")}>
        <span className="convert-field__label">{t("sourceCredentialLabel")}</span>
        <div className="convert-material convert-material--entry">
          <span className="convert-material__icon" aria-hidden="true"><KeyRound size={16} /></span>
          <OpenUiTextField
            className="convert-entry-field"
            inputClassName="convert-entry-input"
            label={t("sourceCredentialLabel")}
            mono
            value={input}
            onChange={(event) => updateInput(event.target.value)}
            placeholder={t("sourceCredentialPlaceholder")}
            disabled={busy}
            spellCheck={false}
          />
        </div>
      </section>
      {detailRows.length > 0 ? (
        <dl className="convert-result-list">
          {detailRows.map(([labelKey, value]) => (
            <div key={labelKey}>
              <dt>{t(labelKey)}</dt>
              <dd><code>{value}</code></dd>
            </div>
          ))}
        </dl>
      ) : (
        <p>{t("conversionDrawerEmpty")}</p>
      )}
      {generatedAccount && (
        <div className="convert-account-card">
          <span>{t("generatedAccount")}</span>
          <strong>{compact(generatedAccount.address)}</strong>
          <small>{t("generatedAccountPrivacy")}</small>
        </div>
      )}
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
            { label: t("conversionResultLabel"), value: hasResult ? t("readyShort") : "-" },
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
                onClick: () => void dispatch("generate"),
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
