/**
 * GasBox — React Entry Point
 *
 * Drives the standalone MiniAppGasBox contract entirely through the MiniApp
 * framework (ctx.framework): app.chain for reads/invokes, app.funds for the
 * deposit-then-commit lane, app.events for the recovery log walks, and
 * app.notify for the per-action toast guards (see useGasBox). Prizes are drawn
 * and paid ON-CHAIN in the pull tx (no client-side simulation, no oracle).
 */

import { defineMiniApp, createObservable, createDerived } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useGasBox } from "./composables/useGasBox";
import type { MachineData } from "./composables/useGasBox";
import { resolveGasBoxLaunchMachine } from "./launch";

defineMiniApp({
  appId: "miniapp-gasbox",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const gasbox = useGasBox({
      app: ctx.framework,
      t: ctx.t,
    });

    gasbox.setAddress(ctx.framework.chain.address.get() ?? null);

    // Per-user pull counter. Pulls settle per-tx on chain (no per-player counter
    // on the contract), so this is a durable client-side tally keyed by wallet
    // address via the framework's remote storage (an unprefixed passthrough over
    // os.storage), incremented only after a confirmed Settled event.
    const userPulls = createObservable(0);

    const userPullsStorageKey = (addr: string | null): string | null =>
      addr ? `gasbox:userPulls:${addr}` : null;

    const persistUserPulls = async (value: number): Promise<void> => {
      const key = userPullsStorageKey(ctx.framework.chain.address.get() ?? null);
      if (!key) return;
      try {
        await ctx.framework.storage.remote.set(key, value);
      } catch (e) {
        // A failed persist must not break the pull flow; the in-memory tally
        // still reflects the session. Surface for diagnostics only.
        console.warn(
          "[gasbox] persist userPulls failed:",
          e instanceof Error ? e.message : String(e),
        );
      }
    };

    const loadUserPulls = async (): Promise<void> => {
      const key = userPullsStorageKey(ctx.framework.chain.address.get() ?? null);
      if (!key) {
        userPulls.set(0);
        return;
      }
      try {
        const stored = await ctx.framework.storage.remote.get(key);
        const n = Number(stored);
        userPulls.set(Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
      } catch (e) {
        console.warn(
          "[gasbox] load userPulls failed:",
          e instanceof Error ? e.message : String(e),
        );
        userPulls.set(0);
      }
    };

    const findMachineById = (id: string) =>
      gasbox.machines.get().find((m) => String(m.id) === id) ?? null;

    const applyLaunchSelection = () => {
      const selection = resolveGasBoxLaunchMachine(
        gasbox.machines.get(),
        ctx.launchContext,
      );
      if (selection.source === "none") {
        // Lead with play: with no explicit launch target, auto-select the first
        // playable machine (active + escrowed inventory) so a visitor lands on
        // the pull experience instead of an empty "Select a Machine" prompt.
        // Falls back to the first machine so a not-yet-funded market still shows
        // the (blocked) pull panel rather than a bare prompt. Never overrides an
        // existing selection.
        if (!gasbox.selectedMachine.get()) {
          const list = gasbox.machines.get();
          const playable = list.find((m) => m.active && m.inventoryReady) ?? list[0];
          if (playable) gasbox.selectMachine(playable);
        }
        return;
      }

      if (selection.machine) {
        gasbox.selectMachine(selection.machine);
        return;
      }

      ctx.setStatus(
        selection.requestedId
          ? ctx.t("launchMachineNotFound", { machine: selection.requestedId })
          : ctx.t("launchNoMachines"),
        "warning",
      );
    };

    ctx.framework.actions.register("pull", async (...args: unknown[]) => {
      const id = String(args[0] ?? "");
      const machine = findMachineById(id);
      if (!machine) {
        ctx.setStatus(ctx.t("machineNotFound"), "error");
        return;
      }
      gasbox.selectMachine(machine);
      // Two-step play: commit → wait one block → settle. guard returns
      // playMachine's boolean on a confirmed, settled win, or undefined when it
      // swallows a thrown error (a committed-but-unrevealed bet stays pending so
      // the player can finish via the Reveal action). Only advance the per-user
      // pull counter on a real, settled win.
      const settled = await ctx.framework.notify.guard(
        () => gasbox.playMachine(),
        { successKey: "pullSuccess" },
      );
      if (settled === true) {
        userPulls.set(userPulls.get() + 1);
        void persistUserPulls(userPulls.get());
      }
    });

    // Reveal-retry: re-run settle against the persisted pending betId. Safe to
    // retry (settle is permissionless + pays exactly once). Counts the pull only
    // when the reveal newly settles a win here.
    ctx.framework.actions.register("reveal", async () => {
      if (!gasbox.canReveal.get()) return;
      const settled = await ctx.framework.notify.guard(
        () => gasbox.revealPending(),
        { successKey: "pullSuccess" },
      );
      if (settled === true) {
        userPulls.set(userPulls.get() + 1);
        void persistUserPulls(userPulls.get());
      }
    });

    ctx.framework.actions.register("publishMachine", async (...args: unknown[]) => {
      const machineData = (args[0] ?? {}) as MachineData;
      // guard returns publishMachine's boolean on success, or undefined when it
      // swallows a thrown error. Propagate it so the view only clears the studio
      // form on a confirmed publish (a failed publish must keep the user's input).
      const published = await ctx.framework.notify.guard(
        () => gasbox.publishMachine(machineData, (msg, type) => {
          ctx.setStatus(msg, type === "loading" ? "info" : type);
        }),
        { successKey: "machineCreated" },
      );
      return published === true;
    });

    ctx.framework.actions.register("selectMachine", async (...args: unknown[]) => {
      const id = String(args[0] ?? "");
      const machine = findMachineById(id);
      if (machine) gasbox.selectMachine(machine);
    });

    ctx.framework.actions.register("withdrawRevenue", async (...args: unknown[]) => {
      const id = String(args[0] ?? "");
      if (!id) return;
      await ctx.framework.notify.guard(
        () => gasbox.withdrawRevenue(id),
        { successKey: "revenueClaimed" },
      );
    });

    ctx.framework.actions.register("topUpPool", async (...args: unknown[]) => {
      const id = String(args[0] ?? "");
      const amount = String(args[1] ?? "");
      if (!id || !amount) return;
      await ctx.framework.notify.guard(
        () => gasbox.topUpPool(id, amount),
        { successKey: "poolToppedUp" },
      );
    });

    ctx.framework.actions.register("setMachineActive", async (...args: unknown[]) => {
      const id = String(args[0] ?? "");
      const active = args[1] === true;
      if (!id) return;
      await ctx.framework.notify.guard(
        () => gasbox.setMachineActive(id, active),
        { successKey: active ? "machineActivated" : "machineDeactivated" },
      );
    });

    ctx.framework.actions.register("resetResult", async () => {
      gasbox.resetResult();
    });

    ctx.framework.actions.register("refreshMachines", async () => {
      await gasbox.loadAll();
    });

    ctx.framework.actions.register("openStudio", async () => {
      gasbox.openStudio();
      ctx.setStatus(ctx.t("studioGuidance"), "info");
    });

    ctx.framework.actions.register("closeStudio", async () => {
      gasbox.closeStudio();
    });

    // Estimated play volume. Pulls settle per-tx on chain (no per-machine pull
    // counter on the contract), so this aggregates accumulated revenue / price
    // across machines as a play-volume estimate. It under-reports after a
    // creator withdraws revenue and rounds per-machine, so the view labels it as
    // an estimate ("Est. Plays"), not an exact count.
    const totalPulls = createDerived(
      () =>
        gasbox.machines.get().reduce((sum, m) => {
          const price = Number(m.priceRaw);
          const revenue = Number(m.revenueRaw);
          return sum + (price > 0 ? Math.floor(revenue / price) : 0);
        }, 0),
      [gasbox.machines],
    );

    return {
      state: {
        machines: gasbox.machines,
        selectedMachine: gasbox.selectedMachine,
        isLoading: gasbox.isLoadingMachines,
        isPulling: gasbox.isPlaying,
        isCreating: gasbox.isPublishing,
        pullResult: gasbox.resultItem,
        userPulls,
        totalPulls,
        machineCount: gasbox.machineCount,
        isPlayingDisplay: gasbox.isPlayingDisplay,
        selectedMachineName: gasbox.selectedMachineName,
        showResult: gasbox.showResult,
        studioOpen: gasbox.studioOpen,
        hasPlayCredit: gasbox.hasPlayCredit,
        formattedPlayCredit: gasbox.formattedPlayCredit,
        // Commit/reveal (two-step) state — drives the pending "drawing on next
        // block" panel and the Reveal-retry affordance.
        betPhase: gasbox.betPhase,
        pendingBetId: gasbox.pendingBetId,
        canReveal: gasbox.canReveal,
        isAwaitingReveal: gasbox.isAwaitingReveal,
        // Connected wallet address — the view shows the creator-only Withdraw
        // Revenue control when this matches the selected machine's creatorHash.
        walletAddress: gasbox.address,
      },
      loadData: async () => {
        gasbox.setAddress(ctx.framework.chain.address.get() ?? null);
        await Promise.all([gasbox.loadAll(), loadUserPulls()]);
        applyLaunchSelection();
      },
    };
  },
});
