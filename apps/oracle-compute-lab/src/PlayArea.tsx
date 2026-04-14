/**
 * PlayArea.tsx — Oracle Compute Lab
 *
 * Full interactive compute console: stats bar with job status and compute type,
 * environment info, result grid with job details, and script execution form.
 */

import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool } = useStateBindings(state);

  const jobStatus = str("jobStatus", t("notAvailable") || "N/A");
  const jobId = str("jobId", t("notAvailable") || "N/A");
  const attestation = str("attestation", t("notAvailable") || "N/A");
  const latestOutput = str("latestOutput", "{}");
  const scriptName = str("scriptName", "health_check");
  const inputJson = str("inputJson", '{\n  "message": "hello from miniapp"\n}');
  const isRequesting = bool("isRequesting");
  const computeUrl = str("computeUrl");
  const oracleHash = str("oracleHash");
  const computeType = str("computeType");

  return (
    <div className="compute-play-area">
      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat-chip">
          <span className="stat-value">{jobStatus}</span>
          <span className="stat-label">{t("labelStatus") || "Status"}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-value">{computeType || "--"}</span>
          <span className="stat-label">{t("computeType") || "Compute Type"}</span>
        </div>
        <div className="stat-chip stat-chip--wide">
          <span className="stat-value">{jobId !== (t("notAvailable") || "N/A") ? jobId.slice(0, 12) + "..." : "--"}</span>
          <span className="stat-label">{t("labelJob") || "Job ID"}</span>
        </div>
      </div>

      {/* Environment Info */}
      <NeoCard variant="erobo" className="env-card">
        <div className="env-grid">
          <div className="env-item">
            <span className="env-label">{t("computeUrl") || "Compute URL"}</span>
            <span className="env-value">{computeUrl || "--"}</span>
          </div>
          <div className="env-item">
            <span className="env-label">{t("oracleHash") || "Oracle Hash"}</span>
            <span className="env-value">{oracleHash || "--"}</span>
          </div>
        </div>
      </NeoCard>

      {/* Result Section */}
      <NeoCard variant="erobo" className="result-card">
        <div className="result-grid">
          <div className="result-row">
            <span className="label">{t("labelStatus") || "Status"}</span>
            <span className="value">{jobStatus}</span>
          </div>
          <div className="result-row">
            <span className="label">{t("labelJob") || "Job ID"}</span>
            <span className="value mono">{jobId}</span>
          </div>
          <div className="result-row">
            <span className="label">{t("labelAttestation") || "Attestation"}</span>
            <span className="value mono">{attestation}</span>
          </div>
        </div>
        <div className="output-section">
          <span className="label">{t("labelOutput") || "Output"}</span>
          <pre className="json-box">{latestOutput}</pre>
        </div>
      </NeoCard>

      {/* Operation Section */}
      <NeoCard variant="erobo" className="operation-card">
        <div className="stack">
          <NeoInput
            value={scriptName}
            label={t("scriptName") || "Script Name"}
            placeholder={t("scriptNamePlaceholder") || "health_check"}
            onChange={(v: string) => dispatch("setScriptName", v)}
          />
          <NeoInput
            type="textarea"
            value={inputJson}
            label={t("inputJson") || "Input JSON"}
            placeholder={t("inputJsonPlaceholder") || '{"key": "value"}'}
            aria-label={t("inputJson") || "Input JSON"}
            onChange={(v: string) => dispatch("setInputJson", v)}
          />
          <NeoButton variant="primary" loading={isRequesting} onClick={() => dispatch("runJob")} aria-label={t("execute") || "Execute"}>
            {t("execute") || "Execute"}
          </NeoButton>
        </div>
      </NeoCard>
    </div>
  );
}
