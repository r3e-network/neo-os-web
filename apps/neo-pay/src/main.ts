/**
 * Neo Pay — Entry Point (OS Services Pattern)
 *
 * This miniapp uses OS service proxies (ctx.os.vesting, ctx.os.payment)
 * instead of direct chain calls. The VestingProxy handles all stream
 * contract interaction through edge functions, so the miniapp never
 * touches contract hashes, parameter encoding, or event parsing.
 *
 * Architecture:
 *   main.ts -> defineMiniApp({ playArea, manifest, setup })
 *   setup() -> useNeoPayApp({ vestingService, paymentService, t })
 *
 * The composable calls:
 *   ctx.os.vesting.listStreams("creator")      — load created streams
 *   ctx.os.vesting.listStreams("beneficiary")   — load beneficiary streams
 *   ctx.os.vesting.createStream(params)         — create a payment stream
 *   ctx.os.vesting.claim(streamId)              — claim vested amounts
 *   ctx.os.vesting.cancel(streamId)             — cancel stream
 *   ctx.os.payment.deposit(amount, memo)        — fund stream deposit
 *
 * Everything else (manifest, PlayArea, i18n, actions) stays the same.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { registerActions } from "@shared/utils/createActionHandlers";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useNeoPayApp } from "./composables/useNeoPayApp";
import type { StreamItem } from "./types";

defineMiniApp({
  appId: "miniapp-neo-pay",
  playArea: PlayArea,
  manifest,
  messages,

  /**
   * Setup function — wires OS vesting + payment services to reactive state.
   *
   * Called once when the miniapp mounts. Uses ctx.os.vesting and
   * ctx.os.payment (OS service proxies) for all data loading and
   * mutations instead of ctx.services.chain directly.
   */
  setup(ctx) {
    const pay = useNeoPayApp({
      vestingService: ctx.os.vesting,
      paymentService: ctx.os.payment,
      t: ctx.t,
    });

    // Register actions so they can be called from operation panels or
    // from the PlayArea via the injected action registry.
    registerActions(ctx, {
      refreshStreams: {
        handler: () => pay.refreshStreams(),
      },
      connectWallet: {
        handler: async () => {
          await ctx.services.chain.ensureWallet();
          await pay.refreshStreams();
        },
      },
      createVault: {
        handler: async (formData: unknown) => {
          await pay.handleCreateVault(formData as {
            name: string;
            beneficiary: string;
            asset: string;
            total: string;
            rate: string;
            intervalDays: string;
            notes: string;
          });
        },
        successKey: "vaultCreated",
      },
      claimStream: {
        handler: async (stream: unknown) => {
          await pay.claimStream(stream as StreamItem);
        },
        successKey: "streamClaimed",
      },
      cancelStream: {
        handler: async (stream: unknown) => {
          await pay.cancelStream(stream as StreamItem);
        },
        successKey: "streamCancelled",
      },
    });

    return {
      // ── State bindings ────────────────────────────────────────────
      // Keys must match the `valueKey` fields in manifest.ts.
      // The platform reads these to render stats grid, sidebar, etc.
      state: {
        // Wallet address — read by PlayArea for connect-wallet gating.
        // The platform manages wallet connection; we just forward the ref.
        address: ctx.services.chain.address,

        createdStreams: pay.createdStreams,
        beneficiaryStreams: pay.beneficiaryStreams,
        isLoading: pay.isLoading,
        isRefreshing: pay.isRefreshing,
        claimingId: pay.claimingId,
        cancellingId: pay.cancellingId,
        activeCount: pay.activeCount,
        createdStreamCount: pay.createdStreamCount,
        beneficiaryStreamCount: pay.beneficiaryStreamCount,
        totalStreamCount: pay.totalStreamCount,
      },

      // ── Lifecycle ─────────────────────────────────────────────────
      // Called by the platform on mount and when the wallet reconnects.
      loadData: pay.loadAll,
    };
  },
});
