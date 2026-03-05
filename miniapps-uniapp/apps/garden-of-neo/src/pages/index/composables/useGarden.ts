import { ref, computed, onMounted, watch } from "vue";
import { useEvents } from "@neo/uniapp-sdk";
import { ownerMatchesAddress, parseStackItem } from "@shared/utils/neo";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";

export interface Plant {
  id: number;
  seedType: number;
  icon: string;
  name: string;
  growth: number;
  isMature: boolean;
  harvested: boolean;
}

export interface Plot {
  id: number;
  plant: Plant | null;
}

export interface Seed {
  id: number;
  name: string;
  icon: string;
  price: string;
  growTime: number;
}

const APP_ID = "miniapp-garden-of-neo";
const PLANT_FEE = "0.1";
const GROWTH_BLOCKS = 100;
const MAX_PLOTS = 9;

export function useGarden(
  t: (key: string) => string,
  contractAddress: () => string | null,
  ensureContractAddress: () => Promise<void>
) {
  const {
    address,
    ensureWallet,
    read,
    invoke,
    invokeDirectly,
    isProcessing: isLoading,
  } = useContractInteraction({ appId: APP_ID, t });
  const { list: listEvents } = useEvents();

  const createEmptyPlots = (): Plot[] => Array.from({ length: MAX_PLOTS }, (_, idx) => ({ id: idx + 1, plant: null }));

  const plots = ref<Plot[]>(createEmptyPlots());
  const { status: localStatus, setStatus: showStatus, clearStatus: clearLocalStatus } = useStatusMessage(3000);
  const totalHarvested = ref(0);
  const selectedPlot = ref<Plot | null>(null);
  const dataLoading = ref(false);
  const isHarvesting = ref(false);

  const seeds = computed<Seed[]>(() => [
    { id: 1, name: t("seedFire"), icon: "🔥", price: PLANT_FEE, growTime: GROWTH_BLOCKS },
    { id: 2, name: t("seedIce"), icon: "❄️", price: PLANT_FEE, growTime: GROWTH_BLOCKS },
    { id: 3, name: t("seedEarth"), icon: "🌱", price: PLANT_FEE, growTime: GROWTH_BLOCKS },
    { id: 4, name: t("seedWind"), icon: "🌬️", price: PLANT_FEE, growTime: GROWTH_BLOCKS },
    { id: 5, name: t("seedLight"), icon: "✨", price: PLANT_FEE, growTime: GROWTH_BLOCKS },
  ]);

  const totalPlants = computed(() => plots.value.filter((p) => p.plant).length);
  const readyToHarvest = computed(
    () => plots.value.filter((p) => p.plant && p.plant.isMature && !p.plant.harvested).length
  );
  const isBusy = computed(() => isLoading.value || dataLoading.value || isHarvesting.value);

  const ownerMatches = (value: unknown) => ownerMatchesAddress(value, address.value);

  const seedByType = (seedType: number) => seeds.value.find((seed) => seed.id === seedType);

  const buildPlant = async (plantId: number, seedType: number): Promise<Plant> => {
    const details = await read("getPlantDetails", [{ type: "Integer", value: plantId }], contractAddress()!);
    const data =
      details && typeof details === "object" && !Array.isArray(details) ? (details as Record<string, unknown>) : {};
    const actualSeedType = Number(data.seedType ?? seedType);
    const harvested = Boolean(data.harvested);
    const size = Number(data.growthPercent ?? (harvested ? 100 : 0));
    const isMature = Boolean(data.isMature ?? harvested);

    const seed = seedByType(actualSeedType);
    return {
      id: plantId,
      seedType: actualSeedType,
      icon: seed?.icon || "🌱",
      name: seed?.name || `Seed #${actualSeedType}`,
      growth: size,
      isMature,
      harvested,
    };
  };

  let emitStats: ((stats: { totalPlants: number; readyToHarvest: number; totalHarvested: number }) => void) | null =
    null;

  function setStatsEmitter(
    fn: (stats: { totalPlants: number; readyToHarvest: number; totalHarvested: number }) => void
  ) {
    emitStats = fn;
  }

  function emitUpdateStats() {
    emitStats?.({
      totalPlants: totalPlants.value,
      readyToHarvest: readyToHarvest.value,
      totalHarvested: totalHarvested.value,
    });
  }

  const loadGarden = async () => {
    await ensureContractAddress();
    const seedEvents = await listEvents({ app_id: APP_ID, event_name: "PlantSeeded", limit: 100 });
    const harvestEvents = await listEvents({ app_id: APP_ID, event_name: "PlantHarvested", limit: 100 });

    const harvestedIds = new Set<number>();
    harvestEvents.events.forEach((evt) => {
      const values = Array.isArray(evt?.state) ? (evt.state as unknown[]).map(parseStackItem) : [];
      if (!ownerMatches(values[0])) return;
      const plantId = Number(values[1] || 0);
      if (plantId > 0) harvestedIds.add(plantId);
    });
    totalHarvested.value = harvestedIds.size;

    if (!address.value) {
      plots.value = createEmptyPlots();
      emitUpdateStats();
      return;
    }

    const userPlants = seedEvents.events
      .map((evt) => {
        const values = Array.isArray(evt?.state) ? (evt.state as unknown[]).map(parseStackItem) : [];
        return { owner: values[0], plantId: Number(values[1] || 0), seedType: Number(values[2] || 0) };
      })
      .filter((entry) => entry.plantId > 0 && ownerMatches(entry.owner))
      .sort((a, b) => b.plantId - a.plantId);

    const plants: Plant[] = [];
    for (const plant of userPlants) {
      plants.push(await buildPlant(plant.plantId, plant.seedType));
    }

    const slots = createEmptyPlots();
    plants.slice(0, slots.length).forEach((plant, idx) => {
      slots[idx].plant = plant;
    });
    plots.value = slots;
    emitUpdateStats();
  };

  const refreshGarden = async () => {
    if (dataLoading.value) return;
    try {
      dataLoading.value = true;
      await loadGarden();
    } catch (e: unknown) {
      showStatus(formatErrorMessage(e, t("failedToLoad")), "error");
    } finally {
      dataLoading.value = false;
    }
  };

  const selectPlot = (plot: Plot) => {
    selectedPlot.value = plot;
    if (plot.plant && plot.plant.isMature && !plot.plant.harvested) {
      harvestPlant(plot.plant);
    }
  };

  const plantSeed = async (seed: Seed) => {
    const emptyPlot = plots.value.find((p) => !p.plant);
    if (!emptyPlot) {
      showStatus(t("noEmptyPlots"), "error");
      return;
    }
    if (isBusy.value) return;
    try {
      await ensureWallet();
      await ensureContractAddress();

      showStatus(t("plantingSeed"), "loading");
      await invoke(
        seed.price,
        `plant:${seed.id}`,
        "plant",
        [
          { type: "Hash160", value: address.value as string },
          { type: "Integer", value: seed.id },
          { type: "String", value: "" },
        ],
        contractAddress()!
      );
      showStatus(t("plantSuccess"), "success");
      await refreshGarden();
    } catch (e: unknown) {
      showStatus(formatErrorMessage(e, t("error")), "error");
    }
  };

  const harvestPlant = async (plant: Plant, skipRefresh = false) => {
    if (isHarvesting.value) return;
    try {
      await ensureWallet();
      await ensureContractAddress();

      isHarvesting.value = true;
      await invokeDirectly(
        "harvest",
        [
          { type: "Hash160", value: address.value as string },
          { type: "Integer", value: plant.id },
        ],
        contractAddress()!
      );
      showStatus(t("harvestSuccess"), "success");
      if (!skipRefresh) await refreshGarden();
    } catch (e: unknown) {
      showStatus(formatErrorMessage(e, t("error")), "error");
    } finally {
      isHarvesting.value = false;
    }
  };

  const harvestAll = async () => {
    const harvestTargets = plots.value
      .map((plot) => plot.plant)
      .filter((plant): plant is Plant => Boolean(plant && plant.isMature && !plant.harvested));

    if (!harvestTargets.length) {
      showStatus(t("noReady"), "error");
      return;
    }
    for (const plant of harvestTargets) {
      await harvestPlant(plant, true);
    }
    await refreshGarden();
  };

  onMounted(async () => {
    if (address.value) {
      await refreshGarden();
    }
  });

  watch(address, async () => {
    await refreshGarden();
  });

  return {
    plots,
    seeds,
    localStatus,
    isBusy,
    isHarvesting,
    clearLocalStatus,
    refreshGarden,
    selectPlot,
    plantSeed,
    harvestAll,
    setStatsEmitter,
  };
}
