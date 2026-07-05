import { useMemo, useRef, useState } from "react";
import { ArrowRight, ClipboardCheck, FileSignature, KeyRound, PenLine, RadioTower, ShieldCheck } from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { OpenUiNotice, OpenUiPanel, OpenUiProvider, PlayStage } from "@shared/components-react/v2";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

const BROADCAST_BYTE_LIMIT = 1024;
const signatureDeskUrl = new URL("../public/signature-desk.webp", import.meta.url).href;
type DrawerMode = "safety" | "signature" | "broadcast";

function byteLength(value: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(value).length;
  }
  return encodeURIComponent(value).replace(/%[0-9A-F]{2}/g, "x").length;
}

function shortHash(value: string, lead = 18): string {
  return value ? `${value.slice(0, lead)}...` : "";
}

function statusKey({
  isSigning,
  isBroadcasting,
  signature,
  txHash,
}: {
  isSigning: boolean;
  isBroadcasting: boolean;
  signature: string;
  txHash: string;
}): string {
  if (isSigning) return "signRouteStageSigning";
  if (isBroadcasting) return "signRouteStageBroadcasting";
  if (txHash) return "signRouteStageBroadcasted";
  if (signature) return "signRouteStageSigned";
  return "signRouteStageReady";
}

function statusHintKey({
  isSigning,
  isBroadcasting,
  signature,
  txHash,
  hasMessage,
}: {
  isSigning: boolean;
  isBroadcasting: boolean;
  signature: string;
  txHash: string;
  hasMessage: boolean;
}): string {
  if (!hasMessage) return "signRouteStageEmptyHint";
  if (isSigning) return "signRouteStageSigningHint";
  if (isBroadcasting) return "signRouteStageBroadcastingHint";
  if (txHash) return "signRouteStageBroadcastedHint";
  if (signature) return "signRouteStageSignedHint";
  return "signRouteStageReadyHint";
}

export default function PlayArea({ t, state, dispatch }: P) {
  const { str, bool } = useStateBindings(state);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("safety");

  const address = str("address");
  const message = str("message");
  const signature = str("signature");
  const publicKey = str("publicKey");
  const txHash = str("txHash");
  const txPending = bool("txPending");
  const isSigning = bool("isSigning");
  const isBroadcasting = bool("isBroadcasting");
  const busy = isSigning || isBroadcasting;

  const bytes = byteLength(message);
  const hasMessage = message.trim().length > 0;
  const overBroadcastLimit = bytes > BROADCAST_BYTE_LIMIT;
  const progress = Math.min(100, Math.round((bytes / BROADCAST_BYTE_LIMIT) * 100));
  const payloadType = message.trim().toLowerCase().startsWith("sha256:")
    ? t("messageTypeDigest")
    : t("messageTypePlain");
  const currentStatusKey = statusKey({ isSigning, isBroadcasting, signature, txHash });
  const currentHintKey = statusHintKey({
    isSigning,
    isBroadcasting,
    signature,
    txHash,
    hasMessage,
  });

  const verifierBundle = useMemo(
    () => [
      `${t("walletAddress")}: ${address || t("disconnected")}`,
      `${t("messageLabel")}: ${message}`,
      `${t("signatureResult")}: ${signature || t("noSignatureYet")}`,
      `${t("publicKeyLabel")}: ${publicKey || t("noSignatureYet")}`,
    ].join("\n"),
    [address, message, publicKey, signature, t],
  );

  const updateMessage = (next: string) => {
    state.message?.set(next);
  };

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    void dispatch("loadFileDigest", file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const scene = (
    <div
      className={[
        "sign-desk",
        isSigning ? "sign-desk--signing" : null,
        isBroadcasting ? "sign-desk--broadcasting" : null,
        signature ? "sign-desk--signed" : null,
        txHash ? "sign-desk--posted" : null,
      ].filter(Boolean).join(" ")}
      data-state={currentStatusKey}
      data-ready={hasMessage && !overBroadcastLimit ? "true" : undefined}
    >
      <div className="sign-desk__workspace">
        <section className="sign-desk__paper" aria-label={t("messagePreviewLabel")}>
          <div className="sign-desk__paper-head">
            <span>
              <PenLine size={15} />
              {payloadType}
            </span>
            <strong>{bytes} / {BROADCAST_BYTE_LIMIT} {t("bytesUnit")}</strong>
          </div>
          <label className="sign-desk__payload-sheet">
            <span>{t("messageLabel")}</span>
            <textarea
              className="sign-desk__textarea"
              value={message}
              onChange={(event) => updateMessage(event.target.value)}
              placeholder={t("messagePlaceholder")}
              disabled={busy}
              rows={4}
            />
          </label>
          <div className="sign-desk__payload-preview" data-empty={!hasMessage ? "true" : undefined}>
            <span><FileSignature size={15} /> {t("messagePreviewLabel")}</span>
            <code>{hasMessage ? shortHash(message, 46) : t("messagePreviewEmptyTitle")}</code>
          </div>
          <div className="sign-desk__meter" data-over={overBroadcastLimit ? "true" : undefined}>
            <span style={{ width: `${progress}%` }} />
          </div>
          <p className="sign-desk__paper-note">
            {overBroadcastLimit ? t("messageTooLong") : t("signFlowStepOneCopy")}
          </p>
        </section>

        <div className="sign-desk__handoff" aria-hidden="true">
          <span />
          <ArrowRight size={18} />
        </div>

        <section className="sign-desk__proof" aria-live="polite">
          <div className="sign-desk__photo">
            <img src={signatureDeskUrl} alt="" loading="eager" decoding="async" />
          </div>
          <span className="sign-desk__mode">{signature || txHash ? t("walletReviewed") : t("walletPrompt")}</span>
          <div className="sign-desk__seal" data-active={signature || txHash ? "true" : undefined}>
            <span className="sign-desk__seal-icon">
              {signature || txHash ? <ShieldCheck size={22} /> : <FileSignature size={22} />}
            </span>
            <span>{signature || txHash ? t("signRouteStageProof") : t("signRouteStageWallet")}</span>
            <strong>{hasMessage ? t(currentStatusKey) : t("signRouteStageEmpty")}</strong>
          </div>
          <div className="sign-desk__route" aria-label={t("signRouteStageLabel")}>
            <span data-active="true"><PenLine size={13} /><em>{t("signRouteStageMessage")}</em></span>
            <span data-active={hasMessage ? "true" : undefined}><KeyRound size={13} /><em>{t("signRouteStageWallet")}</em></span>
            <span data-active={signature || txHash ? "true" : undefined}><ShieldCheck size={13} /><em>{t("signRouteStageProof")}</em></span>
          </div>
          <div className="sign-desk__status">
            <strong>{hasMessage ? t(currentStatusKey) : t("signRouteStageEmpty")}</strong>
            <span>{t(currentHintKey)}</span>
          </div>
          <div className="sign-desk__outputs">
            <button
              type="button"
              onClick={() => void dispatch("copyToClipboard", signature)}
              disabled={!signature}
            >
              <span>{t("copySignature")}</span>
              <code>{signature ? shortHash(signature, 14) : t("noSignatureYet")}</code>
            </button>
            <button
              type="button"
              onClick={() => void dispatch("copyToClipboard", txHash)}
              disabled={!txHash}
            >
              <span>{t("copyTxHash")}</span>
              <code>{txHash ? shortHash(txHash, 14) : txPending ? t("txPending") : t("noBroadcastYet")}</code>
            </button>
          </div>
        </section>
      </div>
      <input
        ref={fileInputRef}
        className="sign-desk__file-input"
        type="file"
        onChange={(event) => handleFile(event.target.files?.[0])}
      />
    </div>
  );

  const drawerPanel = (() => {
    if (drawerMode === "signature") {
      return (
        <OpenUiPanel
          className="sign-details__panel sign-details__panel--signature"
          icon={<ClipboardCheck size={18} strokeWidth={2.35} aria-hidden="true" />}
          title={t("signatureResult")}
          subtitle={signature ? t("signRouteStageSignedHint") : t("proofEmptyHint")}
        >
          <div className="sign-details__artifact" data-empty={!signature ? "true" : undefined}>
            <span>{t("signatureResult")}</span>
            <code>{signature || t("proofEmptyHint")}</code>
          </div>
          <button
            type="button"
            className="mx2-btn mx2-btn--ghost sign-details__copy"
            onClick={() => void dispatch("copyToClipboard", verifierBundle)}
            disabled={!signature}
          >
            {t("copyVerifyBundle")}
          </button>
        </OpenUiPanel>
      );
    }

    if (drawerMode === "broadcast") {
      return (
        <OpenUiPanel
          className="sign-details__panel sign-details__panel--broadcast"
          icon={<RadioTower size={18} strokeWidth={2.35} aria-hidden="true" />}
          title={t("broadcastResult")}
          subtitle={txHash ? t("signRouteStageBroadcastedHint") : t("networkFeeNote")}
        >
          <div className="sign-details__artifact" data-empty={!txHash && !txPending ? "true" : undefined}>
            <span>{txPending ? t("txPending") : t("broadcastResult")}</span>
            <code>{txHash || (txPending ? t("txPending") : t("proofEmptyHint"))}</code>
          </div>
          <OpenUiNotice
            className="sign-details__notice"
            icon={<RadioTower size={18} strokeWidth={2.35} aria-hidden="true" />}
            title={t("broadcastRouteLabel")}
          >
            {t("networkFeeNote")}
          </OpenUiNotice>
        </OpenUiPanel>
      );
    }

    return (
      <OpenUiPanel
        className="sign-details__panel sign-details__panel--safety"
        icon={<ShieldCheck size={18} strokeWidth={2.35} aria-hidden="true" />}
        title={t("safetyPanelTitle")}
        subtitle={t("safetyPanelCopy")}
      >
        <div className="sign-details__summary">
          <div className="sign-details__status-chip" data-active={address ? "true" : undefined}>
            <KeyRound size={15} strokeWidth={2.35} aria-hidden="true" />
            <span>{address ? t("connected") : t("disconnected")}</span>
          </div>
          <div className="sign-details__status-chip" data-active={hasMessage ? "true" : undefined}>
            <FileSignature size={15} strokeWidth={2.35} aria-hidden="true" />
            <span>{hasMessage ? payloadType : t("signRouteStageEmpty")}</span>
          </div>
        </div>
        <dl className="sign-details__facts">
          <div>
            <dt>{t("walletAddress")}</dt>
            <dd>{address || t("disconnected")}</dd>
          </div>
          <div>
            <dt>{t("privacyLabel")}</dt>
            <dd>{t("privacyValue")}</dd>
          </div>
          <div>
            <dt>{t("broadcastRouteLabel")}</dt>
            <dd>{t("broadcastContractRoute")}</dd>
          </div>
        </dl>
      </OpenUiPanel>
    );
  })();

  const drawer = (
    <div className="sign-details">
      <div className="sign-details__tabs" role="tablist" aria-label={t("proofDetails")}>
        {[
          { mode: "safety" as const, label: t("proofTabSafety"), meta: address ? t("connected") : t("disconnected"), icon: <ShieldCheck size={15} /> },
          { mode: "signature" as const, label: t("proofTabSignature"), meta: signature ? t("signRouteStageSigned") : t("noSignatureYet"), icon: <ClipboardCheck size={15} /> },
          { mode: "broadcast" as const, label: t("proofTabBroadcast"), meta: txHash ? t("signRouteStageBroadcasted") : t("noBroadcastYet"), icon: <RadioTower size={15} /> },
        ].map((item) => (
          <button
            key={item.mode}
            type="button"
            role="tab"
            aria-selected={drawerMode === item.mode}
            className={drawerMode === item.mode ? "is-active" : undefined}
            onClick={() => setDrawerMode(item.mode)}
          >
            {item.icon}
            <span>{item.label}</span>
            <em>{item.meta}</em>
          </button>
        ))}
      </div>
      <div className="sign-details__active" data-mode={drawerMode}>
        {drawerPanel}
      </div>
    </div>
  );

  return (
    <OpenUiProvider>
      <div className="tool-play-area mx2 mx2-cat-tool">
        <PlayStage
          category="tool"
          stage={{
            eyebrow: t("signHeroKicker"),
            title: t("signHeroTitle"),
            subtitle: t("signStageTitle"),
            badges: address ? (
              <span className="mx2-badge" data-tone="accent">
                <span className="mx2-badge__dot" />
                {t("connected")}
              </span>
            ) : (
              <span className="mx2-badge">
                {t("disconnected")}
              </span>
            ),
          }}
          scene={scene}
          actions={{
            primary: {
              label: isSigning ? t("signingNow") : t("signBtn"),
              onClick: () => void dispatch("signMessage", message),
              loading: isSigning,
              disabled: !hasMessage || busy,
              hint: t("walletPromptCopy"),
            },
            secondary: [
              {
                label: isBroadcasting ? t("broadcastingNow") : t("broadcastShort"),
                onClick: () => void dispatch("broadcastMessage", message),
                loading: isBroadcasting,
                disabled: !hasMessage || busy || overBroadcastLimit,
                hint: overBroadcastLimit ? t("messageTooLong") : t("broadcastPanelCopy"),
              },
              {
                label: t("signFileShort"),
                onClick: () => fileInputRef.current?.click(),
                disabled: busy,
                hint: t("hashedFileNotice"),
              },
            ],
          }}
          drawerToggleLabel={t("proofDetails")}
          drawer={{ title: t("resultPanelTitle"), children: drawer }}
        />
      </div>
    </OpenUiProvider>
  );
}
