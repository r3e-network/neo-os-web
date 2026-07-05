/**
 * Unbreakable Vault — Entry Point (React)
 */

import { defineMiniApp, createObservable, refsToObservables } from "@shared/react";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useVaultBreaker } from "./composables/useVaultBreaker";
import { useVaultCreator } from "./composables/useVaultCreator";

defineMiniApp({
  appId: "miniapp-unbreakablevault",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const t = ctx.t as (key: string) => string;

    const creator = useVaultCreator({
      chainService: ctx.services.chain,
      eventBus: ctx.services.events,
      t,
    });

    const breaker = useVaultBreaker({
      chainService: ctx.services.chain,
      eventBus: ctx.services.events,
      t,
    });

    ctx.framework.actions.register("loadVault", async (vaultId: unknown) => {
      const result = vaultId
        ? await breaker.selectVault(String(vaultId))
        : await breaker.loadVault();
      if (result?.error) {
        ctx.setStatus(result.error, "error");
      }
    });

    ctx.framework.actions.register("attemptBreak", async () => {
      const result = await breaker.attemptBreak();
      if (!result) return; // guard not satisfied — no attempt was made
      if (result.success) {
        ctx.setStatus(t("broken"), "success");
      } else {
        ctx.setStatus(t("vaultAttemptFailed"), "warning");
      }
    });

    ctx.framework.actions.register("settleVault", async () => {
      const result = await breaker.settleVault();
      if (!result) return; // guard not satisfied — creator-of-expired only
      if (result.success) {
        ctx.setStatus(t("vaultReclaimed"), "success");
      } else {
        ctx.setStatus(t("settleFailed"), "error");
      }
    });

    ctx.framework.actions.register("createVault", async (form: unknown) => {
      await creator.createVault(
        form as Parameters<typeof creator.createVault>[0],
        (vaultId: string) => {
          ctx.setStatus(t("vaultCreated"), "success");
          breaker.selectVault(vaultId);
        },
        breaker.loadRecentVaults,
      );
    });

    ctx.framework.actions.register("increaseBounty", async (...args: unknown[]) => {
      const [vaultId, amountGas] = args;
      await ctx.services.notify.guard(async () => {
        const result = await creator.increaseBounty(
          String(vaultId ?? ""),
          String(amountGas ?? ""),
          () => breaker.loadVault().then(() => undefined),
        );
        ctx.services.notify.success("increaseBountySuccess", {
          amount: result.amountGas,
          tokenGas: t("tokenGas"),
        });
      });
    });

    const myVaultCount = {
      get: () => creator.myVaults.get().length,
      set: () => {},
      subscribe: (fn: () => void) => creator.myVaults.subscribe(fn),
    };
    const recentVaultCount = {
      get: () => breaker.recentVaults.get().length,
      set: () => {},
      subscribe: (fn: () => void) => breaker.recentVaults.subscribe(fn),
    };

    return {
      state: refsToObservables({
        address: ctx.services.chain.address,
        myVaultCount,
        recentVaultCount,
        vaultDifficulty: createObservable("1"),
        // expose break-flow inputs so PlayArea can wire them
        vaultIdInput: breaker.vaultIdInput,
        attemptSecret: breaker.attemptSecret,
        attemptFeeDisplay: breaker.attemptFeeDisplay,
        createdVaultId: creator.createdVaultId,
        vaultDetails: breaker.vaultDetails,
        recentVaults: breaker.recentVaults,
        myVaults: creator.myVaults,
        isLoading: breaker.isLoading,
        isCreating: creator.isCreating,
        isClaiming: breaker.isClaiming,
        canAttempt: breaker.canAttempt,
        canReclaim: breaker.canReclaim,
      }),
      loadData: async () => {
        await Promise.all([breaker.loadRecentVaults(), creator.loadMyVaults()]);
      },
    };
  },
});
