/**
 * GasBox — Entry Point (New Pattern)
 *
 * Uses defineMiniApp() to wire the gacha composables to the platform.
 * All composables receive ChainService/EventBus from PlatformServices.
 */

import { computed, watch } from "vue";
import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useGachaMachines } from "./composables/useGachaMachines";
import { useGachaPlay } from "./composables/useGachaPlay";
import { useGachaWallet } from "./composables/useGachaWallet";
import { useGachaManagement } from "./composables/useGachaManagement";
import { useGachaPublish } from "./composables/useGachaPublish";
import type { Machine } from "./types";

defineMiniApp({
  appId: "miniapp-gasbox",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const platformServices = PlatformServices.create("miniapp-gasbox", {
      t: ctx.t as (key: string) => string,
    });

    const { chain, events: eventBus } = platformServices;

    const {
      machines,
      selectedMachine,
      isLoadingMachines,
      loadMachines,
      selectMachine,
      setActionLoading,
      actionLoading,
      walletHash,
      contractAddress,
    } = useGachaMachines({ chain, t: ctx.t });

    const { isPlaying, showResult, resultItem, playError, showFireworks, resetResult, playMachine, buyMachine } =
      useGachaPlay({ chain, eventBus, t: ctx.t });

    const { address, requestWallet, handleWalletConnect } = useGachaWallet({ chain, t: ctx.t });

    const {
      updateMachinePrice,
      toggleMachineActive,
      toggleMachineListed,
      listMachineForSale,
      cancelMachineSale,
      depositItem,
      withdrawItem,
    } = useGachaManagement({ chain, t: ctx.t });

    const { isPublishing, publishMachine } = useGachaPublish({ chain, eventBus, t: ctx.t });

    // Derived display values for manifest bindings
    const machineCount = computed(() => machines.value.length);
    const isPlayingDisplay = computed(() => (isPlaying.value ? ctx.t("yes") : ctx.t("no")));
    const selectedMachineName = computed(() => selectedMachine.value?.name || ctx.t("none"));

    const requireAddress = async () => {
      if (!address.value) {
        requestWallet(ctx.t("connectWallet"));
        return false;
      }
      return true;
    };

    const ensureContract = () => contractAddress.value;

    // Register actions
    ctx.registerAction("selectMachine", (machine: Machine) => {
      selectMachine(machine);
    });

    ctx.registerAction("deselectMachine", () => {
      selectedMachine.value = null;
    });

    ctx.registerAction("browseAll", () => {
      // Tab navigation handled by platform
    });

    ctx.registerAction("play", async () => {
      if (!selectedMachine.value) return;
      await playMachine(selectedMachine.value, {
        requireAddress,
        ensureContract,
        onSuccess: loadMachines,
      });
    });

    ctx.registerAction("closeResult", () => {
      resetResult();
    });

    ctx.registerAction("buy", async () => {
      if (!selectedMachine.value) return;
      await buyMachine(selectedMachine.value, {
        requireAddress,
        ensureContract,
        setLoading: setActionLoading,
        onSuccess: loadMachines,
      });
    });

    ctx.registerAction("publish", async (machineData: {
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
    }) => {
      if (!(await requireAddress())) return;
      await publishMachine(machineData, {
        requireAddress,
        setStatus: (msg: string, type: string) => ctx.setStatus(msg, type as "success" | "error" | "loading"),
        onSuccess: loadMachines,
      });
    });

    ctx.registerAction("connectWallet", async () => {
      await handleWalletConnect();
    });

    // Auto-load when address changes
    const stopAddressWatch = watch(
      address,
      () => { loadMachines(); },
      { immediate: true },
    );

    return {
      state: {
        // Manifest-bound stats/sidebar values
        machineCount,
        isPlayingDisplay,
        selectedMachineName,

        // PlayArea state
        machines,
        selectedMachine,
        isLoadingMachines,
        walletHash,
        isPlaying,
        showResult,
        resultItem,
        playError,
        showFireworks,
        address,
        actionLoading,
        isPublishing,
      },

      loadData: loadMachines,

      cleanup: () => {
        stopAddressWatch();
        platformServices.destroy();
      },
    };
  },
});
