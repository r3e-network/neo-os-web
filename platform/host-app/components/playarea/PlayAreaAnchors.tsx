import React from "react";

import {
  ActivityPanel,
  ChainStateStrip,
  EmbeddedDappSurface,
  PlayShell,
  buildEmbeddedDappUrl,
} from "./PlayAreaShared";
import type { PlayAreaRegistryProps } from "./PlayAreaShared";

export function ProfitAnchorPlayArea(props: PlayAreaRegistryProps) {
  return <AnchorPlayArea {...props} mode="profit" />;
}

export function TrustAnchorPlayArea(props: PlayAreaRegistryProps) {
  return <AnchorPlayArea {...props} mode="trust" />;
}

export function ProfitAnchorAdminPlayArea(props: PlayAreaRegistryProps) {
  return <AnchorAdminPlayArea {...props} mode="profit" />;
}

export function TrustAnchorAdminPlayArea(props: PlayAreaRegistryProps) {
  return <AnchorAdminPlayArea {...props} mode="trust" />;
}

export function CustomAnchorPlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    activity,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
  } = props;
  const dappUrl = buildEmbeddedDappUrl(app, network, launchContext);

  return (
    <PlayShell
      app={app}
      title="Custom Anchor"
      subtitle="Create your own 21-agent NEO voting anchor. Users only need the Anchor App ID to stake, redeem, and claim."
      tone="emerald"
      side={<ActivityPanel activity={activity} />}
      footer={
        <ChainStateStrip
          loading={loading}
          error={error}
          contractHash={contractHash}
          network={network}
          onRefresh={onRefresh}
        />
      }
    >
      <EmbeddedDappSurface
        title="Custom Anchor"
        subtitle="Custom Anchor dApp"
        url={dappUrl}
        tone="emerald"
        frameTitle={`${app.name} dApp`}
        testId={`native-dapp-frame-${app.app_id}`}
      />
    </PlayShell>
  );
}

function AnchorPlayArea(
  props: PlayAreaRegistryProps & { mode: "profit" | "trust" },
) {
  const {
    app,
    activity,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
    mode,
  } = props;
  const isProfit = mode === "profit";
  const dappUrl = buildEmbeddedDappUrl(app, network, launchContext);

  return (
    <PlayShell
      app={app}
      title={isProfit ? "ProfitAnchor" : "TrustAnchor"}
      subtitle={
        isProfit
          ? "Stake NEO, redeem your stake, and claim GAS rewards. Operator routing is handled separately in ProfitAnchor Admin."
          : "Stake NEO, redeem your stake, and claim GAS rewards. Operator routing is handled separately in TrustAnchor Admin."
      }
      tone={isProfit ? "emerald" : "slate"}
      side={<ActivityPanel activity={activity} />}
      footer={
        <ChainStateStrip
          loading={loading}
          error={error}
          contractHash={contractHash}
          network={network}
          onRefresh={onRefresh}
        />
      }
    >
      <EmbeddedDappSurface
        title={isProfit ? "ProfitAnchor" : "TrustAnchor"}
        subtitle="Anchor dApp"
        url={dappUrl}
        tone={isProfit ? "emerald" : "slate"}
        frameTitle={`${app.name} dApp`}
        testId={`native-dapp-frame-${app.app_id}`}
      />
    </PlayShell>
  );
}

function AnchorAdminPlayArea(
  props: PlayAreaRegistryProps & { mode: "profit" | "trust" },
) {
  const {
    app,
    activity,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
    mode,
  } = props;
  const isProfit = mode === "profit";
  const dappUrl = buildEmbeddedDappUrl(app, network, launchContext);

  return (
    <PlayShell
      app={app}
      title={isProfit ? "ProfitAnchor Admin" : "TrustAnchor Admin"}
      subtitle="Admin-only manual routing: move NEO between the 21 AA agents, update vote target, then sync vote."
      tone={isProfit ? "emerald" : "slate"}
      side={<ActivityPanel activity={activity} />}
      footer={
        <ChainStateStrip
          loading={loading}
          error={error}
          contractHash={contractHash}
          network={network}
          onRefresh={onRefresh}
        />
      }
    >
      <EmbeddedDappSurface
        title={isProfit ? "ProfitAnchor Admin" : "TrustAnchor Admin"}
        subtitle="Anchor Admin dApp"
        url={dappUrl}
        tone={isProfit ? "emerald" : "slate"}
        frameTitle={`${app.name} dApp`}
        testId={`native-dapp-frame-${app.app_id}`}
      />
    </PlayShell>
  );
}
