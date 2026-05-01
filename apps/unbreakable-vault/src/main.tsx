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
      escrowService: ctx.os.escrow,
      paymentService: ctx.os.payment,
      storageService: ctx.os.storage,
      badgeService: ctx.os.badge,
      eventBus: ctx.services.events,
      t,
    });

    const breaker = useVaultBreaker({
      escrowService: ctx.os.escrow,
      paymentService: ctx.os.payment,
      storageService: ctx.os.storage,
      badgeService: ctx.os.badge,
      eventBus: ctx.services.events,
      t,
    });

    ctx.registerAction("loadVault", async (vaultId: unknown) => {
      if (vaultId) {
        await breaker.selectVault(String(vaultId));
      } else {
        await breaker.loadVault();
      }
    });

    ctx.registerAction("attemptBreak", async () => {
      await breaker.attemptBreak();
    });

    ctx.registerAction("createVault", async (form: unknown) => {
      await creator.createVault(
        form as Parameters<typeof creator.createVault>[0],
        (vaultId: string) => {
          ctx.setStatus(t("vaultCreated"), "success");
          breaker.selectVault(vaultId);
        },
        breaker.loadRecentVaults,
      );
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
        canAttempt: breaker.canAttempt,
      }),
      loadData: async () => {
        await Promise.all([breaker.loadRecentVaults(), creator.loadMyVaults()]);
      },
    };
  },
});
