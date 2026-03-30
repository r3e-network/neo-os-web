/**
 * Unbreakable Vault — Entry Point (OS Services Pattern)
 *
 * This miniapp uses OS service proxies (ctx.os.escrow, ctx.os.payment,
 * ctx.os.storage, ctx.os.badge) instead of direct chain calls. The
 * proxies handle all contract interaction through edge functions.
 *
 * Architecture:
 *   main.ts -> defineMiniApp({ playArea, manifest, setup })
 *   setup() -> useVaultCreator({ escrowService, paymentService, ... })
 *              useVaultBreaker({ escrowService, paymentService, ... })
 */

import { computed } from "vue";
import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { registerActions } from "@shared/utils/createActionHandlers";
import PlayArea from "./PlayArea.vue";
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

    // Register actions for PlayArea
    registerActions(ctx, {
      loadVault: {
        handler: async (vaultId: unknown) => {
          if (vaultId) {
            await breaker.selectVault(String(vaultId));
          } else {
            await breaker.loadVault();
          }
        },
      },
      attemptBreak: {
        handler: () => breaker.attemptBreak(),
        errorKey: "vaultAttemptFailed",
      },
      createVault: {
        handler: async (form: unknown) => {
          await creator.createVault(
            form as Parameters<typeof creator.createVault>[0],
            (vaultId: string) => {
              ctx.setStatus(t("vaultCreated"), "success");
              breaker.selectVault(vaultId);
            },
            breaker.loadRecentVaults,
          );
        },
        successKey: "vaultCreated",
        errorKey: "vaultCreateFailed",
      },
    });

    const loadData = async () => {
      await Promise.all([breaker.loadRecentVaults(), creator.loadMyVaults()]);
    };

    return {
      state: {
        address: ctx.services.chain.address,
        myVaultCount: computed(() => creator.myVaults.value.length),
        recentVaultCount: computed(() => breaker.recentVaults.value.length),
        vaultDifficulty: computed(
          () => breaker.vaultDetails.value?.difficultyName ?? "1",
        ),
        attemptFeeDisplay: breaker.attemptFeeDisplay,
        createdVaultId: creator.createdVaultId,
        vaultDetails: breaker.vaultDetails,
        recentVaults: breaker.recentVaults,
        myVaults: creator.myVaults,
        isLoading: breaker.isLoading,
        canAttempt: breaker.canAttempt,
      },

      loadData,
    };
  },
});
