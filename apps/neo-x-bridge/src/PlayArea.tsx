/**
 * PlayArea.tsx — React version of the Neo X Bridge PlayArea.
 */

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

  const selectedNetwork = str("selectedNetwork", "mainnet");
  const chainId = str("chainId");

  return (
    <div className="bridge-play-area">
      <NetworkToggle
        t={t}
        selectedNetwork={selectedNetwork}
        onSelect={(key) => dispatch("selectNetwork", key)}
      />

      <NetworkInfoCard
        t={t}
        networkName={selectedNetwork}
        chainId={chainId}
      />

      <BridgeNotesCard t={t} />

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
