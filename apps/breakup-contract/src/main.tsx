/**
 * Breakup Contract — Entry Point (React)
 */

import { defineMiniApp, refsToObservables } from "@shared/react";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useBreakup } from "./composables/useBreakup";

defineMiniApp({
  appId: "miniapp-breakupcontract",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const breakup = useBreakup({
      chain: ctx.services.chain,
      eventBus: ctx.services.events,
      t: ctx.t,
    });

    // Wire the connected wallet address into the composable so per-contract
    // Sign / Break controls (gated on ContractList.isParty) render for the
    // live user. Seed the initial value and keep it in sync on wallet change.
    breakup.address.set(ctx.services.chain.address?.get?.() ?? "");
    ctx.services.chain.address.subscribe(() => {
      breakup.address.set(ctx.services.chain.address?.get?.() ?? "");
    });

    ctx.registerAction("createContract", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as {
        partnerAddress?: string;
        stakeAmount?: string;
        duration?: string;
        title?: string;
        terms?: string;
      };
      breakup.partnerAddress.set(String(form.partnerAddress ?? ""));
      breakup.stakeAmount.set(String(form.stakeAmount ?? ""));
      breakup.duration.set(String(form.duration ?? ""));
      breakup.contractTitle.set(String(form.title ?? ""));
      breakup.contractTerms.set(String(form.terms ?? ""));
      // Surface the guard result so PlayArea only clears its (local) form fields
      // on an actual success — a validation/chain failure keeps the user's input
      // for retry (guard swallows failures into error toasts).
      const result = await ctx.services.notify.guard(
        () => breakup.createContract(),
        "contractCreated",
      );
      return result === true;
    });
    ctx.registerAction("signContract", (contract: unknown) =>
      ctx.services.notify.guard(
        () => breakup.signContract(contract as { id?: number; pactId?: string; stake?: number; stakeRaw?: string }),
        "contractSigned",
      ),
    );
    ctx.registerAction("breakContract", (contract: unknown) =>
      ctx.services.notify.guard(
        () => breakup.breakContract(contract as { id?: number; pactId?: string }),
        "contractBroken",
      ),
    );
    ctx.registerAction("settleContract", (contract: unknown) =>
      ctx.services.notify.guard(
        () => breakup.settleContract(contract as { id?: number; pactId?: string }),
        "contractSettled",
      ),
    );
    // breakPact handles BOTH the active-break and the pending-cancel cases on the
    // contract, so the pending-cancel affordance reuses breakContract.
    ctx.registerAction("cancelContract", (contract: unknown) =>
      ctx.services.notify.guard(
        () => breakup.breakContract(contract as { id?: number; pactId?: string }),
        "contractCancelled",
      ),
    );
    ctx.registerAction("withdrawCredit", () =>
      ctx.services.notify.guard(
        () => breakup.withdrawCredit(),
        "creditRecovered",
      ),
    );

    return {
      state: refsToObservables({
        contracts: breakup.contracts,
        address: breakup.address,
        contractCount: breakup.contractCount,
        activeCount: breakup.activeCount,
        pendingCount: breakup.pendingCount,
        brokenCount: breakup.brokenCount,
        isLoading: breakup.isLoading,
        serviceNotice: breakup.serviceNotice,
        actionNotice: breakup.actionNotice,
        lastSubmittedTitle: breakup.lastSubmittedTitle,
        creditBalance: breakup.creditBalance,
        hasCredit: breakup.hasCredit,
      }),
      loadData: breakup.loadContracts,
    };
  },
});
