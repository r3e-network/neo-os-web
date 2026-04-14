/**
 * PlayArea.tsx -- Neo X Bridge
 *
 * Uses all state: selectedKey, selectedNetwork, supportedRoute,
 * supportedAsset, chainId.
 * Actions: selectNetwork, openBridge, addWallet, openExplorer, openDocs.
 */

import { NeoCard } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import NetworkToggle from "./components/NetworkToggle";
import NetworkInfoCard from "./components/NetworkInfoCard";
import BridgeNotesCard from "./components/BridgeNotesCard";
import BridgeActions from "./components/BridgeActions";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str } = useStateBindings(state);

  const selectedKey = str("selectedKey", "mainnet");
  const selectedNetwork = str("selectedNetwork", "Neo X MainNet");
  const supportedRoute = str("supportedRoute", "Neo N3 <-> Neo X");
  const supportedAsset = str("supportedAsset", "GAS");
  const chainId = str("chainId", "");

  return (
    <div className="bridge-play-area">
      {/* Network selector */}
      <NetworkToggle
        t={t}
        selectedNetwork={selectedKey}
        onSelect={(key) => dispatch("selectNetwork", key)}
      />

      {/* Network details */}
      <NetworkInfoCard
        t={t}
        networkName={selectedNetwork}
        chainId={chainId}
      />

      {/* Route and asset info */}
      <NeoCard variant="erobo" className="bridge-info-card">
        <div className="bridge-info-grid">
          <div className="bridge-info-row">
            <span className="bridge-info-label">{t("supportedRoute") || "Route"}</span>
            <span className="bridge-info-value">{supportedRoute}</span>
          </div>
          <div className="bridge-info-row">
            <span className="bridge-info-label">{t("supportedAsset") || "Current Asset"}</span>
            <span className="bridge-info-value">{supportedAsset}</span>
          </div>
          <div className="bridge-info-row">
            <span className="bridge-info-label">{t("bridgeMode") || "Integration Mode"}</span>
            <span className="bridge-info-value">{t("bridgeModeValue") || "Official bridge launcher"}</span>
          </div>
        </div>
      </NeoCard>

      {/* Notes */}
      <BridgeNotesCard t={t} />

      {/* Action buttons */}
      <BridgeActions
        t={t}
        onOpenBridge={() => dispatch("openBridge")}
        onAddWallet={() => dispatch("addWallet")}
        onOpenExplorer={() => dispatch("openExplorer")}
        onOpenDocs={() => dispatch("openDocs")}
      />
    </div>
  );
}
