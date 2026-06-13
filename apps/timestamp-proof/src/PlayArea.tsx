/**
 * PlayArea.tsx — React version of Timestamp Proof PlayArea.
 */

import { useState } from "react";
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

  const [content, setContent] = useState("");
  const [verifyId, setVerifyId] = useState("");

  const canCreate = content.trim().length > 0;

  return (
    <div className="proof-play-area">
      <ProofHero t={t} />

      {/* Stat tiles — the single stat surface (shows 0 / — when empty) */}
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
          <span className="proof-stat__value proof-stat__value--mono">{latestId}</span>
        </div>
      </div>

      {/* Primary action — create a proof */}
      <NeoCard title={t("createProof")}>
        <div className="proof-form">
          <NeoInput
            value={content}
            type="textarea"
            label={t("enterContent")}
            placeholder={t("contentPlaceholder")}
            onChange={(val) => setContent(val)}
          />
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
            {isCreating ? t("creating") : t("createProof")}
          </NeoButton>
          {!canCreate && !isCreating && (
            <p className="proof-cta-hint">{t("createDisabledHint")}</p>
          )}
        </div>
      </NeoCard>

      {/* Secondary action — verify by id, digest, or original content */}
      <NeoCard title={t("verifyProof")}>
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
            {isVerifying ? t("verifying") : t("verifyProof")}
          </NeoButton>
          {verifiedProof ? (
            <div className="verify-result">
              <span className="verify-result__label">{t("validProof")}</span>
              <div className="verify-result__row">
                <span>{t("proofId")}</span>
                <span className="mono">#{verifiedProof.id}</span>
              </div>
              <div className="verify-result__row">
                <span>{t("timestamp")}</span>
                <span className="mono">{new Date(verifiedProof.timestamp).toLocaleString()}</span>
              </div>
              <div className="verify-result__row">
                <span>{t("proofDigest")}</span>
                <span className="mono verify-result__hash">{verifiedProof.contentHash}</span>
              </div>
              <div className="verify-result__row">
                <span>{t("anchorStatus")}</span>
                <span
                  className={`proof-anchor-badge ${verifiedProof.anchored ? "is-anchored" : "is-local"}`}
                >
                  {verifiedProof.anchored ? t("anchoredOnChain") : t("localOnly")}
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
                <span className="verify-result__preview">{verifiedProof.content}</span>
              </div>
              {!verifiedProof.anchored && (
                <>
                  <p className="verify-result__cost-note">{t("anchorCostNote")}</p>
                  <NeoButton
                    variant="primary"
                    size="sm"
                    loading={isAnchoring && anchoringId === verifiedProof.id}
                    disabled={isAnchoring}
                    aria-label={t("anchorOnChain")}
                    onClick={() => dispatch("anchorProof", verifiedProof.id)}
                  >
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

      {/* Recent proofs / empty state */}
      {totalProofs === 0 ? (
        <div className="empty-state">
          <span className="empty-badge" aria-hidden="true">
            <span className="empty-icon">&#x2726;</span>
          </span>
          <span className="empty-text">{t("noProofs")}</span>
          <span className="empty-hint">{t("noProofsHint")}</span>
        </div>
      ) : (
        <NeoCard
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
                  <span className="proof-list__hash mono">{proof.contentHash}</span>
                  <span className="proof-list__time">{new Date(proof.timestamp).toLocaleString()}</span>
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
                    onClick={() => dispatch("verifyProof", String(proof.id))}
                  >
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
                      {t("anchorShort")}
                    </NeoButton>
                  )}
                  <NeoButton
                    variant="ghost"
                    size="sm"
                    aria-label={t("copyDigest")}
                    onClick={() => dispatch("copyProofDigest", proof.id)}
                  >
                    &#x2398;
                  </NeoButton>
                  <NeoButton
                    variant="ghost"
                    size="sm"
                    aria-label={t("copyReference")}
                    onClick={() => dispatch("copyProofReference", proof.id)}
                  >
                    &#x29C9;
                  </NeoButton>
                  <NeoButton
                    variant="ghost"
                    size="sm"
                    aria-label={t("deleteProof")}
                    onClick={() => dispatch("deleteProof", proof.id)}
                  >
                    &#x2715;
                  </NeoButton>
                </div>
              </li>
            ))}
          </ul>
        </NeoCard>
      )}
    </div>
  );
}
