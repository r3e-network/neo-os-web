/**
 * PlayArea.tsx - Timestamp Proof.
 *
 * Tool identity: a clean proof desk where the user's material becomes a local
 * certificate first, then an optional public anchor. The stage shows the
 * workflow and preview, not an empty stamp backdrop or a flat form.
 */
import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Copy,
  ExternalLink,
  FileText,
  Fingerprint,
  HardDrive,
  Link2,
  PenLine,
  RefreshCw,
  Search,
  ShieldCheck,
  Stamp,
} from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { OpenUiNotice, OpenUiPanel, OpenUiProvider, OpenUiTextArea, OpenUiTextField, PlayStage } from "@shared/components-react/v2";
import { explorerTxUrl } from "./utils/explorer";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (n: string, ...a: unknown[]) => Promise<unknown>;
}

interface Proof {
  id: number;
  content?: string;
  contentHash?: string;
  timestamp?: number | string;
  anchorTxid?: string;
  anchorStatus?: "local" | "preparing" | "pending" | "anchored" | "fault";
  anchorNetwork?: "neo-n3-mainnet" | "neo-n3-testnet" | "";
  anchorError?: string;
  anchored?: boolean;
  [k: string]: unknown;
}

const TEMPLATES = [
  { key: "release", label: "proofTemplateRelease", body: "proofTemplateReleaseBody" },
  { key: "audit", label: "proofTemplateAudit", body: "proofTemplateAuditBody" },
] as const;

const proofDeskArt = new URL("../public/proof-desk.webp", import.meta.url).href;

function shortHash(value: string | undefined): string {
  if (!value) return "------";
  return value.length > 16 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

function formatTimestamp(value: number | string | undefined): string {
  const raw = typeof value === "string" ? Number(value) : value;
  if (!raw || Number.isNaN(raw)) return "--";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(raw);
}

function isDigestLike(value: string): boolean {
  return /^[0-9a-f]{64}$/i.test(value.trim());
}

function anchorState(proof: Proof | null | undefined): "local" | "preparing" | "pending" | "anchored" | "fault" {
  if (proof?.anchorStatus === "preparing") return "preparing";
  if (proof?.anchorStatus === "pending") return "pending";
  if (proof?.anchorStatus === "fault") return "fault";
  if (proof?.anchorStatus === "anchored" || proof?.anchored) return "anchored";
  return "local";
}

export default function PlayArea({ t, state, dispatch }: P) {
  const { str, bool, val } = useStateBindings(state);

  const isCreating = bool("isCreating");
  const isVerifying = bool("isVerifying");
  const isAnchoring = bool("isAnchoring");
  const isRecovering = bool("isRecovering");
  const verifyError = bool("verifyError");
  const proofs = (val<Proof[]>("proofs", []) ?? []);
  const verifiedProof = val<Proof | null>("verifiedProof", null);
  const verificationSource = str("verificationSource") || "none";
  const detectedNetwork = str("network");
  const storageState = str("storageState") || "ready";
  const latestId = str("latestId");

  const [msg, setMsg] = useState("");
  const [verifyQuery, setVerifyQuery] = useState("");
  const [verifyNetwork, setVerifyNetwork] = useState<"neo-n3-mainnet" | "neo-n3-testnet">(
    detectedNetwork === "neo-n3-testnet" ? "neo-n3-testnet" : "neo-n3-mainnet",
  );

  useEffect(() => {
    if (detectedNetwork === "neo-n3-mainnet" || detectedNetwork === "neo-n3-testnet") {
      setVerifyNetwork(detectedNetwork);
    }
  }, [detectedNetwork]);

  const latestProof = proofs[0];
  const anchorTargetId = latestProof?.id ?? 0;
  const trimmedMsg = msg.trim();
  const contentChars = trimmedMsg.length;
  const hasDraft = contentChars > 0;
  const busy = isCreating || isAnchoring || isVerifying || isRecovering;
  const anchoredCount = proofs.filter((p) => anchorState(p) === "anchored").length;
  const pendingCount = proofs.filter((p) => anchorState(p) === "pending").length;
  const preparingCount = proofs.filter((p) => anchorState(p) === "preparing").length;
  const storageBlocked = storageState === "unavailable" || storageState === "corrupt";
  const activeProof = verifiedProof ?? latestProof ?? null;
  const latestAnchorState = anchorState(latestProof);
  const activeDigest = activeProof?.contentHash || "";
  const hasDigestDraft = hasDraft && isDigestLike(trimmedMsg);
  const documentType = hasDigestDraft ? t("documentTypeHash") : t("documentTypeText");
  const digestPreview = hasDigestDraft
    ? shortHash(trimmedMsg)
    : hasDraft
      ? t("pendingDigest")
      : activeDigest
        ? shortHash(activeDigest)
        : t("pendingDigest");
  // The `.tsp-proof-sheet__source` row is a label -> value pair, and this is the
  // LABEL half: it names which kind of source the sheet holds. Its empty branch
  // used to borrow `documentPreviewEmptyTitle`, so on first run the card header
  // and this row both printed "Ready for content" ~150px apart, reading as a
  // rendering glitch. An empty sheet has no third source *type* — it is still a
  // source-content sheet — and the row's value half already carries the state
  // ("Waiting"), so the label stays the plain category name.
  const sourceStateLabel = documentType;
  const sceneState = isCreating
    ? "creating"
    : isAnchoring
      ? "anchoring"
      : verifiedProof
        ? "verified"
        : hasDraft
          ? "draft"
          : proofs.length > 0
            ? "ready"
            : "idle";
  const networkLabel = detectedNetwork === "neo-n3-testnet"
    ? t("networkTestnet")
    : detectedNetwork === "neo-n3-mainnet"
      ? t("networkMainnet")
      : t("networkNotConnected");
  const activeAnchorState = anchorState(activeProof);
  const activeExplorerUrl = activeProof?.anchorTxid
    ? explorerTxUrl(activeProof.anchorTxid, activeProof.anchorNetwork || verifyNetwork)
    : "";
  const verificationSourceLabel = activeAnchorState === "preparing"
    ? t("submissionInterrupted")
    : verificationSource === "chain"
    ? t("chainVerified")
    : verificationSource === "reference"
      ? t("referenceOnly")
      : verificationSource === "unavailable"
        ? t("chainReadUnavailable")
    : verificationSource === "pending"
      ? t("broadcastPending")
      : verificationSource === "fault"
        ? t("anchorFaultShort")
        : t("deviceRecordOnly");
  const canAnchorLatest = latestAnchorState === "local" || latestAnchorState === "fault";
  const isVerifiedLocalProof = Boolean(
    verifiedProof &&
    proofs.some((proof) => proof.id === verifiedProof.id && proof.contentHash === verifiedProof.contentHash),
  );
  const statusTitle = isCreating
    ? t("proofPressStampingTitle")
    : isAnchoring
      ? t("proofPressAnchorAnchoring")
      : activeAnchorState === "preparing"
        ? t("anchorPreparationTitle")
        : activeAnchorState === "pending"
          ? t("anchorBroadcastPendingTitle")
          : activeAnchorState === "fault"
            ? t("anchorFaultTitle")
            : verificationSource === "reference"
              ? t("referenceInspectedTitle")
              : verificationSource === "unavailable"
                ? t("chainReadUnavailableTitle")
                : verifiedProof
                  ? t("validProof")
                  : hasDraft
                    ? t("proofPressReadyTitle")
                    : t("proofPressEmptyTitle");
  const statusBody = activeAnchorState === "preparing"
    ? t("anchorPreparationGuidance")
    : verificationSource === "reference"
      ? t("referenceBoundary")
      : verificationSource === "chain"
        ? t("chainVerifiedBody")
        : verificationSource === "unavailable"
          ? t("anchorRpcUnavailable")
          : hasDraft
            ? t("proofPressReadyBody")
            : t("proofPressEmptyBody");

  const handleAnchor = () => {
    if (!anchorTargetId || isAnchoring) return;
    void dispatch("anchorProof", anchorTargetId);
  };

  const handleCreate = async () => {
    if (!trimmedMsg || isCreating) return;
    try {
      const created = await dispatch("createProof", trimmedMsg);
      if (created === true) setMsg("");
    } catch {
      // The draft intentionally stays in the editor when dispatch or durable
      // storage fails. The framework surfaces the actionable error message.
    }
  };

  const handleVerify = () => {
    if (!verifyQuery.trim() || isVerifying) return;
    void dispatch("verifyProof", verifyQuery, verifyNetwork);
  };

  const applyTemplate = (labelKey: string, bodyKey: string) => {
    const next = `${t(labelKey)} - ${t(bodyKey)}`;
    setMsg((current) => current.trim() || next);
  };

  const scene = (
    <div className="tsp-workbench" data-state={sceneState}>
      <section className="tsp-document-card" aria-label={t("enterContent")}>
        <header className="tsp-document-card__head">
          <span className="tsp-icon-chip" aria-hidden="true">
            <FileText size={21} strokeWidth={2.25} />
          </span>
          <div>
            <span>{t("createPanelKicker")}</span>
            <strong>{hasDraft ? t("proofPressReadyTitle") : t("createPanelTitle")}</strong>
            <p>{hasDraft ? t("proofPressReadyBody") : t("createPanelBody")}</p>
          </div>
        </header>

        {storageBlocked && (
          <div className="tsp-journal-alert" data-state={storageState} role="alert">
            <HardDrive size={18} strokeWidth={2.25} aria-hidden="true" />
            <div>
              <strong>{storageState === "corrupt" ? t("journalCorruptTitle") : t("journalUnavailableTitle")}</strong>
              <p>{storageState === "corrupt" ? t("journalCorrupt") : t("journalUnavailable")}</p>
            </div>
            <button type="button" onClick={() => void dispatch("reloadProofs")}>
              <RefreshCw size={14} strokeWidth={2.25} aria-hidden="true" />
              {t("retryJournal")}
            </button>
          </div>
        )}

        <div className="tsp-proof-sheet" data-ready={hasDraft ? "true" : undefined}>
          <div className="tsp-proof-sheet__bar">
            <span>{t("proofSheetLabel")}</span>
            <strong>{hasDraft ? `${contentChars} ${t("contentChars").toLowerCase()}` : t("documentPreviewEmptyTitle")}</strong>
          </div>
          <div className="tsp-proof-sheet__surface" data-source={hasDigestDraft ? "digest" : hasDraft ? "content" : "empty"}>
            <OpenUiTextArea
              className="tsp-proof-sheet__editor"
              textareaClassName="tsp-proof-sheet__textarea"
              label={t("contentPlaceholder")}
              value={msg}
              onChange={(event) => setMsg(event.target.value)}
              placeholder={t("contentPlaceholder")}
              disabled={isCreating}
              maxLength={50_000}
              rows={3}
            />
            <span className="tsp-proof-sheet__seal" data-ready={hasDraft ? "true" : undefined} aria-hidden="true">
              <Stamp size={22} strokeWidth={2.2} />
            </span>
          </div>
          <div className="tsp-proof-sheet__source">
            <span>{sourceStateLabel}</span>
            <strong>{hasDigestDraft ? t("digestPassThrough") : hasDraft ? t("localHashPending") : t("proofRouteWaiting")}</strong>
          </div>
          <div className="tsp-proof-sheet__seal-row">
            <div className="tsp-proof-sheet__digest">
              <Fingerprint size={15} strokeWidth={2.3} aria-hidden="true" />
              <span>{digestPreview}</span>
            </div>
            <div className="tsp-proof-sheet__privacy">
              <ShieldCheck size={15} strokeWidth={2.25} aria-hidden="true" />
              <span>{t("proofRouteSave")}</span>
            </div>
          </div>
        </div>

        <div className="tsp-template-dock" aria-label={t("proofTemplatesLabel")}>
          <span>{t("proofTemplatesLabel")}</span>
          {TEMPLATES.map((template) => (
            <button
              key={template.key}
              type="button"
              onClick={() => applyTemplate(template.label, template.body)}
              disabled={Boolean(msg.trim()) || isCreating}
            >
              <PenLine size={14} strokeWidth={2.3} aria-hidden="true" />
              <span>{t(template.label)}</span>
            </button>
          ))}
        </div>

        <dl className="tsp-document-card__facts">
          <div>
            <dt>{t("documentTypeText")}</dt>
            <dd>{documentType}</dd>
          </div>
          <div>
            <dt>{t("contentChars")}</dt>
            <dd>{contentChars}</dd>
          </div>
          <div>
            <dt>{t("proofDigest")}</dt>
            <dd>{digestPreview}</dd>
          </div>
        </dl>
      </section>

      <section className="tsp-press-card" aria-label={t("proofPressLabel")}>
        <figure className="tsp-press-card__media">
          <img src={proofDeskArt} alt={t("proofDeskAlt")} />
        </figure>

        <div className="tsp-press-card__status">
          <div className="tsp-press-card__seal" aria-hidden="true">
            <span className="tsp-press-card__ring" />
            {verifiedProof ? <CheckCircle2 size={38} strokeWidth={1.9} /> : <Stamp size={40} strokeWidth={1.8} />}
          </div>
          <div className="tsp-press-card__copy">
            <span>{t("proofPressKicker")}</span>
            <strong>
              {statusTitle}
            </strong>
            <p>{statusBody}</p>
          </div>
        </div>

        <ol className="tsp-route" aria-label={t("proofRouteLabel")}>
          <li data-active={hasDraft || proofs.length > 0 ? "true" : undefined}>
            <Fingerprint size={17} strokeWidth={2.25} />
            <span>{t("proofRouteHash")}</span>
            <strong>{hasDraft || activeProof ? t("proofRouteReady") : t("proofRouteWaiting")}</strong>
          </li>
          <li data-active={proofs.length > 0 ? "true" : undefined}>
            <ShieldCheck size={17} strokeWidth={2.25} />
            <span>{t("proofRouteSave")}</span>
            <strong>{latestId || t("proofRouteWaiting")}</strong>
          </li>
          <li data-active={anchoredCount > 0 ? "true" : undefined}>
            <Link2 size={17} strokeWidth={2.25} />
            <span>{t("proofRouteAnchor")}</span>
            <strong>
              {latestAnchorState === "anchored"
                ? t("anchoredOnChain")
                : latestAnchorState === "preparing"
                  ? t("submissionInterrupted")
                : latestAnchorState === "pending"
                  ? t("broadcastPending")
                  : latestAnchorState === "fault"
                    ? t("anchorFaultShort")
                    : t("optional")}
            </strong>
          </li>
        </ol>

        <div className="tsp-anchor-truth" data-state={latestAnchorState}>
          <span><Link2 size={14} strokeWidth={2.25} aria-hidden="true" /> {networkLabel}</span>
          <p>
            {latestAnchorState === "preparing"
              ? t("anchorPreparationGuidance")
              : storageState === "unavailable" && latestProof?.anchorTxid
                ? t("anchorReceiptMemoryOnly", { txid: shortHash(latestProof.anchorTxid) })
                : pendingCount > 0
                  ? t("anchorPendingGuidance")
                  : t("anchorCostNote")}
          </p>
          {latestAnchorState === "preparing" && (
            <button
              type="button"
              onClick={() => void dispatch("releasePreparingAnchor", anchorTargetId)}
              disabled={busy}
            >
              <RefreshCw size={14} strokeWidth={2.25} aria-hidden="true" />
              {t("clearRetryLock")}
            </button>
          )}
          {latestAnchorState === "pending" && storageState === "unavailable" && latestProof?.anchorTxid && (
            <button type="button" onClick={() => void dispatch("copyAnchorTxid", anchorTargetId)}>
              <Copy size={14} strokeWidth={2.25} aria-hidden="true" />
              {t("copyReceipt")}
            </button>
          )}
          {pendingCount > 0 && storageState !== "unavailable" && (
            <button type="button" onClick={() => void dispatch("recoverPendingAnchors")} disabled={isRecovering}>
              <RefreshCw size={14} strokeWidth={2.25} aria-hidden="true" />
              {isRecovering ? t("checkingReceipt") : t("checkReceipt")}
            </button>
          )}
        </div>
      </section>
    </div>
  );

  const score = [
    { label: t("totalProofs"), value: storageBlocked ? t("notAvailable") : String(proofs.length), accent: true },
    { label: t("anchoredProofs"), value: storageBlocked ? t("notAvailable") : String(anchoredCount) },
    { label: t("latestId"), value: storageBlocked ? t("notAvailable") : latestId || t("latestIdNone") },
  ];

  const drawer = (
    <div className="tsp-drawer">
      <OpenUiPanel
        className="tsp-drawer__panel tsp-drawer__panel--wide"
        icon={<Search size={18} strokeWidth={2.35} aria-hidden="true" />}
        title={t("verifyProof")}
        subtitle={t("verifyPlaceholder")}
      >
        <div className="tsp-network-switch" aria-label={t("verificationNetwork")}>
          <span>{t("verificationNetwork")}</span>
          <div>
            <button
              type="button"
              data-active={verifyNetwork === "neo-n3-mainnet" ? "true" : undefined}
              onClick={() => setVerifyNetwork("neo-n3-mainnet")}
            >
              {t("networkMainnet")}
            </button>
            <button
              type="button"
              data-active={verifyNetwork === "neo-n3-testnet" ? "true" : undefined}
              onClick={() => setVerifyNetwork("neo-n3-testnet")}
            >
              {t("networkTestnet")}
            </button>
          </div>
        </div>
        <p className="tsp-verification-explainer">
          <ShieldCheck size={15} strokeWidth={2.25} aria-hidden="true" />
          <span>{t("verificationTruth")}</span>
        </p>
        <OpenUiTextField
          className="tsp-drawer__field"
          label={t("proofId")}
          value={verifyQuery}
          onChange={(e) => setVerifyQuery(e.target.value)}
          placeholder={t("verifyPlaceholder")}
          disabled={isVerifying || isAnchoring || isRecovering}
          mono
        />
        <div className="tsp-drawer__actions">
          <button className="mx2-btn mx2-btn--ghost" type="button" onClick={handleVerify} disabled={!verifyQuery.trim() || isVerifying || isAnchoring || isRecovering}>
            {isVerifying ? t("verifying") : t("verify")}
          </button>
        </div>
        {verifyError && (
          <OpenUiNotice className="tsp-drawer__notice" icon={<Search size={18} strokeWidth={2.35} aria-hidden="true" />} title={verificationSource === "fault" ? t("chainVerificationFailed") : t("verifyFailed")} type="error" />
        )}
        {!verifyError && verificationSource === "pending" && (
          <OpenUiNotice className="tsp-drawer__notice" icon={<RefreshCw size={18} strokeWidth={2.35} aria-hidden="true" />} title={t("anchorStillPending")} type="info">
            {t("anchorPendingGuidance")}
          </OpenUiNotice>
        )}
        {!verifyError && verificationSource === "unavailable" && (
          <OpenUiNotice className="tsp-drawer__notice" icon={<RefreshCw size={18} strokeWidth={2.35} aria-hidden="true" />} title={t("chainReadUnavailableTitle")} type="warning">
            {t("anchorRpcUnavailable")}
          </OpenUiNotice>
        )}
        {!verifyError && verificationSource === "reference" && (
          <OpenUiNotice className="tsp-drawer__notice" icon={<FileText size={18} strokeWidth={2.35} aria-hidden="true" />} title={t("referenceInspectedTitle")} type="info">
            {t("referenceBoundary")}
          </OpenUiNotice>
        )}
        {verifiedProof && (
          <div className="tsp-drawer__verified">
            <div className="tsp-verification-source" data-source={verificationSource}>
              <ShieldCheck size={15} strokeWidth={2.3} aria-hidden="true" />
              <span>{verificationSourceLabel}</span>
            </div>
            {verifiedProof.id > 0 && <p><strong>{t("proofId")}</strong> #{verifiedProof.id}</p>}
            {verifiedProof.contentHash && <p><strong>{t("proofDigest")}</strong> {verifiedProof.contentHash}</p>}
            {Boolean(verifiedProof.timestamp) && <p><strong>{t("timestamp")}</strong> {formatTimestamp(verifiedProof.timestamp)}</p>}
            {verifiedProof.anchorTxid && (
              <p className="tsp-anchor-reference">
                <strong>{t("anchorTxid")}</strong>
                <span>{shortHash(verifiedProof.anchorTxid)}</span>
                {activeExplorerUrl && (
                  <a href={activeExplorerUrl} target="_blank" rel="noreferrer">
                    {t("viewOnExplorer")} <ExternalLink size={13} strokeWidth={2.2} aria-hidden="true" />
                  </a>
                )}
              </p>
            )}
            {isVerifiedLocalProof && (
              <div className="tsp-verified-actions">
                <button type="button" onClick={() => void dispatch("copyProofDigest", verifiedProof.id)}>
                  <Copy size={14} strokeWidth={2.25} aria-hidden="true" /> {t("copyDigest")}
                </button>
                <button type="button" onClick={() => void dispatch("copyProofReference", verifiedProof.id)}>
                  <FileText size={14} strokeWidth={2.25} aria-hidden="true" /> {t("copyReference")}
                </button>
              </div>
            )}
          </div>
        )}
      </OpenUiPanel>

      <OpenUiPanel
        className="tsp-drawer__panel tsp-drawer__panel--wide"
        icon={<FileText size={18} strokeWidth={2.35} aria-hidden="true" />}
        title={t("recentProofs")}
        subtitle={storageBlocked
          ? t("journalUnavailableShort")
          : proofs.length > 0
            ? t("proofJournalSummary", { count: proofs.length, pending: pendingCount + preparingCount })
            : t("noProofsHint")}
      >
        {storageBlocked ? (
          <OpenUiNotice className="tsp-drawer__notice" icon={<HardDrive size={18} strokeWidth={2.35} aria-hidden="true" />} title={storageState === "corrupt" ? t("journalCorruptTitle") : t("journalUnavailableTitle")} type="error">
            {storageState === "corrupt" ? t("journalCorrupt") : t("journalUnavailable")}
          </OpenUiNotice>
        ) : proofs.length > 0 ? (
          <ul className="mx2-history">
            {proofs.slice(0, 10).map((p) => (
              <li key={p.id} className="mx2-history__item">
                <span className="mx2-history__face">#{p.id}</span>
                <span className="mx2-history__result">
                  {anchorState(p) === "anchored"
                    ? t("anchoredOnChain")
                    : anchorState(p) === "preparing"
                      ? t("submissionInterrupted")
                    : anchorState(p) === "pending"
                      ? t("broadcastPending")
                      : anchorState(p) === "fault"
                        ? t("anchorFaultShort")
                        : t("localOnly")}
                  <small>{shortHash(p.contentHash)}</small>
                </span>
                {(anchorState(p) === "local" || anchorState(p) === "fault") && (
                  <button className="mx2-btn mx2-btn--ghost" type="button" disabled={busy} onClick={() => void dispatch("anchorProof", p.id)}>{t("anchorShort")}</button>
                )}
                {anchorState(p) === "preparing" && (
                  <button className="mx2-btn mx2-btn--ghost" type="button" disabled={busy} onClick={() => void dispatch("releasePreparingAnchor", p.id)}>{t("clearRetryLock")}</button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <OpenUiNotice className="tsp-drawer__notice" icon={<FileText size={18} strokeWidth={2.35} aria-hidden="true" />} title={t("recentProofs")}>
            {t("noProofsHint")}
          </OpenUiNotice>
        )}
      </OpenUiPanel>
    </div>
  );

  return (
    <OpenUiProvider>
      <div className="timestamp-proof-play-area mx2 mx2-cat-tool">
        <PlayStage
          category="tool"
          stage={{ eyebrow: t("proofStageKicker"), title: t("proofStageTitle"), subtitle: t("proofPrivacy") }}
          scene={scene}
          score={score}
          actions={{
            primary: {
              label: isCreating ? "..." : t("createProof"),
              onClick: handleCreate,
              loading: isCreating,
              disabled: !trimmedMsg || busy || storageBlocked,
              icon: <Stamp size={18} strokeWidth={2.3} />,
            },
            secondary: [
              {
                label: latestAnchorState === "preparing"
                  ? t("clearRetryLock")
                  : latestAnchorState === "pending"
                    ? t("checkReceipt")
                    : t("anchorShort"),
                onClick: latestAnchorState === "preparing"
                  ? () => void dispatch("releasePreparingAnchor", anchorTargetId)
                  : latestAnchorState === "pending"
                    ? () => void dispatch("recoverPendingAnchors")
                    : handleAnchor,
                loading: isAnchoring || isRecovering,
                disabled: storageBlocked || !anchorTargetId || (!canAnchorLatest && latestAnchorState !== "pending" && latestAnchorState !== "preparing") || busy,
                icon: latestAnchorState === "pending" || latestAnchorState === "preparing"
                  ? <RefreshCw size={16} strokeWidth={2.25} />
                  : <Link2 size={16} strokeWidth={2.25} />,
              },
            ],
          }}
          drawerToggleLabel={t("proofWorkspace")}
          drawer={{ title: t("proofWorkspace"), children: drawer }}
        />
      </div>
    </OpenUiProvider>
  );
}
