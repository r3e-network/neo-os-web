/**
 * GasBox — React Entry Point
 *
 * Drives the standalone MiniAppGasBox contract directly via ctx.services.chain.
 * Prizes are drawn and paid ON-CHAIN in the pull tx (no client-side simulation,
 * no oracle).
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
      chain: ctx.services.chain,
      t: ctx.t,
    });

    gasbox.setAddress(ctx.services.chain.address.get() ?? null);

    // Per-user pull counter. Pulls settle per-tx on chain (no per-player counter
    // on the contract), so this is a durable client-side tally keyed by wallet
    // address via os.storage, incremented only after a confirmed Pulled event.
    const userPulls = createObservable(0);

    const userPullsStorageKey = (addr: string | null): string | null =>
      addr ? `gasbox:userPulls:${addr}` : null;

    const persistUserPulls = async (value: number): Promise<void> => {
      const key = userPullsStorageKey(ctx.services.chain.address.get() ?? null);
      if (!key) return;
      try {
        await ctx.os.storage.set(key, value);
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
      const key = userPullsStorageKey(ctx.services.chain.address.get() ?? null);
      if (!key) {
        userPulls.set(0);
        return;
      }
      try {
        const stored = await ctx.os.storage.get(key);
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
      if (selection.source === "none") return;

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

    ctx.registerAction("pull", async (...args: unknown[]) => {
      const id = String(args[0] ?? "");
      const machine = findMachineById(id);
      if (!machine) {
        ctx.setStatus(ctx.t("machineNotFound"), "error");
        return;
      }
      gasbox.selectMachine(machine);
      // guard returns playMachine's boolean on a confirmed on-chain pull, or
      // undefined when it swallows a thrown error. Only advance the per-user
      // pull counter on a real, settled win.
      const pulled = await ctx.services.notify.guard(
        () => gasbox.playMachine(),
        "pullSuccess",
      );
      if (pulled === true) {
        userPulls.set(userPulls.get() + 1);
        void persistUserPulls(userPulls.get());
      }
    });

    ctx.registerAction("publishMachine", async (...args: unknown[]) => {
      const machineData = (args[0] ?? {}) as MachineData;
      // guard returns publishMachine's boolean on success, or undefined when it
      // swallows a thrown error. Propagate it so the view only clears the studio
      // form on a confirmed publish (a failed publish must keep the user's input).
      const published = await ctx.services.notify.guard(
        () => gasbox.publishMachine(machineData, (msg, type) => {
          ctx.setStatus(msg, type === "loading" ? "info" : type);
        }),
        "machineCreated",
      );
      return published === true;
    });

    ctx.registerAction("selectMachine", async (...args: unknown[]) => {
      const id = String(args[0] ?? "");
      const machine = findMachineById(id);
      if (machine) gasbox.selectMachine(machine);
    });

    ctx.registerAction("withdrawRevenue", async (...args: unknown[]) => {
      const id = String(args[0] ?? "");
      if (!id) return;
      await ctx.services.notify.guard(
        () => gasbox.withdrawRevenue(id),
        "revenueClaimed",
      );
    });

    ctx.registerAction("resetResult", async () => {
      gasbox.resetResult();
    });

    ctx.registerAction("refreshMachines", async () => {
      await gasbox.loadAll();
    });

    ctx.registerAction("openStudio", async () => {
      gasbox.openStudio();
      ctx.setStatus(ctx.t("studioGuidance") || "Open Studio to create, fund, or activate machines.", "info");
    });

    ctx.registerAction("closeStudio", async () => {
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
        // Connected wallet address — the view shows the creator-only Withdraw
        // Revenue control when this matches the selected machine's creatorHash.
        walletAddress: gasbox.address,
      },
      loadData: async () => {
        gasbox.setAddress(ctx.services.chain.address.get() ?? null);
        await Promise.all([gasbox.loadAll(), loadUserPulls()]);
        applyLaunchSelection();
      },
    };
  },
});
