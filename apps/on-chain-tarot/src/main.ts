/**
 * On-Chain Tarot — Entry Point (OS Services Pattern)
 *
 * This miniapp uses OS service proxies (ctx.os.game, ctx.os.storage,
 * ctx.os.badge) instead of direct chain calls. Oracle VRF callbacks
 * are handled server-side by the edge function; the app polls for
 * completed readings via ctx.os.storage.
 *
 * Architecture:
 *   main.ts -> defineMiniApp({ playArea, manifest, setup })
 *   setup() -> useTarot({ gameService, storageService, badgeService, t })
 *
 * The composable calls:
 *   ctx.os.game.placeBet("tarot", question)       — request reading
 *   ctx.os.storage.get(`reading:${id}`)            — poll for result
 *   ctx.os.storage.list("reading:")                — load reading count
 *   ctx.os.badge.award(badgeId, user)              — award badges
 *
 * The oracle service (ctx.services.oracle) is preserved as a platform
 * service dependency but the actual VRF interaction is now handled
 * by the edge function behind GameProxy.
 *
 * Everything else (manifest, PlayArea, i18n, actions) stays the same.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useTarot } from "./composables/useTarot";

defineMiniApp({
  appId: "miniapp-onchaintarot",
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
    const tarot = useTarot({
      gameService: ctx.os.game,
      storageService: ctx.os.storage,
      badgeService: ctx.os.badge,
      t: ctx.t,
    });

    ctx.registerAction("draw", () =>
      ctx.services.notify.guard(() => tarot.draw(), "cardsDrawn"),
    );

    ctx.registerAction("reset", async () => {
      tarot.reset();
    });
    ctx.registerAction("flipCard", async (index?: unknown) => {
      tarot.flipCard(Number(index ?? 0));
    });

    return {
      state: {
        readingsCount: tarot.readingsCount,
        drawn: tarot.drawn,
        hasDrawn: tarot.hasDrawn,
        allFlipped: tarot.allFlipped,
        isLoading: tarot.isLoading,
        question: tarot.question,
      },
      loadData: tarot.loadAll,
    };
  },
});
