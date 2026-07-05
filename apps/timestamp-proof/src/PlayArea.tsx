/**
 * PlayArea.tsx - Timestamp Proof.
 *
 * Tool identity: a clean proof desk where the user's material becomes a local
 * certificate first, then an optional public anchor. The stage shows the
 * workflow and preview, not an empty stamp backdrop or a flat form.
 */
import { useState } from "react";
import {
  CheckCircle2,
  FileText,
  Fingerprint,
  Link2,
  PenLine,
  Search,
  ShieldCheck,
  Stamp,
} from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { OpenUiNotice, OpenUiPanel, OpenUiProvider, OpenUiTextField, PlayStage } from "@shared/components-react/v2";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

interface Proof {
  id: number;
  content?: string;
  contentHash?: string;
  timestamp?: number | string;
  anchorTxid?: string;
  anchored?: boolean;
  [k: string]: unknown;
}

const TEMPLATES = [
  { key: "release", label: "proofTemplateRelease", body: "proofTemplateReleaseBody" },
  { key: "audit", label: "proofTemplateAudit", body: "proofTemplateAuditBody" },
  { key: "digest", label: "proofTemplateDigest", body: "proofTemplateDigestBody" },
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

export default function PlayArea({ t, state, dispatch }: P) {
  const { str, bool, val } = useStateBindings(state);

  const isCreating = bool("isCreating");
  const isVerifying = bool("isVerifying");
  const isAnchoring = bool("isAnchoring");
  const verifyError = bool("verifyError");
  const proofs = (val<Proof[]>("proofs", []) ?? []);
  const verifiedProof = val<Proof | null>("verifiedProof", null);
  const latestId = str("latestId");

  const [msg, setMsg] = useState("");
  const [verifyQuery, setVerifyQuery] = useState("");

  const latestProof = proofs[0];
  const anchorTargetId = latestProof?.id ?? 0;
  const trimmedMsg = msg.trim();
  const contentChars = trimmedMsg.length;
  const hasDraft = contentChars > 0;
  const busy = isCreating || isAnchoring || isVerifying;
  const anchoredCount = proofs.filter((p) => p.anchored).length;
  const activeProof = verifiedProof ?? latestProof ?? null;
  const activeDigest = activeProof?.contentHash || "";
  const documentType = hasDraft && isDigestLike(trimmedMsg) ? t("documentTypeHash") : t("documentTypeText");
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

  const handleAnchor = () => {
    if (!anchorTargetId || isAnchoring) return;
    void dispatch("anchorProof", anchorTargetId);
  };

  const handleCreate = () => {
    if (!trimmedMsg || isCreating) return;
    void dispatch("createProof", trimmedMsg);
    setMsg("");
  };

  const handleVerify = () => {
    if (!verifyQuery.trim() || isVerifying) return;
    void dispatch("verifyProof", verifyQuery);
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

        <div className="tsp-proof-sheet" data-ready={hasDraft ? "true" : undefined}>
          <div className="tsp-proof-sheet__bar">
            <span>{t("proofSheetLabel")}</span>
            <strong>{hasDraft ? `${contentChars} ${t("contentChars").toLowerCase()}` : t("documentPreviewEmptyTitle")}</strong>
          </div>
          <div className="tsp-proof-sheet__surface">
            <textarea
              className="tsp-document-card__input"
              value={msg}
              onChange={(event) => setMsg(event.target.value)}
              placeholder={t("contentPlaceholder")}
              disabled={isCreating}
              aria-label={t("contentPlaceholder")}
              rows={3}
            />
            <span className="tsp-proof-sheet__seal" aria-hidden="true">
              <Stamp size={22} strokeWidth={2.2} />
            </span>
          </div>
          <div className="tsp-proof-sheet__seal-row">
            <div className="tsp-proof-sheet__digest">
              <Fingerprint size={15} strokeWidth={2.3} aria-hidden="true" />
              <span>{activeDigest ? shortHash(activeDigest) : t("pendingDigest")}</span>
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
            <dd>{activeDigest ? shortHash(activeDigest) : t("pendingDigest")}</dd>
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
              {isCreating
                ? t("proofPressStampingTitle")
                : isAnchoring
                  ? t("proofPressAnchorAnchoring")
                  : verifiedProof
                    ? t("validProof")
                    : hasDraft
                      ? t("proofPressReadyTitle")
                      : t("proofPressEmptyTitle")}
            </strong>
            <p>{hasDraft ? t("proofPressReadyBody") : t("proofPressEmptyBody")}</p>
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
            <strong>{latestId || "--"}</strong>
          </li>
          <li data-active={anchoredCount > 0 ? "true" : undefined}>
            <Link2 size={17} strokeWidth={2.25} />
            <span>{t("proofRouteAnchor")}</span>
            <strong>{anchoredCount > 0 ? t("anchoredOnChain") : t("localOnly")}</strong>
          </li>
        </ol>
      </section>
    </div>
  );

  const score = [
    { label: t("totalProofs"), value: String(proofs.length), accent: true },
    { label: t("anchoredProofs"), value: String(anchoredCount) },
    { label: t("latestId"), value: latestId || "--" },
  ];

  const drawer = (
    <div className="tsp-drawer">
      <OpenUiPanel
        className="tsp-drawer__panel tsp-drawer__panel--wide"
        icon={<Search size={18} strokeWidth={2.35} aria-hidden="true" />}
        title={t("verifyProof")}
        subtitle={t("verifyPlaceholder")}
      >
        <OpenUiTextField
          className="tsp-drawer__field"
          label={t("proofId")}
          value={verifyQuery}
          onChange={(e) => setVerifyQuery(e.target.value)}
          placeholder={t("verifyPlaceholder")}
          disabled={isVerifying}
          mono
        />
        <div className="tsp-drawer__actions">
          <button className="mx2-btn mx2-btn--ghost" type="button" onClick={handleVerify} disabled={!verifyQuery.trim() || isVerifying}>
            {isVerifying ? t("verifying") : t("verify")}
          </button>
        </div>
        {verifyError && (
          <OpenUiNotice className="tsp-drawer__notice" icon={<Search size={18} strokeWidth={2.35} aria-hidden="true" />} title={t("verifyFailed")} type="error" />
        )}
        {verifiedProof && (
          <div className="tsp-drawer__verified">
            <p><strong>{t("proofId")}</strong> #{verifiedProof.id}</p>
            <p><strong>{t("proofDigest")}</strong> {verifiedProof.contentHash}</p>
            <p><strong>{t("timestamp")}</strong> {formatTimestamp(verifiedProof.timestamp)}</p>
            {verifiedProof.anchored && <p><strong>{t("anchorTxid")}</strong> {verifiedProof.anchorTxid}</p>}
          </div>
        )}
      </OpenUiPanel>

      <OpenUiPanel
        className="tsp-drawer__panel"
        icon={<Link2 size={18} strokeWidth={2.35} aria-hidden="true" />}
        title={t("anchorOnChain")}
        subtitle={t("anchorCostNote")}
      >
        <div className="tsp-drawer__actions">
          <button className="mx2-btn mx2-btn--ghost" type="button" onClick={handleAnchor} disabled={!anchorTargetId || isAnchoring || Boolean(latestProof?.anchored)}>
            {isAnchoring ? t("proofPressAnchorAnchoring") : t("anchorShort")}
          </button>
        </div>
      </OpenUiPanel>

      <OpenUiPanel
        className="tsp-drawer__panel"
        icon={<FileText size={18} strokeWidth={2.35} aria-hidden="true" />}
        title={t("recentProofs")}
        subtitle={proofs.length > 0 ? `${proofs.length}` : t("noProofsHint")}
      >
        {proofs.length > 0 ? (
          <ul className="mx2-history">
            {proofs.slice(0, 10).map((p) => (
              <li key={p.id} className="mx2-history__item">
                <span className="mx2-history__face">#{p.id}</span>
                <span className="mx2-history__result">{p.anchored ? t("anchoredOnChain") : t("localOnly")}</span>
                {!p.anchored && <button className="mx2-btn mx2-btn--ghost" type="button" onClick={() => void dispatch("anchorProof", p.id)}>{t("anchorShort")}</button>}
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
              disabled: !trimmedMsg || busy,
              icon: <Stamp size={18} strokeWidth={2.3} />,
            },
            secondary: [
              {
                label: t("anchorShort"),
                onClick: handleAnchor,
                loading: isAnchoring,
                disabled: !anchorTargetId || Boolean(latestProof?.anchored) || isAnchoring,
                icon: <Link2 size={16} strokeWidth={2.25} />,
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
