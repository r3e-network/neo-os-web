/**
 * Council Governance — React Entry Point
 */

import { defineMiniApp, createObservable, createDerived } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useGovernance } from "./composables/useGovernance";

function normalizeNetworkId(value: unknown): string | null {
  const text = String(value ?? "").trim().toLowerCase();
  if (text.includes("testnet")) return "neo-n3-testnet";
  if (text.includes("mainnet")) return "neo-n3-mainnet";
  return null;
}

defineMiniApp({
  appId: "miniapp-council-governance",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const initialNetwork = normalizeNetworkId(ctx.launchContext.network) ?? "neo-n3-mainnet";
    const currentChainId = createObservable<string>(initialNetwork);
    const isCreating = createObservable(false);

    const app = ctx.framework;
    const gov = useGovernance({
      app,
      t: ctx.t,
      currentChainId,
    });

    const syncNetwork = async () => {
      try {
        const detected = normalizeNetworkId(await app.chain.detectNetwork());
        if (detected) gov.setNetwork(detected);
      } catch {
        // Keep the manifest/launch-selected network. Reads and writes still
        // fail closed if that lane has no configured contract.
      }
    };

    gov.setAddress(app.chain.address.get() ?? "");
    const unsubscribeAddress = app.wallet.onAccountChanged(({ current }) => {
      gov.setAddress(current ?? "");
      void Promise.allSettled([
        gov.refreshCandidateStatus(),
        gov.refreshHasVoted(),
        gov.refreshWalletBalances(),
      ]);
    });
    app.lifecycle.cleanup(unsubscribeAddress);

    ctx.framework.actions.register("createProposal", async (...args: unknown[]) => {
      const data = (args[0] ?? {}) as {
        type?: number | string;
        title?: string;
        description?: string;
        policyMethod?: string;
        policyValue?: string;
        duration?: number | string;
      };
      return app.notify.guard(
        async () => {
          isCreating.set(true);
          try {
            return await gov.createProposal({
              type: Number(data.type ?? 0),
              title: String(data.title ?? ""),
              description: String(data.description ?? ""),
              policyMethod: data.policyMethod ? String(data.policyMethod) : undefined,
              policyValue: data.policyValue ? String(data.policyValue) : undefined,
              duration: Number(data.duration ?? 0),
            });
          } finally {
            isCreating.set(false);
          }
        },
        { successKey: "proposalCreated" },
      );
    });

    ctx.framework.actions.registerConnectWallet({
      onAddress: (addr) => gov.setAddress(addr),
      // Network detection must settle before the governance reads fire, so this
      // stays one sequential loader rather than a parallel [syncNetwork, init]
      // pair. Both steps handle their own read failures internally.
      refresh: [
        async () => {
          await syncNetwork();
          await gov.init();
        },
      ],
    });

    ctx.framework.actions.register("vote", async (...args: unknown[]) => {
      const data = (args[0] ?? {}) as {
        proposalId?: number | string;
        vote?: string;
        support?: boolean;
      };
      const proposalId = Number(data.proposalId ?? 0);
      const choice =
        typeof data.support === "boolean"
          ? data.support
            ? "for"
            : "against"
          : String(data.vote ?? "for") === "against"
            ? "against"
            : "for";
      return app.notify.guard(
        () => gov.castVote(proposalId, choice),
        { successKey: "voteRecorded" },
      );
    });

    ctx.framework.actions.register("finalizeProposal", async (...args: unknown[]) => {
      const proposalId = Number(args[0] ?? 0);
      if (!Number.isSafeInteger(proposalId) || proposalId <= 0) return;
      return app.notify.guard(
        () => gov.finalizeProposal(proposalId),
        { successKey: "proposalFinalized" },
      );
    });

    ctx.framework.actions.register("executeProposal", async (...args: unknown[]) => {
      const proposalId = Number(args[0] ?? 0);
      if (!Number.isSafeInteger(proposalId) || proposalId <= 0) return;
      return app.notify.guard(
        () => gov.executeProposal(proposalId),
        { successKey: "proposalExecuted" },
      );
    });

    ctx.framework.actions.register("revokeProposal", async (...args: unknown[]) => {
      const proposalId = Number(args[0] ?? 0);
      if (!Number.isSafeInteger(proposalId) || proposalId <= 0) return;
      return app.notify.guard(
        () => gov.revokeProposal(proposalId),
        { successKey: "proposalRevoked" },
      );
    });

    ctx.framework.actions.register("selectProposal", async (...args: unknown[]) => {
      const proposal = args[0] as Parameters<typeof gov.selectProposal>[0] | undefined;
      if (proposal) await gov.selectProposal(proposal);
    });

    ctx.framework.actions.register("refresh", async () => {
      await syncNetwork();
      await gov.init();
    });

    ctx.framework.actions.register("recoverPendingGovernance", async () => {
      return app.notify.guard(
        () => gov.recoverPendingWrite(),
        { successKey: "governanceRecoveryConfirmed" },
      );
    });

    // Surface synthetic stats expected by the manifest.
    const totalProposals = createDerived(
      () => gov.proposals.get().length,
      [gov.proposals],
    );
    const isLoading = gov.loadingProposals;
    const userVotingPower = gov.votingPower;

    return {
      state: {
        proposals: gov.proposals,
        activeProposals: gov.activeProposals,
        historyProposals: gov.historyProposals,
        activeCount: gov.activeCount,
        historyCount: gov.historyCount,
        selectedProposal: gov.selectedProposal,
        isLoading,
        isVoting: gov.isVoting,
        isCreating,
        totalProposals,
        votingPower: userVotingPower,
        userVotingPower,
        isCandidate: gov.isCandidate,
        candidateLoaded: gov.candidateLoaded,
        hasVotedMap: gov.hasVotedMap,
        hasVotedKnownMap: gov.hasVotedKnownMap,
        governanceOverview: gov.governanceOverview,
        governanceOverviewError: gov.governanceOverviewError,
        governanceOverviewSettled: gov.governanceOverviewSettled,
        councilCandidates: gov.councilCandidates,
        councilRosterLoaded: gov.councilRosterLoaded,
        councilRosterError: gov.councilRosterError,
        neoBalance: gov.neoBalance,
        gasBalance: gov.gasBalance,
        balancesLoaded: gov.balancesLoaded,
        balancesSettled: gov.balancesSettled,
        balancesError: gov.balancesError,
        currentNetwork: gov.currentNetwork,
        address: gov.address,
        loadError: gov.loadError,
        candidateError: gov.candidateError,
        pendingWrite: gov.pendingWrite,
        pendingStorageHealthy: gov.pendingStorageHealthy,
        isRecovering: gov.isRecovering,
        lastConfirmation: gov.lastConfirmation,
      },
      loadData: async () => {
        await syncNetwork();
        gov.setAddress(app.chain.address.get() ?? "");
        await gov.init();
      },
    };
  },
});
