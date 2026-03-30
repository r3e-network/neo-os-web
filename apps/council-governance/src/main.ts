/**
 * Council Governance — Entry Point (OS Services Pattern)
 *
 * This miniapp uses OS service proxies (ctx.os.storage, ctx.os.payment,
 * ctx.os.badge) instead of direct chain calls. The proxies handle all
 * contract interaction through edge functions, so the miniapp never
 * touches contract hashes, parameter encoding, or event parsing.
 *
 * Architecture:
 *   main.ts -> defineMiniApp({ playArea, manifest, setup })
 *   setup() -> useGovernance({ storageService, paymentService, badgeService, t })
 *
 * The composable calls:
 *   ctx.os.storage.list("proposal:")              — load proposals
 *   ctx.os.storage.set("vote:${id}", data)        — cast vote
 *   ctx.os.storage.set("proposal:new", data)      — create proposal
 *   ctx.os.storage.get(`voted:${addr}:${id}`)     — check vote status
 *   ctx.os.badge.award(badgeId, user)             — award governance badges
 *
 * Everything else (manifest, PlayArea, i18n, actions) stays the same.
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

  /**
   * Setup function — wires OS services to reactive state.
   *
   * Called once when the miniapp mounts. Uses ctx.os (OS service proxies)
   * for all data loading and mutations instead of ctx.services.chain.
   */
  setup(ctx) {
    const gov = useGovernance({
      storageService: ctx.os.storage,
      paymentService: ctx.os.payment,
      badgeService: ctx.os.badge,
      t: ctx.t as (
        key: string,
        params?: Record<string, string | number>,
      ) => string,
      currentChainId: { value: "neo-n3-testnet" },
    });

    // Track wallet address from the platform's chain service
    gov.setAddress(ctx.services.chain.address.value ?? "");

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
        address: gov.address,
      },

      loadData: gov.init,
    };
  },
});
