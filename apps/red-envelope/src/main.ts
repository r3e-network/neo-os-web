/**
 * Red Envelope — Entry Point (New Pattern)
 *
 * Uses defineMiniApp() + PlatformServices to wire the red envelope
 * composable to the platform. All domain logic lives in useRedEnvelope.
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

  setup(ctx) {
    const services = ctx.services;
    const envelope = useRedEnvelope({
      chain: services.chain,
      eventBus: services.events,
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
        address: services.chain.address,
      },

      loadData: initialLoad,
    };
  },
});
