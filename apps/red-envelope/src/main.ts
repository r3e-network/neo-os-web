/**
 * Red Envelope — Entry Point (OS Services Pattern)
 *
 * This miniapp uses OS service proxies (ctx.os.game, ctx.os.payment,
 * ctx.os.storage, ctx.os.badge) instead of direct chain calls. The
 * proxies handle all contract interaction through edge functions, so the
 * miniapp never touches contract hashes, parameter encoding, or event
 * parsing.
 *
 * Architecture:
 *   main.ts -> defineMiniApp({ playArea, manifest, setup })
 *   setup() -> useRedEnvelope({ gameService, paymentService, ... })
 *
 * The composable calls:
 *   ctx.os.payment.deposit(amount, memo)      — fund envelope
 *   ctx.os.game.createPool(config)            — create envelope pool
 *   ctx.os.game.placeBet(poolId, "1")         — claim from envelope
 *   ctx.os.storage.list("envelopes:", 120)    — load all envelopes
 *   ctx.os.storage.list("claims:", 120)       — load user claims
 *   ctx.os.storage.get("eligibility:<id>")    — check NEO eligibility
 *   ctx.os.badge.award(badgeId, user)         — hint achievements
 *
 * Everything else (manifest, PlayArea, i18n) stays the same.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { registerActions } from "@shared/utils/createActionHandlers";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useRedEnvelope } from "./composables/useRedEnvelope";

defineMiniApp({
  appId: "miniapp-redenvelope",
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
    const envelope = useRedEnvelope({
      gameService: ctx.os.game,
      paymentService: ctx.os.payment,
      storageService: ctx.os.storage,
      badgeService: ctx.os.badge,
      t: ctx.t,
    });

    // Register sync actions
    ctx.registerAction("closeLucky", async () => {
      envelope.luckyMessage.value = null;
    });

    ctx.registerAction("closeModal", async () => {
      envelope.showOpeningModal.value = false;
    });

    ctx.registerAction("openFromList", async (envelopeItem: unknown) => {
      envelope.openFromList(
        envelopeItem as Parameters<typeof envelope.openFromList>[0],
      );
    });

    // Register async actions with standardized error handling
    registerActions(ctx, {
      connect: {
        handler: () => envelope.handleConnect(),
        errorKey: "error",
      },
      openEnvelope: {
        handler: async () => {
          if (envelope.openingEnvelope.value) {
            await envelope.openEnvelope(envelope.openingEnvelope.value);
          }
        },
        errorKey: "error",
      },
      create: {
        handler: async (formData: unknown) => {
          const fd = formData as {
            name: string;
            description: string;
            amount: string;
            count: string;
            expiryHours: string;
            minNeoRequired: string;
            minHoldDays: string;
            envelopeType: string;
          };
          await envelope.create({
            amount: fd.amount,
            count: fd.count,
            expiryHours: fd.expiryHours,
          });
        },
        successKey: "envelopeCreated",
        errorKey: "error",
      },
      claimFromPool: {
        handler: (poolId: unknown) =>
          envelope.handleClaimFromPool(poolId as string),
        errorKey: "error",
      },
    });

    // Load envelopes on mount
    const initialLoad = async () => {
      try {
        await envelope.loadEnvelopes();

        // Handle deep link
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const id = params.get("id");
          if (id) {
            const found = envelope.envelopes.value.find((e) => e.id === id);
            if (found) {
              envelope.openFromList(found);
            }
          }
        }
      } catch (_e) {
        console.warn(
          "[red-envelope] initial data load failed:",
          _e instanceof Error ? _e.message : String(_e),
        );
      }
    };

    return {
      state: {
        // Manifest-bound stats/sidebar values
        envelopeCount: envelope.envelopeCount,
        claimCount: envelope.claimCount,
        poolCount: envelope.poolCount,

        // PlayArea state
        luckyMessage: envelope.luckyMessage,
        showOpeningModal: envelope.showOpeningModal,
        openingEnvelope: envelope.openingEnvelope,
        isConnected: envelope.isConnected,
        isOpening: envelope.isOpening,
        isLoading: envelope.isLoading,
        envelopes: envelope.envelopes,
        claims: envelope.claims,
        pools: envelope.pools,
      },

      loadData: initialLoad,
    };
  },
});
