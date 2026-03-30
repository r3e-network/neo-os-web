/**
 * GasBox — Entry Point (OS Services Pattern)
 *
 * This miniapp uses OS service proxies (ctx.os.game, ctx.os.payment,
 * ctx.os.storage, ctx.os.badge, ctx.os.escrow) instead of direct chain
 * calls. The proxies handle all contract interaction through edge
 * functions, so the miniapp never touches contract hashes, parameter
 * encoding, or event parsing.
 *
 * Architecture:
 *   main.ts -> defineMiniApp({ playArea, manifest, setup })
 *   setup() -> useGasBox({ gameService, paymentService, ... })
 *
 * The composable calls:
 *   ctx.os.game.getPoolState("machines")          — load all machines
 *   ctx.os.game.placeBet("play", machineId)       — play a machine
 *   ctx.os.game.placeBet("buy", machineId)        — buy a machine
 *   ctx.os.game.createPool(config)                — create machine
 *   ctx.os.payment.deposit(amount, memo)          — GAS payments
 *   ctx.os.payment.withdraw(amount)               — withdrawals
 *   ctx.os.storage.get/set(key, value)            — machine config/state
 *   ctx.os.escrow.create/refund(...)              — sale listings
 *   ctx.os.badge.award(badgeId, "")               — achievement hints
 *
 * Everything else (manifest, PlayArea, i18n, actions) stays the same.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { registerActions } from "@shared/utils/createActionHandlers";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useGasBox } from "./composables/useGasBox";
import type { Machine } from "./types";

defineMiniApp({
  appId: "miniapp-gasbox",
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
    const gasbox = useGasBox({
      gameService: ctx.os.game,
      paymentService: ctx.os.payment,
      storageService: ctx.os.storage,
      badgeService: ctx.os.badge,
      escrowService: ctx.os.escrow,
      t: ctx.t,
    });

    // Register actions so they can be called from operation panels or
    // from the PlayArea via the injected action registry.
    registerActions(ctx, {
      play: {
        handler: async () => {
          await gasbox.playMachine();
        },
        successKey: "congratulations",
      },
      buy: {
        handler: async () => {
          await gasbox.buyMachine();
        },
        successKey: "buyMachine",
      },
      publish: {
        handler: async (machineData: unknown) => {
          await gasbox.publishMachine(
            machineData as {
              name: string;
              description: string;
              category: string;
              tags: string;
              price: string;
              items: {
                name: string;
                probability: number;
                icon: string;
                rarity: string;
                assetType: string;
                assetHash: string;
                amount: string;
                tokenId: string;
              }[];
            },
            (msg: string, type: string) =>
              ctx.setStatus(msg, type as "success" | "error" | "loading"),
          );
        },
        successKey: "publishSuccess",
      },
    });

    // Non-async actions registered directly on ctx (no success toast needed)
    ctx.registerAction("selectMachine", (machine: Machine) => {
      gasbox.selectMachine(machine);
    });

    ctx.registerAction("deselectMachine", () => {
      gasbox.deselectMachine();
    });

    ctx.registerAction("browseAll", () => {
      // Tab navigation handled by platform
    });

    ctx.registerAction("closeResult", () => {
      gasbox.resetResult();
    });

    ctx.registerAction("connectWallet", async () => {
      // Wallet connection is handled by the platform OS layer.
      // After connection, loadData will be called automatically.
    });

    return {
      // ── State bindings ────────────────────────────────────────────
      // Keys must match the `valueKey` fields in manifest.ts.
      // The platform reads these to render stats grid, sidebar, etc.
      state: {
        // Manifest-bound stats/sidebar values
        machineCount: gasbox.machineCount,
        isPlayingDisplay: gasbox.isPlayingDisplay,
        selectedMachineName: gasbox.selectedMachineName,

        // PlayArea state
        machines: gasbox.machines,
        selectedMachine: gasbox.selectedMachine,
        isLoadingMachines: gasbox.isLoadingMachines,
        walletHash: gasbox.walletHash,
        isPlaying: gasbox.isPlaying,
        showResult: gasbox.showResult,
        resultItem: gasbox.resultItem,
        playError: gasbox.playError,
        showFireworks: gasbox.showFireworks,
        address: gasbox.address,
        actionLoading: gasbox.actionLoading,
        isPublishing: gasbox.isPublishing,
      },

      // ── Lifecycle ─────────────────────────────────────────────────
      // Called by the platform on mount and when the wallet reconnects.
      loadData: gasbox.loadAll,
    };
  },
});
