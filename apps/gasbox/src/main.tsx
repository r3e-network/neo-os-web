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
      await ctx.services.notify.guard(
        () => gasbox.playMachine(),
        "pullSuccess",
      );
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

    // Manifest stat counters. Pulls are settled per-tx on chain (no per-machine
    // pull counter on the contract), so the live "total pulls" stat aggregates
    // accumulated revenue / price across machines as a play-volume proxy.
    const totalPulls = createDerived(
      () =>
        gasbox.machines.get().reduce((sum, m) => {
          const price = Number(m.priceRaw);
          const revenue = Number(m.revenueRaw);
          return sum + (price > 0 ? Math.floor(revenue / price) : 0);
        }, 0),
      [gasbox.machines],
    );
    const userPulls = createObservable(0);

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
      },
      loadData: async () => {
        gasbox.setAddress(ctx.services.chain.address.get() ?? null);
        await gasbox.loadAll();
        applyLaunchSelection();
      },
    };
  },
});
