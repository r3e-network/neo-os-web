/**
 * GasBox — React Entry Point
 */

import { defineMiniApp, createObservable, createDerived } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useGasBox } from "./composables/useGasBox";
import type { MachineData } from "./composables/useGasBox";

defineMiniApp({
  appId: "miniapp-gasbox",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const gasbox = useGasBox({
      gameService: ctx.os.game,
      paymentService: ctx.os.payment,
      storageService: ctx.os.storage,
      badgeService: ctx.os.badge,
      escrowService: ctx.os.escrow,
      t: ctx.t,
    });

    const findMachineById = (id: string) =>
      gasbox.machines.get().find((m) => String(m.id) === id) ?? null;

    ctx.registerAction("pull", async (...args: unknown[]) => {
      const id = String(args[0] ?? "");
      const machine = findMachineById(id);
      if (!machine) {
        ctx.setStatus(ctx.t("machineNotFound") || "Machine not found", "error");
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
      await ctx.services.notify.guard(
        () => gasbox.publishMachine(machineData, (msg, type) => {
          ctx.setStatus(msg, type === "loading" ? "info" : type);
        }),
        "machineCreated",
      );
    });

    ctx.registerAction("selectMachine", async (...args: unknown[]) => {
      const id = String(args[0] ?? "");
      const machine = findMachineById(id);
      if (machine) gasbox.selectMachine(machine);
    });

    // Synthetic counters for manifest stats — Machine type doesn't track per-machine pulls,
    // so totalPulls aggregates from all machines' itemsPulled summed via composable history.
    const totalPulls = createDerived(
      () => gasbox.machines.get().reduce((sum, m) => sum + Number((m as unknown as { itemsPulled?: number }).itemsPulled ?? 0), 0),
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
      },
      loadData: gasbox.loadAll,
    };
  },
});
