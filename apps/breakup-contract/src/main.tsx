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
  // Pin app.storage.local to the legacy runtime-cache namespace so the
  // on-device per-pact title/terms store keeps living at the exact
  // pre-framework "breakup-contract-meta" localStorage key (prefix +
  // META_STORE_KEY "meta") and existing pact metadata is never orphaned.
  storagePrefix: "breakup-contract-",

  setup(ctx) {
    const app = ctx.framework;
    const breakup = useBreakup({
      app,
      t: ctx.t,
      network: String(app.platform.launch.network ?? ""),
    });

    // Wire the connected wallet address into the composable so per-contract
    // Sign / Break controls (gated on ContractList.isParty) render for the
    // live user. Seed the initial value and keep it in sync on wallet change.
    breakup.setWalletAddress(app.chain.address.get() ?? "");
    app.wallet.onAccountChanged(({ current }) => {
      breakup.setWalletAddress(current ?? "");
      void breakup.loadContracts();
    });

    ctx.framework.actions.register("createContract", async (...args: unknown[]) => {
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
      const result = await app.notify.guardResult(() => breakup.createContract());
      if (!result.ok) return false;
      if (result.value.metadataSaved) {
        app.notify.success("contractCreated", { id: result.value.pactId });
      } else {
        app.notify.warn("contractCreatedMetadataWarning", { id: result.value.pactId });
      }
      return true;
    });
    ctx.framework.actions.register("signContract", (contract: unknown) =>
      app.notify.guard(
        () => breakup.signContract(contract as { id?: number; pactId?: string; stake?: number; stakeRaw?: string }),
        { successKey: "contractSigned" },
      ),
    );
    ctx.framework.actions.register("breakContract", (contract: unknown) =>
      app.notify.guard(
        () => breakup.breakContract(contract as { id?: number; pactId?: string }, "break"),
        { successKey: "contractBroken" },
      ),
    );
    ctx.framework.actions.register("settleContract", (contract: unknown) =>
      app.notify.guard(
        () => breakup.settleContract(contract as { id?: number; pactId?: string }),
        { successKey: "contractSettled" },
      ),
    );
    // breakPact handles BOTH the active-break and the pending-cancel cases on the
    // contract, so the pending-cancel affordance reuses breakContract.
    ctx.framework.actions.register("cancelContract", (contract: unknown) =>
      app.notify.guard(
        () => breakup.breakContract(contract as { id?: number; pactId?: string }, "cancel"),
        { successKey: "contractCancelled" },
      ),
    );
    ctx.framework.actions.register("withdrawCredit", () =>
      app.notify.guard(
        () => breakup.withdrawCredit(),
        { successKey: "creditRecovered" },
      ),
    );
    ctx.framework.actions.register("refreshContracts", async () => {
      await breakup.loadContracts();
    });

    return {
      state: refsToObservables({
        contracts: breakup.contracts,
        address: breakup.address,
        contractCount: breakup.contractCount,
        activeCount: breakup.activeCount,
        pendingCount: breakup.pendingCount,
        brokenCount: breakup.brokenCount,
        // Chrome read-outs: the same counts, able to say why they have no
        // number yet instead of publishing a fabricated 0. See manifest.ts.
        contractsStatus: breakup.contractsStatus,
        contractCountDisplay: breakup.contractCountDisplay,
        activeCountDisplay: breakup.activeCountDisplay,
        pendingCountDisplay: breakup.pendingCountDisplay,
        brokenCountDisplay: breakup.brokenCountDisplay,
        isLoading: breakup.isLoading,
        actionPhase: breakup.actionPhase,
        hasPendingAction: breakup.hasPendingAction,
        serviceNotice: breakup.serviceNotice,
        actionNotice: breakup.actionNotice,
        pendingNotice: breakup.pendingNotice,
        lastSubmittedTitle: breakup.lastSubmittedTitle,
        creditBalance: breakup.creditBalance,
        creditKnown: breakup.creditKnown,
        hasCredit: breakup.hasCredit,
      }),
      loadData: breakup.loadContracts,
    };
  },
});
