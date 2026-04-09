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

    return {
      state: refsToObservables({
        address: ctx.services.chain.address,
        myVaultCount: createObservable(0),
        recentVaultCount: createObservable(0),
        vaultDifficulty: createObservable("1"),
        attemptFeeDisplay: breaker.attemptFeeDisplay,
        createdVaultId: creator.createdVaultId,
        vaultDetails: breaker.vaultDetails,
        recentVaults: breaker.recentVaults,
        myVaults: creator.myVaults,
        isLoading: breaker.isLoading,
        canAttempt: breaker.canAttempt,
      }),
      loadData: async () => {
        await Promise.all([breaker.loadRecentVaults(), creator.loadMyVaults()]);
      },
    };
  },
});
