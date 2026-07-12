import React from "react";

import {
  ActivityPanel,
  ChainStateStrip,
  EmbeddedDappSurface,
  MetricGrid,
  PlayShell,
  buildEmbeddedDappUrl,
  getMetric,
} from "./PlayAreaShared";
import type { PlayAreaRegistryProps } from "./PlayAreaShared";

export function LastSurvivorPlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    statsMap,
    activity,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
  } = props;
  const dappUrl = buildEmbeddedDappUrl(app, network, launchContext);
  const status = getMetric(statsMap, "Status", "Ready");
  const countdown = getMetric(statsMap, "Countdown", "--:--:--");
  const needsRollover =
    /rollover|pending|settlement|restart/i.test(status) ||
    /rollover/i.test(countdown);
  const legacyMainnetDeployment =
    app.app_id === "miniapp-last-survivor" && network === "mainnet";

  return (
    <PlayShell
      app={app}
      title="Countdown auction arena"
      subtitle="Buy keys, extend the timer, and become the current leader before the round settles on-chain."
      tone="rose"
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
      <div>
        {needsRollover && (
          <div
            className="border-b border-amber-200 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-900"
            data-testid="last-survivor-rollover-banner"
          >
            <div className="flex items-center gap-2 font-semibold">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
              Next round is ready to start
            </div>
            {/* The explanation must be visible (touch users never see a
                title tooltip), so it renders as secondary text in the banner. */}
            <p className="m-0 mt-0.5 pl-3.5 font-medium leading-4 text-amber-800">
              {legacyMainnetDeployment
                ? "This legacy mainnet deployment needs a one-time contract update or admin restart before the next countdown can begin."
                : "The lifecycle keeper settles expired rounds automatically — new key purchases also roll the game forward before applying the bid."}
            </p>
            {legacyMainnetDeployment && (
              <details className="mt-0.5 pl-3.5">
                <summary className="cursor-pointer list-none font-semibold underline decoration-amber-400 underline-offset-2">
                  More about the legacy deployment
                </summary>
                <p className="m-0 mt-0.5 font-medium leading-4 text-amber-800">
                  The updated PlatformGame rolls future expirations into the
                  next live countdown automatically once the contract update
                  lands.
                </p>
              </details>
            )}
          </div>
        )}
        <EmbeddedDappSurface
          title="LastSurvivor"
          subtitle="LastSurvivor dApp"
          url={dappUrl}
          tone="rose"
          frameTitle={`${app.name} dApp`}
          testId={`native-dapp-frame-${app.app_id}`}
          heightClass="h-[2100px] sm:h-[1800px] lg:h-[1640px]"
        />
      </div>
    </PlayShell>
  );
}

export function FogPlayPlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    stats,
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
      title="Coin flip table"
      subtitle="Choose heads or tails, size the bet, and submit when the payout preview looks right."
      tone="violet"
      side={<MetricGrid stats={stats} />}
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
        title="FogPlay"
        subtitle="FogPlay dApp"
        url={dappUrl}
        tone="violet"
        frameTitle={`${app.name} dApp`}
        testId={`native-dapp-frame-${app.app_id}`}
      />
    </PlayShell>
  );
}

export function DiceGamePlayArea(props: PlayAreaRegistryProps) {
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
      title="Dice roll table"
      subtitle="Pick one face, fund the wager, and let Morpheus VRF resolve the roll on-chain."
      tone="violet"
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
        title="Dice Game"
        subtitle="Dice Game dApp"
        url={dappUrl}
        tone="violet"
        frameTitle={`${app.name} dApp`}
        testId={`native-dapp-frame-${app.app_id}`}
      />
    </PlayShell>
  );
}

export function GasBoxPlayArea(props: PlayAreaRegistryProps) {
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
      title="GASBox gacha machine"
      subtitle="Pick a machine, inspect its capsule pool, and prepare a draw before sending the on-chain play operation."
      tone="amber"
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
        title="GASBox"
        subtitle="GASBox dApp"
        url={dappUrl}
        tone="amber"
        frameTitle={`${app.name} dApp`}
        testId={`native-dapp-frame-${app.app_id}`}
      />
    </PlayShell>
  );
}

export function RedEnvelopePlayArea(props: PlayAreaRegistryProps) {
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
      title="Open red envelope"
      subtitle="Recipients should see one clear job first: open the shared envelope and claim once. Sending and active lists stay secondary."
      tone="rose"
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
        title="Red Envelope"
        subtitle="Red Envelope dApp"
        url={dappUrl}
        tone="rose"
        frameTitle={`${app.name} dApp`}
        testId={`native-dapp-frame-${app.app_id}`}
      />
    </PlayShell>
  );
}

export function GasLuckyPoolPlayArea(props: PlayAreaRegistryProps) {
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
  const gameFiPublished = app.permissions.payments === true
    || app.permissions.randomness === true;

  return (
    <PlayShell
      app={app}
      title="OneGate Vault"
      subtitle={gameFiPublished
        ? "Scan with OneGate, claim once, and receive a random GAS reward directly in your wallet."
        : "Choose a prize tier, open the animated vault, and chase a better local score — free, with no wallet or GAS."}
      tone="emerald"
      side={gameFiPublished ? <ActivityPanel activity={activity} /> : undefined}
      footer={gameFiPublished ? (
        <ChainStateStrip
          loading={loading}
          error={error}
          contractHash={contractHash}
          network={network}
          onRefresh={onRefresh}
        />
      ) : undefined}
    >
      <EmbeddedDappSurface
        title="OneGate Vault"
        subtitle={gameFiPublished ? "OneGate Vault dApp" : "Free local Phaser lucky draw"}
        url={dappUrl}
        tone="emerald"
        frameTitle={`${app.name} dApp`}
        testId={`native-dapp-frame-${app.app_id}`}
      />
    </PlayShell>
  );
}

export function DailyCheckinPlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    stats,
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
      title="Daily streak board"
      subtitle="One daily check-in keeps the streak alive. The seventh day unlocks the bigger reward."
      tone="emerald"
      side={<MetricGrid stats={stats} />}
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
        title="Daily Check-in"
        subtitle="Daily Check-in dApp"
        url={dappUrl}
        tone="emerald"
        frameTitle={`${app.name} dApp`}
        testId={`native-dapp-frame-${app.app_id}`}
      />
    </PlayShell>
  );
}

export function SelfLoanPlayArea(props: PlayAreaRegistryProps) {
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
      title="Self-repaying loan panel"
      subtitle="Lock NEO, draw GAS, and route future yield toward repayment without liquidation."
      tone="sky"
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
        title="SelfLoan"
        subtitle="SelfLoan dApp"
        url={dappUrl}
        tone="sky"
        frameTitle={`${app.name} dApp`}
        testId={`native-dapp-frame-${app.app_id}`}
      />
    </PlayShell>
  );
}
