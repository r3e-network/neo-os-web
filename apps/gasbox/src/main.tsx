/**
 * GasBox — React Entry Point
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useGasBox } from "./composables/useGasBox";

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
      t: ctx.t,
    });

    ctx.registerAction("pull", async (machineId: unknown) => {
      await ctx.services.notify.guard(
        () => gasbox.pull(String(machineId)),
        "pullSuccess",
      );
    });

    ctx.registerAction("createMachine", async (formData: unknown) => {
      await ctx.services.notify.guard(
        () => gasbox.createMachine(formData as Record<string, unknown>),
        "machineCreated",
      );
    });

    ctx.registerAction("selectMachine", async (id: unknown) => {
      gasbox.selectedMachine.set(String(id));
    });

    return {
      state: {
        machines: gasbox.machines,
        selectedMachine: gasbox.selectedMachine,
        isLoading: gasbox.isLoading,
        isPulling: gasbox.isPulling,
        isCreating: gasbox.isCreating,
        pullResult: gasbox.pullResult,
        userPulls: gasbox.userPulls,
        totalPulls: gasbox.totalPulls,
        machineCount: gasbox.machineCount,
        isPlayingDisplay: gasbox.isPlayingDisplay,
        selectedMachineName: gasbox.selectedMachineName,
      },
      loadData: gasbox.loadAll,
    };
  },
});
