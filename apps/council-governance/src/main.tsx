/**
 * Council Governance — React Entry Point
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
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
    const gov = useGovernance({
      governanceService: ctx.os.governance,
      storageService: ctx.os.storage,
      badgeService: ctx.os.badge,
      t: ctx.t,
    });

    gov.setAddress(ctx.services.chain.address?.get?.() ?? "");

    ctx.registerAction("createProposal", async (formData: unknown) => {
      await ctx.services.notify.guard(
        () => gov.createProposal(formData as Record<string, unknown>),
        "proposalCreated",
      );
    });

    ctx.registerAction("vote", async (formData: unknown) => {
      const data = formData as Record<string, unknown>;
      await ctx.services.notify.guard(
        () => gov.vote(String(data.proposalId), String(data.vote)),
        "voteRecorded",
      );
    });

    return {
      state: {
        proposals: gov.proposals,
        isLoading: gov.isLoading,
        isVoting: gov.isVoting,
        isCreating: gov.isCreating,
        totalProposals: gov.totalProposals,
        activeProposals: gov.activeProposals,
        historyProposals: gov.historyProposals,
        userVotingPower: gov.userVotingPower,
        selectedProposal: gov.selectedProposal,
      },
      loadData: async () => {
        gov.setAddress(ctx.services.chain.address?.get?.() ?? "");
        await gov.loadAll();
      },
    };
  },
});
