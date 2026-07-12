import { History, PackageCheck, SearchCheck, WalletCards } from "lucide-react";
import { FactoryPlayArea } from "@shared/factory/FactoryPlayArea";
import type { FactoryDeploymentItem } from "@shared/factory/factoryChain";
import type {
  FactoryNetwork,
  FactoryPlan,
  Nep17Draft,
} from "@shared/factory/factoryPlan";
import type { PlayAreaProps } from "@shared/react/defineMiniApp";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { AssetRecoveryState } from "./setup";
import "./AssetFactoryPlayArea.scss";

const APP_ID = "miniapp-asset-factory";
const SUPPORTED_NETWORKS: readonly FactoryNetwork[] = ["neo-n3-testnet"];

function shortHash(value: string): string {
  if (value.length <= 18) return value;
  return `${value.slice(0, 9)}…${value.slice(-7)}`;
}

export default function AssetFactoryPlayArea(props: PlayAreaProps) {
  const { t, state, dispatch } = props;
  const { val, str, bool } = useStateBindings(state);
  const plan = val<FactoryPlan>("currentPlan") ?? null;
  const recoveryState = str("recoveryState", "idle") as AssetRecoveryState;
  const recovered = val<FactoryDeploymentItem>("recoveredDeployment") ?? null;
  const walletAddress = str("walletAddress");
  const deploymentWritesEnabled = bool("deploymentWritesEnabled");
  const restoredDraft = val<Nep17Draft>("restoredDraft") ?? null;
  const journalReady = bool("journalReady");
  const journalRestored = bool("journalRestored");
  const checking = recoveryState === "checking";

  return (
    <div className="asset-factory-surface">
      <section
        className="asset-factory-safety"
        aria-label={t("deploymentSafetyTitle")}
      >
        <span className="asset-factory-safety__icon" aria-hidden="true">
          <PackageCheck size={20} />
        </span>
        <div className="asset-factory-safety__copy">
          <strong>{t("deploymentSafetyTitle")}</strong>
          <p>{t("deploymentSafetyBody")}</p>
        </div>
        <div className="asset-factory-safety__state">
          <span data-ready={deploymentWritesEnabled ? "true" : undefined}>
            {deploymentWritesEnabled ? t("deploymentLive") : t("blueprintMode")}
          </span>
          <small>
            <WalletCards size={13} aria-hidden="true" />
            {walletAddress
              ? t("walletConnectedShort")
              : t("walletOptionalShort")}
          </small>
          <small data-journal={journalReady ? "ready" : "unavailable"}>
            <History size={13} aria-hidden="true" />
            {journalReady
              ? journalRestored
                ? t("journalRestoredShort")
                : t("journalReadyShort")
              : t("journalUnavailableShort")}
          </small>
        </div>
        {plan ? (
          <button
            type="button"
            className="asset-factory-safety__recover"
            disabled={checking}
            onClick={() => void dispatch("recoverCurrentPlan")}
          >
            <SearchCheck size={16} aria-hidden="true" />
            {checking ? t("checkingRecord") : t("checkRecord")}
          </button>
        ) : null}
      </section>

      {plan && recoveryState !== "idle" && recoveryState !== "checking" ? (
        <section
          className="asset-factory-recovery"
          data-state={recoveryState}
          aria-live="polite"
        >
          <div>
            <strong>{t(`recoveryTitle_${recoveryState}`)}</strong>
            <p>{t(`recovery_${recoveryState}`)}</p>
          </div>
          {recovered ? (
            <dl>
              <div>
                <dt>{t("packageId")}</dt>
                <dd>{recovered.packageId}</dd>
              </div>
              <div>
                <dt>{t("deployedContractLabel")}</dt>
                <dd>
                  {recovered.deployedHash
                    ? shortHash(recovered.deployedHash)
                    : t("recordOnly")}
                </dd>
              </div>
            </dl>
          ) : null}
        </section>
      ) : null}

      <FactoryPlayArea
        {...props}
        fixedKind="nep17"
        appId={APP_ID}
        initialNep17Draft={restoredDraft}
        supportedNetworks={SUPPORTED_NETWORKS}
        persistDraftAction="persistAssetDraft"
        showExecuteAction={false}
      />
    </div>
  );
}
