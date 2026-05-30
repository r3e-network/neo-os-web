/**
 * PlayArea.tsx — React version of Timestamp Proof PlayArea.
 */

import { useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import ProofHero from "./components/ProofHero";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { num, str, bool } = useStateBindings(state);

  const totalProofs = num("totalProofs");
  const yourProofs = num("yourProofs");
  const isCreating = bool("isCreating");
  const latestId = str("latestId", t("notAvailable") || "N/A");

  const [content, setContent] = useState("");

  return (
    <div className="proof-play-area">
      <ProofHero t={t} totalProofs={totalProofs} yourProofs={yourProofs} />

      {/* Latest Proof Info */}
      <div className="latest-proof-bar">
        <span className="latest-label">{t("latestId") || "Latest ID"}</span>
        <span className="latest-value">{latestId}</span>
      </div>

      {/* Create Proof Form */}
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
            loading={isCreating}
            disabled={!content.trim()}
            aria-label={t("createProof") || "Create Proof"}
            onClick={() => {
              dispatch("createProof", content);
              setContent("");
            }}
          >
            {isCreating ? t("creating") || "Creating..." : t("createProof") || "Create Proof"}
          </NeoButton>
        </div>
      </NeoCard>

      {/* Proof List */}
      {totalProofs === 0 && (
        <div className="empty-state">
          <span className="empty-icon" aria-hidden="true">&#x2726;</span>
          <span className="empty-text">{t("noProofs") || "No proofs created yet"}</span>
        </div>
      )}
    </div>
  );
}
