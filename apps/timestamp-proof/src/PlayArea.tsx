/**
 * PlayArea.tsx — React version of Timestamp Proof PlayArea.
 */

import { useState } from "react";
import {
  Anchor,
  BadgeCheck,
  CheckCircle2,
  Copy,
  FileCheck2,
  FileText,
  Fingerprint,
  Hash,
  SearchCheck,
  ShieldCheck,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import ProofHero from "./components/ProofHero";
import type { TimestampProof } from "./composables/useTimestampProof";
import { explorerTxUrl } from "./utils/explorer";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

const PROOF_PRESETS = [
  {
    key: "release",
    labelKey: "proofTemplateRelease",
    bodyKey: "proofTemplateReleaseBody",
    sample: "release-notes.pdf v1.2.0 | sha256 pending | published 2026-06-20",
    icon: FileText,
  },
  {
    key: "audit",
    labelKey: "proofTemplateAudit",
    bodyKey: "proofTemplateAuditBody",
    sample:
      "audit-report-final.pdf | reviewed by security council | seal ready",
    icon: ShieldCheck,
  },
  {
    key: "digest",
    labelKey: "proofTemplateDigest",
    bodyKey: "proofTemplateDigestBody",
    sample: "7f83b1657ff1fc53b92dc18148a1d65dfa13583b2d4f4f6bdad4f3f4f7c2e6aa",
    icon: Hash,
  },
] satisfies ReadonlyArray<{
  key: string;
  labelKey: string;
  bodyKey: string;
  sample: string;
  icon: LucideIcon;
}>;

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { num, str, bool, val } = useStateBindings(state);

  const totalProofs = num("totalProofs");
  const anchoredProofs = num("anchoredProofs");
  const isCreating = bool("isCreating");
  const isVerifying = bool("isVerifying");
  const isAnchoring = bool("isAnchoring");
  const anchoringId = num("anchoringId");
  const verifyError = bool("verifyError");
  const rawLatestId = str("latestId", "—");
  const latestId = !rawLatestId || rawLatestId === "N/A" ? "—" : rawLatestId;
  const proofList = val<TimestampProof[]>("proofs", []) ?? [];
  const verifiedProof = val<TimestampProof>("verifiedProof", null);
  const hasProofStats =
    totalProofs > 0 || anchoredProofs > 0 || latestId !== "—";

  const [content, setContent] = useState("");
  const [verifyId, setVerifyId] = useState("");

  const trimmedContent = content.trim();
  const canCreate = trimmedContent.length > 0;
  const looksLikeSha256 = /^[a-fA-F0-9]{64}$/.test(trimmedContent);
  const contentKind = looksLikeSha256
    ? t("documentTypeHash")
    : t("documentTypeText");
  const previewTitle = trimmedContent
    ? contentKind
    : t("documentPreviewEmptyTitle");
  const previewBody = trimmedContent || t("documentPreviewEmpty");

  return (
    <div className="proof-play-area">
      <ProofHero t={t} />

      {hasProofStats && (
        <div className="proof-stats" role="group" aria-label={t("proofStats")}>
          <div className="proof-stat">
            <span className="proof-stat__label">{t("totalProofs")}</span>
            <span className="proof-stat__value">{totalProofs}</span>
          </div>
          <div className="proof-stat">
            <span className="proof-stat__label">{t("anchoredProofs")}</span>
            <span className="proof-stat__value">{anchoredProofs}</span>
          </div>
          <div className="proof-stat">
            <span className="proof-stat__label">{t("latestId")}</span>
            <span className="proof-stat__value proof-stat__value--mono">
              {latestId}
            </span>
          </div>
        </div>
      )}

      <section className="proof-workbench" aria-label={t("proofWorkspace")}>
        <NeoCard className="proof-composer">
          <div className="proof-panel-head">
            <span className="proof-panel-head__icon" aria-hidden="true">
              <FileCheck2 size={20} />
            </span>
            <div>
              <span>{t("createPanelKicker")}</span>
              <h3>{t("createPanelTitle")}</h3>
              <p>{t("createPanelBody")}</p>
            </div>
          </div>

          <div
            className="proof-template-row"
            aria-label={t("proofTemplatesLabel")}
          >
            {PROOF_PRESETS.map((preset) => {
              const Icon = preset.icon;

              return (
                <button
                  key={preset.key}
                  type="button"
                  className="proof-template-card"
                  onClick={() => setContent(preset.sample)}
                >
                  <span
                    className="proof-template-card__icon"
                    aria-hidden="true"
                  >
                    <Icon size={17} />
                  </span>
                  <span>
                    <strong>{t(preset.labelKey)}</strong>
                    <small>{t(preset.bodyKey)}</small>
                  </span>
                </button>
              );
            })}
          </div>

          <div
            className="proof-document-preview"
            aria-label={t("documentPreviewLabel")}
          >
            <div className="proof-document-preview__paper">
              <div className="proof-document-preview__lines" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <span className="proof-document-preview__seal" aria-hidden="true">
                <Fingerprint size={26} />
              </span>
              <span className="proof-document-preview__type">
                {previewTitle}
              </span>
              <p>{previewBody}</p>
            </div>
            <div className="proof-document-preview__meta">
              <span>
                <small>{t("contentChars")}</small>
                <strong>{trimmedContent.length}</strong>
              </span>
              <span>
                <small>{t("anchorStatus")}</small>
                <strong>{t("localOnly")}</strong>
              </span>
              <span>
                <small>{t("proofDigest")}</small>
                <strong>
                  {canCreate ? t("pendingDigest") : t("notAvailable")}
                </strong>
              </span>
            </div>
          </div>

          <div className="proof-route" aria-label={t("proofRouteLabel")}>
            <span className={canCreate ? "is-ready" : ""}>
              <Fingerprint size={16} aria-hidden="true" />
              <small>{t("proofRouteHash")}</small>
              <strong>
                {canCreate ? t("proofRouteReady") : t("proofRouteWaiting")}
              </strong>
            </span>
            <span>
              <CheckCircle2 size={16} aria-hidden="true" />
              <small>{t("proofRouteSave")}</small>
              <strong>{t("localOnly")}</strong>
            </span>
            <span>
              <Anchor size={16} aria-hidden="true" />
              <small>{t("proofRouteAnchor")}</small>
              <strong>{t("anchorShort")}</strong>
            </span>
          </div>

          <div className="proof-form proof-form--composer">
            <NeoInput
              value={content}
              type="textarea"
              label={t("enterContent")}
              placeholder={t("contentPlaceholder")}
              onChange={(val) => setContent(val)}
            />
            <div className="proof-privacy-note">
              <ShieldCheck size={16} aria-hidden="true" />
              <span>{t("proofPrivacy")}</span>
            </div>
            <NeoButton
              variant="primary"
              size="lg"
              block
              className="proof-cta"
              loading={isCreating}
              disabled={!canCreate}
              aria-label={t("createProof")}
              onClick={async () => {
                // Preserve the user's input until the proof is actually saved.
                // Clearing synchronously before the async dispatch resolves would
                // lose their text if hashing/persistence rejected.
                try {
                  await dispatch("createProof", content);
                  setContent("");
                } catch {
                  // Keep `content` intact so the user can retry without retyping.
                }
              }}
            >
              <FileCheck2 size={17} aria-hidden="true" />
              {isCreating ? t("creating") : t("createProof")}
            </NeoButton>
            {!canCreate && !isCreating && (
              <p className="proof-cta-hint">{t("createDisabledHint")}</p>
            )}
          </div>
        </NeoCard>

        <div className="proof-side-rail">
          <NeoCard className="proof-verifier">
            <div className="proof-panel-head proof-panel-head--compact">
              <span className="proof-panel-head__icon" aria-hidden="true">
                <SearchCheck size={20} />
              </span>
              <div>
                <span>{t("verifyPanelKicker")}</span>
                <h3>{t("verifyPanelTitle")}</h3>
                <p>{t("verifyPanelBody")}</p>
              </div>
            </div>

            <div className="proof-form verify-panel__body">
              <NeoInput
                value={verifyId}
                type="text"
                label={t("proofLookup")}
                placeholder={t("verifyPlaceholder")}
                error={verifyError ? t("invalidProof") : ""}
                onChange={(val) => {
                  setVerifyId(val);
                  if (verifyError) dispatch("clearVerifyError");
                }}
              />
              <NeoButton
                variant="secondary"
                block
                loading={isVerifying}
                disabled={!verifyId.trim()}
                aria-label={t("verifyProof")}
                onClick={() => dispatch("verifyProof", verifyId)}
              >
                <SearchCheck size={17} aria-hidden="true" />
                {isVerifying ? t("verifying") : t("verifyProof")}
              </NeoButton>
              {verifiedProof ? (
                <div className="verify-result">
                  <span className="verify-result__label">
                    <BadgeCheck size={16} aria-hidden="true" />
                    {t("validProof")}
                  </span>
                  <div className="verify-result__row">
                    <span>{t("proofId")}</span>
                    <span className="mono">#{verifiedProof.id}</span>
                  </div>
                  <div className="verify-result__row">
                    <span>{t("timestamp")}</span>
                    <span className="mono">
                      {new Date(verifiedProof.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="verify-result__row">
                    <span>{t("proofDigest")}</span>
                    <span className="mono verify-result__hash">
                      {verifiedProof.contentHash}
                    </span>
                  </div>
                  <div className="verify-result__row">
                    <span>{t("anchorStatus")}</span>
                    <span
                      className={`proof-anchor-badge ${verifiedProof.anchored ? "is-anchored" : "is-local"}`}
                    >
                      {verifiedProof.anchored
                        ? t("anchoredOnChain")
                        : t("localOnly")}
                    </span>
                  </div>
                  {verifiedProof.anchored && verifiedProof.anchorTxid && (
                    <>
                      <div className="verify-result__row">
                        <span>{t("anchorTxid")}</span>
                        <a
                          className="mono verify-result__hash verify-result__txlink"
                          href={explorerTxUrl(verifiedProof.anchorTxid)}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={t("viewOnExplorer")}
                        >
                          {verifiedProof.anchorTxid}
                        </a>
                      </div>
                      <div className="verify-result__note">
                        <strong>{t("howToVerifyTitle")}</strong>
                        <span>{t("howToVerifyBody")}</span>
                      </div>
                    </>
                  )}
                  <div className="verify-result__row">
                    <span>{t("contentPreview")}</span>
                    <span className="verify-result__preview">
                      {verifiedProof.content}
                    </span>
                  </div>
                  {!verifiedProof.anchored && (
                    <>
                      <p className="verify-result__cost-note">
                        {t("anchorCostNote")}
                      </p>
                      <NeoButton
                        variant="primary"
                        size="sm"
                        loading={
                          isAnchoring && anchoringId === verifiedProof.id
                        }
                        disabled={isAnchoring}
                        aria-label={t("anchorOnChain")}
                        onClick={() =>
                          dispatch("anchorProof", verifiedProof.id)
                        }
                      >
                        <Anchor size={15} aria-hidden="true" />
                        {t("anchorOnChain")}
                      </NeoButton>
                    </>
                  )}
                </div>
              ) : (
                <p className="verify-result__empty">{t("verifyEmpty")}</p>
              )}
            </div>
          </NeoCard>

          {totalProofs === 0 ? (
            <div className="empty-state">
              <span className="empty-badge" aria-hidden="true">
                <FileText size={22} />
              </span>
              <span className="empty-text">{t("noProofs")}</span>
              <span className="empty-hint">{t("noProofsHint")}</span>
            </div>
          ) : (
            <NeoCard
              className="proof-ledger"
              title={t("recentProofs")}
              header={
                <NeoButton
                  variant="ghost"
                  size="sm"
                  aria-label={t("clearAllProofs")}
                  onClick={() => dispatch("clearProofs")}
                >
                  {t("clearAllProofs")}
                </NeoButton>
              }
            >
              <ul className="proof-list">
                {proofList.map((proof) => (
                  <li key={proof.id} className="proof-list__item">
                    <div className="proof-list__main">
                      <span className="proof-list__id mono">#{proof.id}</span>
                      <span className="proof-list__hash mono">
                        {proof.contentHash}
                      </span>
                      <span className="proof-list__time">
                        {new Date(proof.timestamp).toLocaleString()}
                      </span>
                      <span
                        className={`proof-anchor-badge ${proof.anchored ? "is-anchored" : "is-local"}`}
                      >
                        {proof.anchored ? t("anchoredOnChain") : t("localOnly")}
                      </span>
                    </div>
                    <div className="proof-list__actions">
                      <NeoButton
                        variant="secondary"
                        size="sm"
                        aria-label={t("verify")}
                        onClick={() =>
                          dispatch("verifyProof", String(proof.id))
                        }
                      >
                        <SearchCheck size={15} aria-hidden="true" />
                        {t("verify")}
                      </NeoButton>
                      {!proof.anchored && (
                        <NeoButton
                          variant="ghost"
                          size="sm"
                          loading={isAnchoring && anchoringId === proof.id}
                          disabled={isAnchoring}
                          aria-label={t("anchorOnChain")}
                          onClick={() => dispatch("anchorProof", proof.id)}
                        >
                          <Anchor size={15} aria-hidden="true" />
                          {t("anchorShort")}
                        </NeoButton>
                      )}
                      <NeoButton
                        variant="ghost"
                        size="sm"
                        aria-label={t("copyDigest")}
                        onClick={() => dispatch("copyProofDigest", proof.id)}
                      >
                        <Copy size={15} aria-hidden="true" />
                      </NeoButton>
                      <NeoButton
                        variant="ghost"
                        size="sm"
                        aria-label={t("copyReference")}
                        onClick={() => dispatch("copyProofReference", proof.id)}
                      >
                        <FileText size={15} aria-hidden="true" />
                      </NeoButton>
                      <NeoButton
                        variant="ghost"
                        size="sm"
                        aria-label={t("deleteProof")}
                        onClick={() => dispatch("deleteProof", proof.id)}
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </NeoButton>
                    </div>
                  </li>
                ))}
              </ul>
            </NeoCard>
          )}
        </div>
      </section>
    </div>
  );
}
