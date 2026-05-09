import type { PlayAreaProps } from "@shared/react/defineMiniApp";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import "./PlayArea.scss";

function truncate(value: string): string {
  if (value.length <= 34) return value;
  return `${value.slice(0, 18)}...${value.slice(-10)}`;
}

export default function PlayArea({ t, state, status }: PlayAreaProps) {
  const { str, num, bool } = useStateBindings(state);
  const anchorAppId = str("anchorAppId");
  const isLoading = bool("isLoading");
  const agentCount = num("agentCount");

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

      <details className="custom-anchor-model">
        <summary>{t("routingDetails")}</summary>
        <div className="custom-anchor-model__body">
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
      </details>

      {(isLoading || status?.msg) && (
        <div className="custom-anchor-footnote">
          {isLoading && <span>Loading on-chain anchor state...</span>}
          {status?.msg && <span>{status.msg}</span>}
        </div>
      )}
    </div>
  );
}
