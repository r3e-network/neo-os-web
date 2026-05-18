import React from "react";
import {
  Boxes,
  CalendarCheck,
  CheckCircle2,
  Dice5,
  Gift,
  Landmark,
  Timer,
} from "lucide-react";

import {
  ActionBoard,
  ActivityPanel,
  ChainStateStrip,
  MetricGrid,
  PlayShell,
  PreviewStat,
  SecondaryInfo,
  clampNumber,
  formatGas,
  getMetric,
  parseGas,
  parseNumericMetric,
  useLaunchChoiceState,
  useLaunchParamState,
} from "./PlayAreaShared";
import type { PlayAreaRegistryProps } from "./PlayAreaShared";

export function LastSurvivorPlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    statsMap,
    stats,
    activity,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
  } = props;
  const [keys] = useLaunchParamState(launchContext, ["keys", "keyCount"], "3");
  const keyPrice =
    parseGas(getMetric(statsMap, "Key Price", "0.01 GAS")) || 0.01;
  const projected = Math.max(1, Number(keys) || 1) * keyPrice;
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
      <div className="space-y-3">
        {needsRollover && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="m-0 text-sm font-bold text-amber-900">
              Next round is ready to start
            </p>
            <p className="m-0 mt-1 text-xs leading-5 text-amber-800">
              {legacyMainnetDeployment
                ? "This legacy mainnet deployment needs a one-time contract update or admin restart. The updated PlatformGame rolls future expirations into the next live countdown automatically."
                : "The lifecycle keeper settles expired rounds automatically. New key purchases also roll the game forward before applying the bid."}
            </p>
          </div>
        )}
        <div className="grid gap-3">
          <ActionBoard
            title="Live round market"
            subtitle="Timer, pool, and key price stay visible so the user understands the round before buying."
            tone="rose"
            rows={[
              {
                label: "Countdown",
                detail: status,
                value: countdown,
                valueLabel: "time left",
                active: true,
                icon: <Timer className="h-4 w-4" />,
              },
              {
                label: "Prize pool",
                detail: "Winner receives the current round pool",
                value: getMetric(statsMap, "Prize Pool", "0 GAS"),
                valueLabel: "pool",
              },
              {
                label: "Key price",
                detail: "Each purchase extends the active timer",
                value: formatGas(keyPrice),
                valueLabel: "per key",
              },
              {
                label: "Pending buy",
                detail: `${keys || "1"} keys selected for the next buy`,
                value: formatGas(projected),
                valueLabel: "preview",
              },
            ]}
          />
        </div>
        <div className="space-y-3">
          <MetricGrid stats={stats} />
        </div>
      </div>
    </PlayShell>
  );
}

export function FogPlayPlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    statsMap,
    stats,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
  } = props;
  const [side] = useLaunchChoiceState(
    launchContext,
    ["side", "choice"],
    ["heads", "tails"] as const,
    "heads",
  );
  const [amount] = useLaunchParamState(
    launchContext,
    ["amount", "stake", "bet"],
    "0.10",
  );
  const payout = (Number(amount) || 0) * 2;

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
      <div className="grid gap-3">
        <ActionBoard
          title="Flip market"
          subtitle="Pick one outcome and see the exact payout preview before signing."
          tone="violet"
          rows={(["heads", "tails"] as const).map((option) => ({
            label: option === "heads" ? "Heads" : "Tails",
            detail:
              option === "heads"
                ? "Oracle result equals heads"
                : "Oracle result equals tails",
            value: "2.00x",
            valueLabel: "payout",
            active: side === option,
            icon: <Dice5 className="h-4 w-4" />,
          }))}
        />
        <div className="grid gap-2 sm:grid-cols-3">
          <PreviewStat label="Outcome" value={side} />
          <PreviewStat label="Potential payout" value={formatGas(payout)} />
          <PreviewStat
            label="Limits"
            value={`${getMetric(statsMap, "Min Bet", "--")} - ${getMetric(statsMap, "Max Bet", "--")}`}
          />
        </div>
      </div>
    </PlayShell>
  );
}

export function DiceGamePlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    statsMap,
    stats,
    activity,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
  } = props;
  const [chosenRaw] = useLaunchParamState(
    launchContext,
    ["chosenNumber", "face", "number"],
    "6",
  );
  const [amountRaw] = useLaunchParamState(
    launchContext,
    ["amount", "stake", "bet"],
    "0.10",
  );
  const chosen = clampNumber(Math.floor(Number(chosenRaw) || 6), 1, 6);
  const amount = Number(amountRaw) || 0;
  const payout = amount * 6 * 0.95;

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
      <div className="space-y-3">
        <ActionBoard
          title="Choose one face"
          subtitle="A matching VRF roll pays 5.70x after the 5% platform fee. Losing stakes stay in the liquidity pool."
          tone="violet"
          rows={Array.from({ length: 6 }, (_, index) => {
            const face = index + 1;
            return {
              label: `Face ${face}`,
              detail:
                face === chosen
                  ? "Selected for the next roll"
                  : "Available outcome",
              value: face === chosen ? "selected" : "5.70x",
              valueLabel: face === chosen ? "choice" : "net payout",
              active: face === chosen,
              icon: <Dice5 className="h-4 w-4" />,
            };
          })}
        />
        <div className="grid gap-2 sm:grid-cols-3">
          <PreviewStat label="Selected face" value={String(chosen)} />
          <PreviewStat label="Stake" value={formatGas(amount)} />
          <PreviewStat label="Win payout" value={formatGas(payout)} />
        </div>
        <SecondaryInfo
          title="Risk and settlement"
          description="Live limits and recent dice events stay secondary so the primary screen remains focused on the next roll."
          meta="VRF"
        >
          <div className="space-y-3">
            <MetricGrid stats={stats} />
            <ActivityPanel activity={activity} />
          </div>
        </SecondaryInfo>
      </div>
    </PlayShell>
  );
}

export function GasBoxPlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    statsMap,
    stats,
    activity,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
  } = props;
  const [selectedRaw] = useLaunchParamState(
    launchContext,
    ["machine", "machineId", "box"],
    "1",
  );
  const selected = Math.max(1, Number(selectedRaw) || 1);
  const machines = Math.max(
    1,
    Number(getMetric(statsMap, "Total Machines", "3")) || 3,
  );

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
      <div className="space-y-3">
        <div className="grid gap-3">
          <ActionBoard
            title="Machine selector"
            subtitle="Each machine is a separate prize pool. Pick the active machine before staging a draw."
            tone="amber"
            rows={Array.from({ length: Math.min(machines, 6) }, (_, index) => {
              const machine = index + 1;
              return {
                label: `Machine #${machine}`,
                detail:
                  machine === selected
                    ? "Selected for next draw"
                    : "Available draw pool",
                value: machine === selected ? "selected" : "ready",
                valueLabel: "state",
                active: selected === machine,
                icon: <Boxes className="h-4 w-4" />,
              };
            })}
          />
          <div className="grid gap-2 sm:grid-cols-3">
            <PreviewStat label="Selected machine" value={`#${selected}`} />
            <PreviewStat label="Machines online" value={String(machines)} />
            <PreviewStat label="Draw asset" value="GAS" />
          </div>
        </div>
        <div className="space-y-3">
          <MetricGrid stats={stats} />
        </div>
      </div>
    </PlayShell>
  );
}

export function RedEnvelopePlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    stats,
    activity,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
  } = props;
  const [envelopeId] = useLaunchParamState(
    launchContext,
    ["envelopeId", "id", "packet"],
    "",
  );
  const hasEnvelopeId = Boolean(envelopeId.trim());
  const activeRows = activity?.rows ?? [];

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
      <div className="space-y-3">
        <section
          className={`rounded-[18px] border p-3.5 shadow-sm shadow-gray-950/5 sm:rounded-[22px] sm:p-4 ${hasEnvelopeId ? "border-rose-200 bg-rose-50" : "border-gray-200 bg-white"}`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div
                className={`mb-2 grid h-10 w-10 place-items-center rounded-xl sm:mb-3 sm:h-11 sm:w-11 sm:rounded-2xl ${hasEnvelopeId ? "bg-rose-600 text-white" : "bg-gray-100 text-gray-600"}`}
              >
                <Gift className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="m-0 text-lg font-black tracking-tight text-gray-950 sm:text-xl">
                {hasEnvelopeId ? "Envelope ready" : "Open a shared envelope"}
              </h3>
              <p className="m-0 mt-1 max-w-2xl text-xs font-semibold leading-5 text-gray-600 sm:mt-1.5 sm:text-sm">
                {hasEnvelopeId
                  ? "The shared envelope ID is loaded. Confirm once and the wallet signs the claim."
                  : "Use a shared link, QR code, or enter an envelope ID to claim."}
              </p>
            </div>
            <div className="rounded-xl border border-white/70 bg-white/90 px-3 py-2 text-left sm:min-w-36 sm:rounded-2xl sm:px-4 sm:py-2.5 sm:text-right">
              <p className="m-0 text-[11px] font-black uppercase tracking-wide text-gray-500">
                Envelope ID
              </p>
              <p className="m-0 mt-0.5 text-lg font-black text-gray-950 sm:text-xl">
                {hasEnvelopeId ? envelopeId : "not loaded"}
              </p>
            </div>
          </div>
        </section>

        <SecondaryInfo
          title="Active envelopes"
          description="Optional list for browsing live envelopes. Claim stays the primary task."
          meta={`${activeRows.length} items`}
        >
          {activeRows.length > 0 ? (
            <div className="space-y-2">
              {activeRows.slice(0, 6).map((row, index) => (
                <div
                  key={`${row.primary}:${index}`}
                  className="rounded-2xl border border-gray-200 bg-white px-3 py-2"
                >
                  <p className="m-0 text-sm font-black text-gray-950">
                    {row.primary}
                  </p>
                  {row.secondary && (
                    <p className="m-0 mt-0.5 text-xs font-semibold text-gray-500">
                      {row.secondary}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="m-0 text-sm leading-6 text-gray-500">
              No active envelopes returned by the live data source.
            </p>
          )}
        </SecondaryInfo>
      </div>
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
  const [claimKey] = useLaunchParamState(
    launchContext,
    ["claimKey", "key", "code", "k"],
    "",
  );
  const [minClaim] = useLaunchParamState(
    launchContext,
    ["minClaim", "min"],
    "1",
  );
  const [maxClaim] = useLaunchParamState(
    launchContext,
    ["maxClaim", "max"],
    "50",
  );
  const hasClaimKey = Boolean(claimKey.trim());

  return (
    <PlayShell
      app={app}
      title="OneGate Vault"
      subtitle="Scan with OneGate, claim once, and receive a random GAS reward directly in your wallet."
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
      <div className="space-y-3">
        <section
          className={`rounded-[18px] border p-3.5 shadow-sm shadow-gray-950/5 sm:rounded-[20px] sm:p-4 ${
            hasClaimKey
              ? "border-emerald-200 bg-emerald-50"
              : "border-amber-200 bg-amber-50"
          }`}
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div
                className={`mb-2 grid h-10 w-10 place-items-center rounded-xl ${
                  hasClaimKey
                    ? "bg-emerald-600 text-white"
                    : "bg-amber-500 text-white"
                }`}
              >
                <Gift className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="m-0 text-lg font-black tracking-tight text-gray-950 sm:text-xl">
                {hasClaimKey ? "Reward ready" : "Scan to claim"}
              </h3>
              <p className="m-0 mt-1 max-w-xl text-xs font-semibold leading-5 text-gray-600 sm:mt-1.5 sm:text-sm">
                {hasClaimKey
                  ? "Your OneGate scan is verified. Claim once to receive GAS in your wallet."
                  : "Open this reward from a OneGate QR code to load your claim automatically."}
              </p>
            </div>
            <div className="w-fit rounded-xl border border-white/80 bg-white/80 px-3 py-2 text-left sm:min-w-36 sm:rounded-2xl sm:px-4 sm:py-2.5 sm:text-right">
              <p className="m-0 text-[11px] font-black uppercase tracking-wide text-gray-500">
                Reward range
              </p>
              <p className="m-0 mt-0.5 text-lg font-black text-gray-950 sm:text-xl">
                {minClaim || "1"}-{maxClaim || "50"} GAS
              </p>
            </div>
          </div>
        </section>
      </div>
    </PlayShell>
  );
}

export function DailyCheckinPlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    statsMap,
    stats,
    loading,
    error,
    contractHash,
    network,
    onRefresh,
  } = props;
  const claimed = clampNumber(
    parseNumericMetric(
      getMetric(statsMap, "Current Streak", getMetric(statsMap, "Streak", "0")),
    ),
    0,
    7,
  );
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
      <div className="space-y-3">
        <div className="grid gap-3">
          <section className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h3 className="m-0 text-sm font-black text-gray-950">
                  Weekly streak
                </h3>
                <p className="m-0 mt-1 text-xs leading-5 text-gray-500">
                  The streak path stays visible so the next claim feels
                  immediate and understandable.
                </p>
              </div>
              <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </div>
            <div className="grid grid-cols-7 gap-2">
              {days.map((day, index) => {
                const active = index < claimed;
                const today = index + 1 === claimed;
                return (
                  <div
                    key={day}
                    className={`min-h-20 rounded-lg border px-2 py-3 text-center ${
                      active
                        ? "border-emerald-500 bg-emerald-50 text-emerald-950"
                        : "border-gray-200 bg-white text-gray-500"
                    }`}
                  >
                    <CalendarCheck
                      className={`mx-auto mb-2 h-5 w-5 ${active ? "text-emerald-600" : "text-gray-500"}`}
                    />
                    <span className="block text-xs font-black">{day}</span>
                    {today && (
                      <span className="mt-1 block text-[10px] font-black uppercase text-emerald-600">
                        today
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
          <div className="grid gap-2 sm:grid-cols-3">
            <PreviewStat label="Current streak" value={`${claimed} days`} />
            <PreviewStat
              label="7-day reward"
              value={getMetric(statsMap, "7-Day Reward", "--")}
            />
            <PreviewStat
              label="Total rewarded"
              value={getMetric(statsMap, "Total Rewarded", "0 GAS")}
            />
          </div>
        </div>
        <ActionBoard
          title="Streak state"
          subtitle="The app keeps the user focused on the next claim and the weekly completion target."
          tone="emerald"
          rows={[
            {
              label: "Today",
              detail:
                claimed >= 1
                  ? "Eligible for today's daily claim"
                  : "Connect wallet to start",
              value: claimed >= 1 ? "eligible" : "not started",
              valueLabel: "state",
              active: true,
              icon: <CheckCircle2 className="h-4 w-4" />,
            },
            {
              label: "Weekly progress",
              detail: "Seven consecutive claims unlock the bonus",
              value: `${claimed}/7`,
              valueLabel: "days",
            },
            {
              label: "Reset risk",
              detail: "Missing a day restarts the streak",
              value: claimed >= 7 ? "complete" : `${7 - claimed} left`,
              valueLabel: "target",
            },
          ]}
        />
      </div>
    </PlayShell>
  );
}

export function SelfLoanPlayArea(props: PlayAreaRegistryProps) {
  const {
    app,
    statsMap,
    stats,
    activity,
    loading,
    error,
    contractHash,
    network,
    launchContext,
    onRefresh,
  } = props;
  const [collateral] = useLaunchParamState(
    launchContext,
    ["collateral", "neo"],
    "20",
  );
  const ltv = 0.35;
  const borrowable = (Number(collateral) || 0) * ltv;

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
      <div className="space-y-3">
        <div className="grid gap-3">
          <ActionBoard
            title="Loan position"
            subtitle="Collateral, borrow capacity, and repayment state are visible before opening a position."
            tone="sky"
            rows={[
              {
                label: "NEO collateral",
                detail: "Locked collateral amount",
                value: `${collateral || "0"} NEO`,
                valueLabel: "input",
                active: true,
                icon: <Landmark className="h-4 w-4" />,
              },
              {
                label: "Borrowable GAS",
                detail: "Conservative LTV preview",
                value: formatGas(borrowable),
                valueLabel: "35% ltv",
              },
              {
                label: "Outstanding debt",
                detail: "Current contract read",
                value: getMetric(statsMap, "Outstanding Debt", "0 GAS"),
                valueLabel: "debt",
              },
              {
                label: "Locked collateral",
                detail: "Total collateral in the app",
                value: getMetric(statsMap, "Collateral Locked", "0 NEO"),
                valueLabel: "locked",
              },
            ]}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          <PreviewStat label="Borrowable GAS" value={formatGas(borrowable)} />
          <PreviewStat label="LTV preview" value="35%" />
          <PreviewStat
            label="Locked collateral"
            value={getMetric(statsMap, "Collateral Locked", "0 NEO")}
          />
          <PreviewStat
            label="Outstanding debt"
            value={getMetric(statsMap, "Outstanding Debt", "0 GAS")}
          />
        </div>
      </div>
    </PlayShell>
  );
}
