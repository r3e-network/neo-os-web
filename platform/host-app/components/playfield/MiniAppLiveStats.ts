import type { MiniAppLaunchContext } from "../types";
import {
  decodeMap,
  fmtCountdown,
  fmtGas,
  invokeRead,
  isCouncilProposalActive,
  LAST_SURVIVOR_APP_ID,
  LAST_SURVIVOR_ROLLOVER_LABEL,
  resolveAnchorAppId,
  stackBool,
  stackInt,
} from "./MiniAppLiveDataShared";

/* ── Per-app contract reads ──────────────────────────────────────────── */

export async function fetchAppStats(
  appId: string,
  rpcUrl: string,
  contractHash: string,
  network: "mainnet" | "testnet",
  launchContext?: MiniAppLaunchContext | null,
): Promise<Array<{ label: string; value: string; accent?: boolean }>> {
  try {
    switch (appId) {
      case "miniapp-last-survivor": {
        if (network === "testnet") {
          const [stateStack, pausedStack] = await Promise.all([
            invokeRead(
              rpcUrl,
              contractHash,
              "getCountdownStatus",
              [{ type: "String", value: LAST_SURVIVOR_APP_ID }],
              network,
            ),
            invokeRead(
              rpcUrl,
              contractHash,
              "isPaused",
              [{ type: "String", value: LAST_SURVIVOR_APP_ID }],
              network,
            ),
          ]);
          const state = decodeMap(stateStack);
          const round = parseInt(String(state.roundId ?? "0"), 10);
          const active = Boolean(state.active);
          const paused = stackBool(pausedStack);
          const pot = parseInt(String(state.pot ?? "0"), 10);
          const totalKeys = parseInt(String(state.totalKeys ?? "0"), 10);
          const endTime = parseInt(String(state.endTime ?? "0"), 10);
          const currentKeyPrice = parseInt(
            String(state.currentKeyPrice ?? "0"),
            10,
          );
          const totalPlayers = parseInt(String(state.totalPlayers ?? "0"), 10);
          const totalDistributed = parseInt(
            String(state.totalPotDistributed ?? "0"),
            10,
          );
          const expiredButOpen =
            active &&
            (String(state.status || "").toLowerCase() === "ending" ||
              (endTime > 0 && endTime < Date.now()));
          const remainingSec =
            active && !expiredButOpen && endTime > 0
              ? Math.max(0, Math.floor((endTime - Date.now()) / 1000))
              : 0;

          const status = paused
            ? "Paused"
            : !active
              ? "Next Round Pending"
              : expiredButOpen
                ? LAST_SURVIVOR_ROLLOVER_LABEL
                : "Open for Bids";

          return [
            {
              label: "Countdown",
              value:
                active && !expiredButOpen
                  ? fmtCountdown(remainingSec)
                  : LAST_SURVIVOR_ROLLOVER_LABEL,
              accent: active && !expiredButOpen,
            },
            {
              label: "Prize Pool",
              value: `${fmtGas(pot)} GAS`,
              accent: pot > 0,
            },
            { label: "Round", value: `#${round}` },
            { label: "Keys This Round", value: String(totalKeys) },
            { label: "Total Players", value: String(totalPlayers) },
            { label: "Key Price", value: `${fmtGas(currentKeyPrice)} GAS` },
            {
              label: "Total Distributed",
              value: `${fmtGas(totalDistributed)} GAS`,
              accent: true,
            },
            {
              label: "Status",
              value: status,
              accent: !paused && active && !expiredButOpen,
            },
          ];
        }

        const stateStack = await invokeRead(
          rpcUrl,
          contractHash,
          "getRoundStateForFrontend",
          [],
          network,
        );
        const state = decodeMap(stateStack);
        const round = parseInt(String(state.roundId ?? "0"), 10);
        const active = Boolean(state.active);
        const pot = parseInt(String(state.pot ?? "0"), 10);
        const totalKeys = parseInt(String(state.totalKeys ?? "0"), 10);
        const endTime = parseInt(String(state.endTime ?? "0"), 10);
        const remainingSec =
          active && endTime > 0
            ? Math.max(0, Math.floor((endTime - Date.now()) / 1000))
            : 0;
        const expiredButOpen = active && endTime > 0 && endTime < Date.now();

        const [keyPriceStack, totalPlayersStack, totalDistStack] =
          await Promise.all([
            invokeRead(rpcUrl, contractHash, "getCurrentKeyPrice", [], network),
            invokeRead(rpcUrl, contractHash, "totalPlayers", [], network),
            invokeRead(
              rpcUrl,
              contractHash,
              "totalPotDistributed",
              [],
              network,
            ),
          ]);

        const status = !active
          ? "Next Round Pending"
          : expiredButOpen
            ? LAST_SURVIVOR_ROLLOVER_LABEL
            : "Open for Bids";

        return [
          {
            label: "Countdown",
            value:
              active && !expiredButOpen
                ? fmtCountdown(remainingSec)
                : LAST_SURVIVOR_ROLLOVER_LABEL,
            accent: active && !expiredButOpen,
          },
          { label: "Prize Pool", value: `${fmtGas(pot)} GAS`, accent: pot > 0 },
          { label: "Round", value: `#${round}` },
          { label: "Keys This Round", value: String(totalKeys) },
          {
            label: "Total Players",
            value: String(stackInt(totalPlayersStack)),
          },
          {
            label: "Key Price",
            value: `${fmtGas(stackInt(keyPriceStack))} GAS`,
          },
          {
            label: "Total Distributed",
            value: `${fmtGas(stackInt(totalDistStack))} GAS`,
            accent: true,
          },
          { label: "Status", value: status, accent: active && !expiredButOpen },
        ];
      }

      case "miniapp-gasbox": {
        const [machinesStack, pausedStack] = await Promise.all([
          invokeRead(rpcUrl, contractHash, "totalMachines", [], network),
          invokeRead(rpcUrl, contractHash, "isPaused", [], network),
        ]);
        const machines = stackInt(machinesStack);
        const paused = stackBool(pausedStack);
        return [
          {
            label: "Total Machines",
            value: String(machines),
            accent: machines > 0,
          },
          {
            label: "Status",
            value: paused ? "Paused" : "Ready to Play",
            accent: !paused,
          },
          { label: "Asset", value: "GAS" },
          { label: "Randomness", value: "VRF" },
        ];
      }

      case "miniapp-redenvelope": {
        const pausedStack = await invokeRead(
          rpcUrl,
          contractHash,
          "isPaused",
          [],
          network,
        );
        return [
          {
            label: "Status",
            value: stackBool(pausedStack) ? "Paused" : "Active",
            accent: !stackBool(pausedStack),
          },
          { label: "Asset", value: "GAS" },
          { label: "Distribution", value: "Random (VRF)" },
          { label: "Mode", value: "Lucky packets" },
        ];
      }

      case "miniapp-gas-lucky-pool": {
        const pausedStack = await invokeRead(
          rpcUrl,
          contractHash,
          "isPaused",
          [],
          network,
        );
        return [
          {
            label: "Status",
            value: stackBool(pausedStack) ? "Paused" : "Active",
            accent: !stackBool(pausedStack),
          },
          { label: "Asset", value: "GAS" },
          { label: "Claim Range", value: "Configurable" },
          { label: "Mode", value: "OneGate QR claim" },
        ];
      }

      case "miniapp-dailycheckin": {
        const [statsStack, pausedStack] = await Promise.all([
          invokeRead(rpcUrl, contractHash, "getPlatformStats", [], network),
          invokeRead(rpcUrl, contractHash, "isPaused", [], network),
        ]);
        const m = decodeMap(statsStack);
        const totalUsers = parseInt(String(m.totalUsers ?? "0"), 10);
        const totalCheckins = parseInt(String(m.totalCheckins ?? "0"), 10);
        const totalRewarded = parseInt(String(m.totalRewarded ?? "0"), 10);
        const weekReward = parseInt(String(m.weekReward ?? "0"), 10);
        return [
          {
            label: "Total Users",
            value: String(totalUsers),
            accent: totalUsers > 0,
          },
          { label: "Total Check-ins", value: String(totalCheckins) },
          {
            label: "Total Rewarded",
            value: `${fmtGas(totalRewarded)} GAS`,
            accent: true,
          },
          {
            label: "Status",
            value: stackBool(pausedStack) ? "Paused" : "Active",
            accent: !stackBool(pausedStack),
          },
          { label: "7-Day Reward", value: `${fmtGas(weekReward)} GAS` },
          { label: "Cadence", value: "1 / UTC day" },
        ];
      }

      case "miniapp-fogplay": {
        const [limitsStack, pausedStack] = await Promise.all([
          invokeRead(rpcUrl, contractHash, "getBetLimits", [], network),
          invokeRead(rpcUrl, contractHash, "isPaused", [], network),
        ]);
        const limits = limitsStack as Array<{ type: string; value: unknown }>;
        // getBetLimits returns Struct of [minBet, maxBet]
        let minBet = 0;
        let maxBet = 0;
        if (limits[0]?.type === "Struct" || limits[0]?.type === "Array") {
          const arr = limits[0].value as Array<{ value: string }>;
          minBet = parseInt(arr[0]?.value || "0", 10);
          maxBet = parseInt(arr[1]?.value || "0", 10);
        }
        return [
          {
            label: "Status",
            value: stackBool(pausedStack) ? "Paused" : "Active",
            accent: !stackBool(pausedStack),
          },
          {
            label: "Min Bet",
            value: minBet > 0 ? `${fmtGas(minBet)} GAS` : "—",
          },
          {
            label: "Max Bet",
            value: maxBet > 0 ? `${fmtGas(maxBet)} GAS` : "—",
          },
          { label: "Payout", value: "2× on win", accent: true },
        ];
      }

      case "miniapp-self-loan": {
        const [statsStack, pausedStack] = await Promise.all([
          invokeRead(
            rpcUrl,
            contractHash,
            "getLendingStats",
            [{ type: "String", value: "miniapp-self-loan" }],
            network,
          ).then((stack) => {
            const stats = decodeMap(stack);
            return Object.keys(stats).length
              ? stack
              : invokeRead(
                  rpcUrl,
                  contractHash,
                  "getPlatformStats",
                  [],
                  network,
                );
          }),
          invokeRead(rpcUrl, contractHash, "isPaused", [], network),
        ]);
        const m = decodeMap(statsStack);
        const totalLoans = parseInt(String(m.totalLoans ?? "0"), 10);
        const totalCollateral = parseInt(String(m.totalCollateral ?? "0"), 10);
        const totalDebt = parseInt(String(m.totalDebt ?? "0"), 10);
        const totalRepaid = parseInt(String(m.totalRepaid ?? "0"), 10);
        const totalBorrowers = parseInt(String(m.totalBorrowers ?? "0"), 10);
        const ltvT1 = parseInt(String(m.ltvTier1Bps ?? "0"), 10);
        const ltvT3 = parseInt(String(m.ltvTier3Bps ?? "0"), 10);
        return [
          {
            label: "Total Loans",
            value: String(totalLoans),
            accent: totalLoans > 0,
          },
          { label: "Borrowers", value: String(totalBorrowers) },
          {
            label: "Collateral Locked",
            value: `${totalCollateral} NEO`,
            accent: totalCollateral > 0,
          },
          { label: "Outstanding Debt", value: `${fmtGas(totalDebt)} GAS` },
          {
            label: "Total Repaid",
            value: `${fmtGas(totalRepaid)} GAS`,
            accent: true,
          },
          {
            label: "LTV Range",
            value: ltvT1 && ltvT3 ? `${ltvT1 / 100}% – ${ltvT3 / 100}%` : "—",
          },
          { label: "Liquidation", value: "None — yield repays" },
          {
            label: "Status",
            value: stackBool(pausedStack) ? "Paused" : "Active",
            accent: !stackBool(pausedStack),
          },
        ];
      }

      case "miniapp-trustanchor":
      case "miniapp-profitanchor":
      case "miniapp-trustanchor-admin":
      case "miniapp-profitanchor-admin":
      case "miniapp-custom-anchor": {
        const anchorAppId = resolveAnchorAppId(appId, launchContext);
        if (!anchorAppId) {
          return [
            { label: "Agents", value: "21 on register", accent: true },
            { label: "Status", value: "Ready to register", accent: true },
            { label: "Runtime", value: "PlatformAnchor" },
          ];
        }
        const statsStack = await invokeRead(
          rpcUrl,
          contractHash,
          "getAnchorStats",
          [{ type: "String", value: anchorAppId }],
          network,
        );
        const m = decodeMap(statsStack);
        const totalStaked = parseInt(String(m.totalStaked ?? "0"), 10);
        const totalStakers = parseInt(String(m.totalStakers ?? "0"), 10);
        const rewardReserve = parseInt(String(m.rewardReserve ?? "0"), 10);
        const agentCount = parseInt(String(m.agentCount ?? "0"), 10);
        const selectedAgentId = parseInt(String(m.selectedAgentId ?? "0"), 10);
        const mode = parseInt(String(m.mode ?? "0"), 10);
        const paused = Boolean(m.paused);
        return [
          {
            label: "Total Staked",
            value: `${totalStaked} NEO`,
            accent: totalStaked > 0,
          },
          { label: "Stakers", value: String(totalStakers) },
          {
            label: "Agents",
            value: String(agentCount),
            accent: agentCount > 0,
          },
          {
            label: "Reward Reserve",
            value: `${fmtGas(rewardReserve)} GAS`,
            accent: rewardReserve > 0,
          },
          {
            label: "Selected Agent",
            value:
              selectedAgentId > 0
                ? `#${selectedAgentId}`
                : mode === 1
                  ? "Trust mode"
                  : mode === 2
                    ? "Profit mode"
                    : "Unregistered",
          },
          {
            label: "Status",
            value: paused ? "Paused" : "Ready",
            accent: !paused,
          },
        ];
      }

      case "miniapp-neo-pay": {
        const totalStreamsStack = await invokeRead(
          rpcUrl,
          contractHash,
          "totalStreams",
          [],
          network,
        );
        const totalStreams = stackInt(totalStreamsStack);
        return [
          {
            label: "Total Streams",
            value: String(totalStreams),
            accent: totalStreams > 0,
          },
          { label: "Assets", value: "GAS / NEO" },
          { label: "Schedule", value: "Per-second drip" },
          { label: "Live data", value: "Contract read", accent: true },
        ];
      }

      case "miniapp-council-governance": {
        const countStack = await invokeRead(
          rpcUrl,
          contractHash,
          "getProposalCount",
          [],
          network,
        );
        const total = stackInt(countStack);
        if (total <= 0) {
          return [
            { label: "Total Proposals", value: "0" },
            { label: "Active", value: "0" },
            { label: "Finalized", value: "0" },
            { label: "Quorum Target", value: "-" },
            { label: "Status", value: "Ready", accent: true },
          ];
        }

        const limit = Math.min(total, 20);
        const proposalReads = [];
        for (let id = total; id >= total - limit + 1 && id >= 1; id -= 1) {
          proposalReads.push(
            invokeRead(
              rpcUrl,
              contractHash,
              "getProposalDetails",
              [{ type: "Integer", value: String(id) }],
              network,
            )
              .then((stack) => ({ id, map: decodeMap(stack) }))
              .catch(() => ({ id, map: {} as Record<string, unknown> })),
          );
        }
        const proposals = await Promise.all(proposalReads);
        const activeCount = proposals.filter((proposal) =>
          isCouncilProposalActive(proposal.map),
        ).length;
        const latest = proposals.find(
          (proposal) => Object.keys(proposal.map).length > 0,
        );
        const quorumRequired = parseInt(
          String(latest?.map.quorumRequired ?? "0"),
          10,
        );

        return [
          {
            label: "Total Proposals",
            value: String(total),
            accent: total > 0,
          },
          {
            label: "Active",
            value: String(activeCount),
            accent: activeCount > 0,
          },
          {
            label: "Finalized",
            value: String(Math.max(0, total - activeCount)),
          },
          {
            label: "Quorum Target",
            value: quorumRequired > 0 ? String(quorumRequired) : "-",
          },
          { label: "Last Proposal", value: latest ? `#${latest.id}` : "-" },
          { label: "Status", value: "Contract read", accent: true },
        ];
      }

      default:
        return [{ label: "Live data", value: "No binding" }];
    }
  } catch (err) {
    if (!isExpectedStatsAbort(err)) {
      console.warn("[LiveContractView] fetchAppStats failed for", appId, err);
    }
    return [{ label: "Live stats", value: "Unavailable" }];
  }
}

function isExpectedStatsAbort(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const name = err.name.toLowerCase();
  const message = err.message.toLowerCase();
  return (
    name === "aborterror" ||
    name === "timeouterror" ||
    message.includes("signal timed out") ||
    message.includes("operation was aborted")
  );
}
