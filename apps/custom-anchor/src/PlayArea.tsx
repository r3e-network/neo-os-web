import { useMemo } from "react";
import type { PlayAreaProps } from "@shared/react/defineMiniApp";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import "./PlayArea.scss";

function truncate(value: string): string {
  if (value.length <= 34) return value;
  return `${value.slice(0, 18)}...${value.slice(-10)}`;
}

export default function PlayArea({ t, state, launchContext, status }: PlayAreaProps) {
  const { str, num, bool } = useStateBindings(state);
  const anchorAppId = str("anchorAppId");
  const isLoading = bool("isLoading");
  const agentCount = num("agentCount");
  const launchKeys = useMemo(
    () => launchContext.keys.filter((key) => key !== "anchorAppId").slice(0, 3),
    [launchContext.signature],
  );

  return (
    <div className="custom-anchor-playarea">
      <section className="custom-anchor-hero">
        <div>
          <span className="custom-anchor-kicker">{t("title")}</span>
          <h2>{anchorAppId ? t("readyForAnchor") : t("noAnchorTitle")}</h2>
          <p>{anchorAppId ? truncate(anchorAppId) : t("noAnchorBody")}</p>
        </div>
        <div className="custom-anchor-orbit" aria-hidden="true">
          <span>21</span>
          <small>AA</small>
        </div>
      </section>

      <div className="custom-anchor-metrics" aria-live="polite">
        <div>
          <span>{t("userStake")}</span>
          <strong>{str("userStake")} NEO</strong>
        </div>
        <div>
          <span>{t("pendingRewards")}</span>
          <strong>{str("pendingRewards")} GAS</strong>
        </div>
        <div>
          <span>{t("rewardReserve")}</span>
          <strong>{str("rewardReserve")} GAS</strong>
        </div>
      </div>

      <section className="custom-anchor-model">
        <div>
          <h3>{t("agentModel")}</h3>
          <p>{t("agentModelBody")}</p>
        </div>
        <dl>
          <div>
            <dt>{t("totalStaked")}</dt>
            <dd>{str("totalStaked")} NEO</dd>
          </div>
          <div>
            <dt>{t("agentCount")}</dt>
            <dd>{agentCount || 21}</dd>
          </div>
        </dl>
      </section>

      {(isLoading || status?.msg || launchKeys.length > 0) && (
        <div className="custom-anchor-footnote">
          {isLoading && <span>Loading on-chain anchor state...</span>}
          {status?.msg && <span>{status.msg}</span>}
          {launchKeys.length > 0 && <span>Launch params: {launchKeys.join(", ")}</span>}
        </div>
      )}
    </div>
  );
}
