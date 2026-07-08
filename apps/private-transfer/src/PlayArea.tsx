/**
 * PlayArea.tsx — Confidential Transfer (v2 scene-driven rebuild)
 *
 * DeFi identity. The sealed envelope IS the scene: a privacy lock/seal that
 * shows the sealing status, with the commitment + nullifier readout once sealed.
 * This app seals an encrypted intent (no funds move, no on-chain write) — so the
 * primary action dispatches a preview/seal intent. Recipient + amount are the
 * foreground packet slots; optional memo and technical details stay tucked in
 * the drawer so this reads like an app, not a long form.
 */
import { useState } from "react";
import { FileLock2, LockKeyhole, Send, ShieldCheck, UnlockKeyhole } from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { CoinArt } from "@shared/art";
import { OpenUiNotice, OpenUiPanel, OpenUiProvider, OpenUiSegmented, OpenUiTextField, PlayStage } from "@shared/components-react/v2";
import { isPositiveAssetAmount, isValidNeoAddress, type PrivateTransferAsset } from "./seal";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

const STAGE_IMAGE = new URL("../public/private-transfer-stage.webp", import.meta.url).href;
const ASSET_OPTIONS: Array<{ symbol: PrivateTransferAsset; metaKey: string; presets: string[] }> = [
  { symbol: "GAS", metaKey: "assetGasMeta", presets: ["0.1", "1", "5"] },
  { symbol: "NEO", metaKey: "assetNeoMeta", presets: ["1", "5", "10"] },
];

function shortHash(value: string): string {
  const v = String(value || "").trim();
  if (!v || v === "—") return "—";
  if (v.length <= 18) return v;
  return `${v.slice(0, 10)}…${v.slice(-6)}`;
}

function coinVariant(asset: PrivateTransferAsset): "gas" | "neo" {
  return asset === "NEO" ? "neo" : "gas";
}

function normalizeAmountInput(value: string, asset: PrivateTransferAsset): string {
  const text = String(value ?? "");
  if (asset === "NEO") {
    return (text.split(/[.,]/)[0] ?? "").replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
  }
  return text.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1");
}

export default function PlayArea({ t, state, dispatch }: P) {
  const { str, num, bool } = useStateBindings(state);

  const privacyMode = str("privacyMode");
  const networkLabel = str("networkLabel");
  const lastStatus = str("lastStatus");
  const lastDigest = str("lastDigest");
  const lastSecretRef = str("lastSecretRef");
  const lastNullifier = str("lastNullifier");
  const isSealing = bool("isSealing");
  const requestCount = num("requestCount");

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState<PrivateTransferAsset>("GAS");
  const [memo, setMemo] = useState("");

  const recipientReady = isValidNeoAddress(recipient);
  const amountReady = isPositiveAssetAmount(amount, asset);
  const canSeal = recipientReady && amountReady && !isSealing;
  const hasSealed = requestCount > 0;
  const stageState = isSealing ? "sealing" : hasSealed ? "sealed" : canSeal ? "ready" : "draft";
  // ASSET_OPTIONS is a non-empty literal; the [0] fallback always exists.
  const activeAsset = ASSET_OPTIONS.find((option) => option.symbol === asset) ?? ASSET_OPTIONS[0]!;
  const packetTitle = hasSealed ? t("packetSealed") : canSeal ? t("packetReady") : t(asset === "NEO" ? "packetDraftNeo" : "packetDraftGas");
  const amountHint = asset === "NEO" ? t("amountHintNeo") : t("amountHintGas");

  const selectAsset = (next: PrivateTransferAsset) => {
    setAsset(next);
    setAmount((current) => normalizeAmountInput(current, next));
  };
  const selectAssetSafe = (value: string) => {
    if (value === "GAS" || value === "NEO") {
      selectAsset(value);
    }
  };

  const handleSeal = async () => {
    if (!canSeal) return;
    await dispatch("prepareTransfer", { recipient, amount, asset, memo });
  };

  const scene = (
    <div className="pt-scene" data-state={stageState}>
      <aside className="pt-vault-card" aria-label={t("heroStageAria")}>
        <figure className="pt-vault-card__art">
          <img src={STAGE_IMAGE} alt={t("heroStageAria")} loading="eager" decoding="async" />
        </figure>
        <div className={["pt-seal-device", hasSealed ? "is-sealed" : ""].filter(Boolean).join(" ")}>
          <div className="pt-seal-device__coin" aria-hidden="true">
            <CoinArt size={32} variant={coinVariant(asset)} decorative />
          </div>
          <div className="pt-seal-device__lock" aria-hidden="true">
            {hasSealed ? <LockKeyhole size={26} /> : <UnlockKeyhole size={26} />}
          </div>
          <div className="pt-seal-device__body">
            <span className="pt-seal-device__label">{t("statDigest")}</span>
            <strong className="pt-seal-device__digest">{hasSealed ? shortHash(lastDigest) : t("digestPlaceholder")}</strong>
            <small>{lastSecretRef ? shortHash(lastSecretRef) : t("sealPreviewPending")}</small>
          </div>
        </div>
      </aside>

      <section className="pt-packet-console" aria-label={t("composerTitle")}>
        <header className="pt-packet-console__head">
          <span><FileLock2 size={16} /> {t("composerTitle")}</span>
          <strong>{packetTitle}</strong>
          <small>{t("introBody")}</small>
        </header>

        <div className="pt-transfer-packet" data-ready={canSeal ? "true" : undefined}>
          <div className="pt-transfer-packet__seal" aria-hidden="true">
            <img src={STAGE_IMAGE} alt="" />
            <span>{hasSealed ? <LockKeyhole size={23} /> : <UnlockKeyhole size={23} />}</span>
          </div>
          <div className="pt-transfer-packet__body">
            <span>{t(asset === "NEO" ? "packetRailNeo" : "packetRailGas")}</span>
            <strong>{amountReady ? `${amount} ${asset}` : t(asset === "NEO" ? "routeAmountPendingNeo" : "routeAmountPendingGas")}</strong>
            <small>{recipientReady ? shortHash(recipient) : t("routeRecipientPending")}</small>
          </div>
          <div className="pt-scene__route" aria-label={t("routeAria")}>
            <span className={recipientReady ? "is-on" : ""}>{t("routeStepCompose")}</span>
            <span className="pt-scene__route-arrow">→</span>
            <span className={amountReady ? "is-on" : ""}>{t("routeStepEncrypt")}</span>
            <span className="pt-scene__route-arrow">→</span>
            <span className={hasSealed ? "is-on" : ""}>{t("routeStepMorpheus")}</span>
          </div>
        </div>

        <div className="pt-compose-strip" aria-label={t("composerLead")}>
          <div className="pt-amount-desk" data-ready={amountReady ? "true" : "false"} data-asset={asset.toLowerCase()}>
            <OpenUiSegmented
              className="pt-asset-switch"
              segmentedClassName="pt-asset-switch__group"
              label={t("formAssetLabel")}
              value={asset}
              onChange={selectAssetSafe}
              options={ASSET_OPTIONS.map((option) => ({
                value: option.symbol,
                label: (
                  <span className="pt-asset-option" data-asset={option.symbol.toLowerCase()}>
                    <CoinArt size={22} variant={coinVariant(option.symbol)} decorative />
                    <span>
                      <strong>{option.symbol}</strong>
                      <small>{t(option.metaKey)}</small>
                    </span>
                  </span>
                ),
              }))}
            />
            <div
              className="pt-compose-slot pt-compose-slot--amount"
              data-ready={amountReady ? "true" : "false"}
              data-empty={!amount ? "true" : undefined}
            >
              <span><CoinArt size={16} variant={coinVariant(asset)} decorative /> {t("formAmountLabel")}</span>
              <div className="pt-amount-control">
                <OpenUiTextField
                  className="pt-amount-field"
                  inputClassName="pt-compose-input pt-compose-input--amount"
                  label={t("formAmountLabel")}
                  value={amount}
                  onChange={(e) => setAmount(normalizeAmountInput(e.target.value, asset))}
                  placeholder={asset === "NEO" ? "1" : "0.00"}
                  inputMode={asset === "NEO" ? "numeric" : "decimal"}
                />
                <strong>{asset}</strong>
              </div>
              <small className="pt-amount-hint">{amountHint}</small>
            </div>
            <OpenUiSegmented
              className="pt-amount-presets"
              segmentedClassName="pt-amount-presets__group"
              label={t("presetsLabel")}
              value={activeAsset.presets.includes(amount) ? amount : ""}
              onChange={setAmount}
              options={activeAsset.presets.map((preset) => ({
                value: preset,
                label: <span className="pt-preset-option">{preset} {asset}</span>,
              }))}
            />
            {amount && !amountReady && <small className="pt-amount-error">{t(asset === "NEO" ? "errorInvalidNeoAmount" : "errorInvalidAmount")}</small>}
          </div>

          <div
            className="pt-compose-slot pt-compose-slot--recipient"
            data-ready={recipientReady ? "true" : "false"}
            data-empty={!recipient ? "true" : undefined}
          >
            <span><Send size={15} /> {t("formRecipientLabel")}</span>
            <OpenUiTextField
              className="pt-recipient-field"
              inputClassName="pt-compose-input pt-compose-input--recipient"
              label={t("formRecipientLabel")}
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder={t("formRecipientPlaceholder")}
              autoComplete="off"
              spellCheck={false}
            />
            {recipient && !recipientReady && <small>{t("errorInvalidAddress")}</small>}
          </div>
        </div>
      </section>

      <div className="pt-scene__intent" aria-label={t("summaryTitle")}>
        <span data-ready={recipientReady ? "true" : "false"}><Send size={14} /> {recipientReady ? shortHash(recipient) : t("summaryRecipient")}</span>
        <span data-ready={amountReady ? "true" : "false"}><CoinArt size={16} variant={coinVariant(asset)} decorative /> {amountReady ? `${amount} ${asset}` : t("summaryAmount")}</span>
        <span data-ready={hasSealed ? "true" : "false"}><ShieldCheck size={14} /> {hasSealed ? shortHash(lastNullifier || lastDigest) : t("introPointNoFunds")}</span>
      </div>
      <p className="pt-scene__status">
        {isSealing ? t("statusSealingProgress") : hasSealed ? `${lastStatus || t("statusSealed")} · ${privacyMode}` : canSeal ? t("summaryTitle") : t("statusInitial")}
      </p>
    </div>
  );

  const score = [
    { label: t("statRequests"), value: String(requestCount), accent: true },
    { label: t("statPrivacy"), value: privacyMode },
    { label: t("statNetwork"), value: networkLabel },
  ];

  const drawer = (
    <OpenUiProvider>
      <div className="pt-drawer">
        <OpenUiNotice
          className="pt-drawer__notice"
          icon={<ShieldCheck size={17} strokeWidth={2.35} aria-hidden="true" />}
          title={t("introPointNoFunds")}
        >
          {t("noFundsBanner")}
        </OpenUiNotice>

        <OpenUiPanel
          className="pt-drawer__panel pt-drawer__panel--memo"
          icon={<FileLock2 size={18} strokeWidth={2.35} aria-hidden="true" />}
          title={t("formMemoLabel")}
          subtitle={t("formMemoOptional")}
        >
          <OpenUiTextField
            className="pt-drawer__memo"
            label={t("formMemoLabel")}
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
            placeholder={t("formMemoLabel")}
            hint={t("introPointLocalDesc")}
          />
        </OpenUiPanel>

        <OpenUiPanel
          className="pt-drawer__panel pt-drawer__panel--receipt"
          icon={<Send size={18} strokeWidth={2.35} aria-hidden="true" />}
          title={t("summaryTitle")}
          subtitle={canSeal ? t("packetReady") : t("summaryPendingAsset", { asset })}
        >
          <dl className="pt-drawer__facts">
            <div><dt>{t("summaryRecipient")}</dt><dd>{recipientReady ? shortHash(recipient) : t("routeRecipientPending")}</dd></div>
            <div><dt>{t("summaryAmount")}</dt><dd>{amountReady ? `${amount} ${asset}` : t(asset === "NEO" ? "routeAmountPendingNeo" : "routeAmountPendingGas")}</dd></div>
            <div><dt>{t("summaryNetwork")}</dt><dd>{networkLabel || t("digestPlaceholder")}</dd></div>
          </dl>
        </OpenUiPanel>

        <OpenUiPanel
          className="pt-drawer__panel pt-drawer__panel--crypto"
          icon={<LockKeyhole size={18} strokeWidth={2.35} aria-hidden="true" />}
          title={t("summaryEncryption")}
          subtitle="X25519 · AES-256-GCM"
        >
          <dl className="pt-drawer__facts">
            <div><dt>{t("introPointLocal")}</dt><dd>{t("introPointLocalDesc")}</dd></div>
            <div><dt>{t("introPointTee")}</dt><dd>{t("introPointTeeDesc")}</dd></div>
            <div><dt>{t("statDigest")}</dt><dd>{hasSealed ? shortHash(lastDigest) : t("sealPreviewPending")}</dd></div>
          </dl>
        </OpenUiPanel>
      </div>
    </OpenUiProvider>
  );

  return (
    <div className="private-transfer-play-area mx2 mx2-cat-defi">
      <PlayStage
        category="defi"
        stage={{ eyebrow: t("heroEyebrow"), title: t("heroTitle"), subtitle: t("heroBadge") }}
        scene={scene}
        score={score}
        actions={{
          primary: {
            label: isSealing ? t("sealing") : t("sealCtaShort"),
            onClick: () => void handleSeal(),
            disabled: !canSeal,
            loading: isSealing,
          },
        }}
        drawerToggleLabel={t("composerTitle")}
        drawer={{ title: t("composerTitle"), children: drawer }}
      />
    </div>
  );
}
