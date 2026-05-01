/**
 * Council Governance — React Entry Point
 */

import { defineMiniApp, createObservable, createDerived } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useGovernance } from "./composables/useGovernance";

defineMiniApp({
  appId: "miniapp-council-governance",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const currentChainId = createObservable<string>("neo-n3-mainnet");

    const gov = useGovernance({
      storageService: ctx.os.storage,
      paymentService: ctx.os.payment,
      badgeService: ctx.os.badge,
      t: ctx.t,
      currentChainId,
    });

    gov.setAddress(ctx.services.chain.address?.get?.() ?? "");
    ctx.services.chain.address.subscribe(() => {
      gov.setAddress(ctx.services.chain.address?.get?.() ?? "");
    });

    ctx.registerAction("createProposal", async (...args: unknown[]) => {
      const data = (args[0] ?? {}) as {
        type?: number | string;
        title?: string;
        description?: string;
        policyMethod?: string;
        policyValue?: string;
        duration?: number | string;
      };
      await ctx.services.notify.guard(
        () =>
          gov.createProposal({
            type: Number(data.type ?? 0),
            title: String(data.title ?? ""),
            description: String(data.description ?? ""),
            policyMethod: data.policyMethod ? String(data.policyMethod) : undefined,
            policyValue: data.policyValue ? String(data.policyValue) : undefined,
            duration: Number(data.duration ?? 0),
          }),
        "proposalCreated",
      );
    });

    ctx.registerAction("vote", async (...args: unknown[]) => {
      const data = (args[0] ?? {}) as { proposalId?: number | string; vote?: string };
      const proposalId = Number(data.proposalId ?? 0);
      const choice = String(data.vote ?? "for") === "against" ? "against" : "for";
      await ctx.services.notify.guard(
        () => gov.castVote(proposalId, choice),
        "voteRecorded",
      );
    });

    ctx.registerAction("executeProposal", async (...args: unknown[]) => {
      const proposalId = Number(args[0] ?? 0);
      if (!proposalId) return;
      await ctx.services.notify.guard(
        () => gov.executeProposal(proposalId),
        "proposalExecuted",
      );
    });

    ctx.registerAction("selectProposal", async (...args: unknown[]) => {
      const proposal = args[0] as Parameters<typeof gov.selectProposal>[0] | undefined;
      if (proposal) await gov.selectProposal(proposal);
    });

    // Surface synthetic stats expected by the manifest.
    const totalProposals = createDerived(
      () => gov.proposals.get().length,
      [gov.proposals],
    );
    const isLoading = gov.loadingProposals;
    const isCreating = createObservable(false);
    const userVotingPower = gov.votingPower;

    return {
      state: {
        proposals: gov.proposals,
        activeProposals: gov.activeProposals,
        historyProposals: gov.historyProposals,
        selectedProposal: gov.selectedProposal,
        isLoading,
        isVoting: gov.isVoting,
        isCreating,
        totalProposals,
        userVotingPower,
        isCandidate: gov.isCandidate,
        candidateLoaded: gov.candidateLoaded,
        hasVotedMap: gov.hasVotedMap,
      },
      loadData: async () => {
        gov.setAddress(ctx.services.chain.address?.get?.() ?? "");
        await gov.init();
      },
    };
  },
});
