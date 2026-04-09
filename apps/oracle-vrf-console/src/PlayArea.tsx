import { NeoButton } from "@shared/components-react";
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

  const requestId = str("requestId", t("notAvailable"));
  const randomValue = str("randomValue", t("notAvailable"));
  const proof = str("proof", t("notAvailable"));
  const isRequesting = bool("isRequesting");

  return (
    <div className="vrf-play-area">
      {/* Result Section */}
      <div className="result-grid">
        <div><span className="label">{t("labelRequest")}</span><span className="value">{requestId}</span></div>
        <div><span className="label">{t("labelValue")}</span><span className="value">{randomValue}</span></div>
        <div><span className="label">{t("labelProof")}</span><span className="value">{proof}</span></div>
      </div>

      {/* Operation Section */}
      <NeoButton variant="primary" loading={isRequesting} aria-label={t("requestRandom")} onClick={() => dispatch("requestRandom")}>
        {t("requestRandom")}
      </NeoButton>
    </div>
  );
}
