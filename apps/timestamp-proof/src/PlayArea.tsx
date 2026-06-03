/**
 * PlayArea.tsx — React version of Timestamp Proof PlayArea.
 */

import { useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import ProofHero from "./components/ProofHero";
import type { TimestampProof } from "./composables/useTimestampProof";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { num, str, bool, val } = useStateBindings(state);

  const totalProofs = num("totalProofs");
  const yourProofs = num("yourProofs");
  const isCreating = bool("isCreating");
  const isVerifying = bool("isVerifying");
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
      <ProofHero t={t} totalProofs={totalProofs} yourProofs={yourProofs} latestId={latestId} />

      {/* Stat tiles — boxed family rhythm (shows 0 / — when empty) */}
      <div className="proof-stats" role="group" aria-label={t("proofStats") || "Proof Stats"}>
        <div className="proof-stat">
          <span className="proof-stat__label">{t("totalProofs") || "Total Proofs"}</span>
          <span className="proof-stat__value">{totalProofs}</span>
        </div>
        <div className="proof-stat">
          <span className="proof-stat__label">{t("yourProofs") || "Your Proofs"}</span>
          <span className="proof-stat__value">{yourProofs}</span>
        </div>
        <div className="proof-stat">
          <span className="proof-stat__label">{t("latestId") || "Latest ID"}</span>
          <span className="proof-stat__value proof-stat__value--mono">{latestId}</span>
        </div>
      </div>

      {/* Primary action — create a proof */}
      <NeoCard title={t("createProof") || "Create Proof"}>
        <div className="proof-form">
          <NeoInput
            value={content}
            type="textarea"
            label={t("enterContent") || "Enter content to timestamp"}
            placeholder={t("contentPlaceholder") || "Enter text, hash, or data to create an immutable timestamp proof..."}
            onChange={(val) => setContent(val)}
          />
          <NeoButton
            variant="primary"
            size="lg"
            block
            className="proof-cta"
            loading={isCreating}
            disabled={!canCreate}
            aria-label={t("createProof") || "Create Proof"}
            onClick={() => {
              dispatch("createProof", content);
              setContent("");
            }}
          >
            {isCreating ? t("creating") || "Creating..." : t("createProof") || "Create Proof"}
          </NeoButton>
          {!canCreate && !isCreating && (
            <p className="proof-cta-hint">{t("enterContent") || "Enter content to timestamp"}</p>
          )}
        </div>
      </NeoCard>

      {/* Recent proofs / empty state */}
      {totalProofs === 0 ? (
        <div className="empty-state">
          <span className="empty-badge" aria-hidden="true">
            <span className="empty-icon">&#x2726;</span>
          </span>
          <span className="empty-text">{t("noProofs") || "No proofs created yet"}</span>
        </div>
      ) : (
        <NeoCard title={t("recentProofs") || "Recent Proofs"}>
          <ul className="proof-list">
            {proofList.map((proof) => (
              <li key={proof.id} className="proof-list__item">
                <span className="proof-list__id mono">#{proof.id}</span>
                <span className="proof-list__hash mono">{proof.contentHash}</span>
                <span className="proof-list__time">{new Date(proof.timestamp).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        </NeoCard>
      )}

      {/* Secondary action — verify by ID (demoted into a collapsible panel) */}
      <details className="verify-panel">
        <summary className="verify-panel__summary">{t("verifyProof") || "Verify Proof"}</summary>
        <div className="proof-form verify-panel__body">
          <NeoInput
            value={verifyId}
            type="number"
            label={t("enterProofId") || "Enter Proof ID"}
            placeholder="1"
            error={verifyError ? t("invalidProof") || "Invalid Proof" : ""}
            onChange={(val) => setVerifyId(val)}
          />
          <NeoButton
            variant="secondary"
            block
            loading={isVerifying}
            disabled={!verifyId.trim()}
            aria-label={t("verifyProof") || "Verify Proof"}
            onClick={() => dispatch("verifyProof", verifyId)}
          >
            {t("verifyProof") || "Verify Proof"}
          </NeoButton>
          {verifiedProof && (
            <div className="verify-result">
              <span className="verify-result__label">{t("validProof") || "Proof Found"}</span>
              <div className="verify-result__row">
                <span>{t("proofId") || "Proof ID"}</span>
                <span className="mono">#{verifiedProof.id}</span>
              </div>
              <div className="verify-result__row">
                <span>{t("timestamp") || "Timestamp"}</span>
                <span className="mono">{new Date(verifiedProof.timestamp).toLocaleString()}</span>
              </div>
              <div className="verify-result__row">
                <span>{t("verifiedContent") || "Verified Content"}</span>
                <span className="mono verify-result__hash">{verifiedProof.contentHash}</span>
              </div>
            </div>
          )}
        </div>
      </details>
    </div>
  );
}
