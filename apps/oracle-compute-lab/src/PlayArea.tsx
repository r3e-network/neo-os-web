import { NeoButton, NeoInput } from "@shared/components-react";
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

  const jobStatus = str("jobStatus", t("notAvailable"));
  const jobId = str("jobId", t("notAvailable"));
  const attestation = str("attestation", t("notAvailable"));
  const latestOutput = str("latestOutput", "{}");
  const scriptName = str("scriptName", "health_check");
  const inputJson = str("inputJson", '{\n  "message": "hello from miniapp"\n}');
  const isRequesting = bool("isRequesting");

  return (
    <div className="compute-play-area">
      {/* Result Section */}
      <div className="result-section">
        <div className="result-grid">
          <div>
            <span className="label">{t("labelStatus")}</span>
            <span className="value">{jobStatus}</span>
          </div>
          <div>
            <span className="label">{t("labelJob")}</span>
            <span className="value">{jobId}</span>
          </div>
          <div>
            <span className="label">{t("labelAttestation")}</span>
            <span className="value">{attestation}</span>
          </div>
          <div>
            <span className="label">{t("labelOutput")}</span>
            <span className="value">{latestOutput}</span>
          </div>
        </div>
      </div>

      {/* Operation Section */}
      <div className="operation-section">
        <div className="stack">
          <NeoInput
            value={scriptName}
            label={t("scriptName")}
            placeholder={t("scriptNamePlaceholder")}
            onChange={(val) => dispatch("setScriptName", val)}
          />
          <NeoInput
            type="textarea"
            value={inputJson}
            label={t("inputJson")}
            placeholder={t("inputJsonPlaceholder")}
            aria-label={t("inputJson")}
            onChange={(val) => dispatch("setInputJson", val)}
          />
          <NeoButton variant="primary" loading={isRequesting} onClick={() => dispatch("runJob")}>
            {t("execute")}
          </NeoButton>
        </div>
      </div>
    </div>
  );
}
