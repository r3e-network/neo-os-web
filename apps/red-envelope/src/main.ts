/**
 * Red Envelope — Entry Point (New Pattern)
 *
 * Uses defineMiniApp() to wire the red envelope composables to the platform.
 */

import { computed } from "vue";
import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { registerActions } from "@shared/utils/createActionHandlers";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useRedEnvelopeCreation } from "./composables/useRedEnvelopeCreation";
import { useRedEnvelopeOpen } from "./composables/useRedEnvelopeOpen";
import { useEnvelopeActions } from "./pages/index/composables/useEnvelopeActions";

defineMiniApp({
  appId: "miniapp-red-envelope",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-red-envelope", {
      t: ctx.t as (key: string) => string,
    });

    const {
      name,
      amount,
      count,
      expiryHours,
      status,
      setStatus,
      clearStatus,
      isLoading,
      ensureContractAddress: ensureCreationContract,
    } = useRedEnvelopeCreation();

    const {
      envelopes,
      loadEnvelopes,
      claims,
      pools,
      claimEnvelope,
    } = useRedEnvelopeOpen();

    const {
      luckyMessage,
      openingId,
      showOpeningModal,
      openingEnvelope,
      handleConnect,
      create,
      openEnvelope,
      openFromList,
      handleClaimFromPool,
      address,
    } = useEnvelopeActions({
      status,
      setStatus,
      clearStatus,
      isLoading,
      ensureCreationContract,
      loadEnvelopes,
      claimEnvelope,
      amount,
      count,
      expiryHours,
    });

    // Derived display values for manifest bindings
    const envelopeCount = computed(() => envelopes.value.length);
    const claimCount = computed(() => claims.value.length);
    const poolCount = computed(() => pools.value.length);
    const isConnected = computed(() => !!address.value);
    const isOpening = computed(() => !!openingId.value);

    // Register sync actions manually (no try/catch needed)
    ctx.registerAction("closeLucky", () => {
      luckyMessage.value = null;
    });

    ctx.registerAction("closeModal", () => {
      showOpeningModal.value = false;
    });

    ctx.registerAction("openFromList", (envelope: unknown) => {
      openFromList(envelope as Parameters<typeof openFromList>[0]);
    });

    // Register async actions with standardized error handling
    registerActions(ctx, {
      connect: {
        handler: () => handleConnect(),
        errorKey: "error",
      },
      openEnvelope: {
        handler: async () => {
          if (openingEnvelope.value) {
            await openEnvelope(openingEnvelope.value);
          }
        },
        errorKey: "error",
      },
      create: {
        handler: async (formData: unknown) => {
          const fd = formData as {
            name: string; description: string; amount: string;
            count: string; expiryHours: string; minNeoRequired: string;
            minHoldDays: string; envelopeType: string;
          };
          name.value = fd.name;
          amount.value = fd.amount;
          count.value = fd.count;
          expiryHours.value = fd.expiryHours;
          await create();
          if (status.value) throw new Error(status.value);
        },
        successKey: "envelopeCreated",
        errorKey: "error",
      },
      claimFromPool: {
        handler: (poolId: unknown) => handleClaimFromPool(poolId as string),
        errorKey: "error",
      },
    });

    // Load envelopes on mount
    const initialLoad = async () => {
      try {
        await loadEnvelopes();

        // Handle deep link
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const id = params.get("id");
          if (id) {
            const found = envelopes.value.find((e) => e.id === id);
            if (found) {
              openFromList(found);
            }
          }
        }
      } catch (_e) {
        console.warn("[red-envelope] initial data load failed:", _e instanceof Error ? _e.message : String(_e));
      }
    };

    return {
      state: {
        // Manifest-bound stats/sidebar values
        envelopeCount,
        claimCount,
        poolCount,

        // PlayArea state
        luckyMessage,
        showOpeningModal,
        openingEnvelope,
        isConnected,
        isOpening,
        isLoading,
        envelopes,
        claims,
        pools,
        address,
      },

      loadData: initialLoad,

      cleanup: () => {
        platformServices.destroy();
      },
    };
  },
});
