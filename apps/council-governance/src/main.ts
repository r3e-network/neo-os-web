/**
 * Council Governance — Entry Point (New Pattern)
 *
 * Uses defineMiniApp() + PlatformServices to wire the governance
 * composable to the platform.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useGovernance } from "./composables/useGovernance";

defineMiniApp({
  appId: "miniapp-council-governance",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = ctx.services;

    const gov = useGovernance({
      chain: platformServices.chain,
      eventBus: platformServices.events,
      t: ctx.t as (
        key: string,
        params?: Record<string, string | number>,
      ) => string,
      currentChainId: { value: "neo-n3-testnet" },
    });

    ctx.registerAction("createProposal", async (...args: unknown[]) => {
      const proposalData = args[0] as {
        type: number;
        title: string;
        description: string;
        policyMethod?: string;
        policyValue?: string;
        duration: number;
      };
      const success = await gov.createProposal(proposalData);
      if (success) {
        ctx.setStatus(ctx.t("proposalSubmitted"), "success");
      }
    });

    ctx.registerAction("castVote", async (...args: unknown[]) => {
      const proposalId = args[0] as number;
      const voteType = args[1] as "for" | "against";
      await gov.castVote(proposalId, voteType);
    });

    ctx.registerAction("executeProposal", async (...args: unknown[]) => {
      const proposalId = args[0] as number;
      await gov.executeProposal(proposalId);
    });

    return {
      state: {
        activeCount: gov.activeProposals,
        historyCount: gov.historyProposals,
        totalProposals: gov.proposals,
        votingPower: gov.votingPower,
        proposals: gov.proposals,
        activeProposals: gov.activeProposals,
        historyProposals: gov.historyProposals,
        selectedProposal: gov.selectedProposal,
        loadingProposals: gov.loadingProposals,
        candidateLoaded: gov.candidateLoaded,
        isCandidate: gov.isCandidate,
        hasVotedMap: gov.hasVotedMap,
        isVoting: gov.isVoting,
        address: platformServices.chain.address,
      },

      loadData: gov.init,
    };
  },
});
