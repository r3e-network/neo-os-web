<template>
  <view class="tab-container-glass">
    <NeoCard v-if="localStatus" :variant="localStatus.type === 'error' ? 'danger' : 'erobo-neo'" class="mb-4 text-center">
      <text class="status-text-glass">{{ localStatus.msg }}</text>
    </NeoCard>

    <NeoCard variant="erobo-neo" class="garden-card-glass">
      <view class="garden-container-glass">
        <view class="garden-grid-glass">
          <view
            v-for="plot in plots"
            :key="plot.id"
            class="plot-glass"
            :class="[{ empty: !plot.plant }, plot.plant ? getGrowthStage(plot.plant.growth) : '']"
            @click="selectPlot(plot)"
          >
            <view v-if="plot.plant" class="plant-box-glass">
              <text class="plant-icon-glass" :class="{ ready: plot.plant.growth >= 100 }">
                {{ plot.plant.icon }}
              </text>
              <view v-if="plot.plant.growth >= 100" class="ready-sticker-glass">{{ t("ready") }}</view>
            </view>
            <text v-else class="empty-icon-glass">🕳️</text>
            <view v-if="plot.plant" class="growth-label-glass">
              <text class="growth-text-glass">{{ Math.floor(plot.plant.growth) }}%</text>
            </view>
          </view>
        </view>
      </view>
    </NeoCard>

    <NeoCard variant="erobo" class="mb-4">
      <view class="seeds-list">
        <view v-for="seed in seeds" :key="seed.id" class="seed-item-glass" @click="plantSeed(seed)">
          <view class="seed-icon-wrapper-glass">
            <text class="seed-icon">{{ seed.icon }}</text>
          </view>
          <view class="seed-info">
            <text class="seed-name-glass">{{ seed.name }}</text>
            <text class="seed-time-glass">⏱ {{ seed.growTime }}{{ t("hoursToGrow") }}</text>
          </view>
          <view class="seed-price-tag-glass">
            <text class="seed-price-glass">{{ seed.price }}</text>
            <text class="seed-currency-glass">GAS</text>
          </view>
        </view>
      </view>
    </NeoCard>

    <NeoCard variant="erobo-bitcoin" class="mb-4">
      <view class="action-btns-glass flex gap-3">
        <NeoButton variant="primary" size="md" block :loading="isBusy" @click="refreshGarden">
          🔄 {{ isBusy ? t("refreshing") : t("refreshStatus") }}
        </NeoButton>
        <NeoButton variant="secondary" size="md" block :disabled="isBusy" @click="harvestAll">
          🌾 {{ isHarvesting ? t("harvesting") : t("harvestReady") }}
        </NeoButton>
      </view>
    </NeoCard>
    <Fireworks :active="localStatus?.type === 'success'" :duration="3000" />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useWallet, usePayments, useEvents } from "@neo/uniapp-sdk";
import { addressToScriptHash, normalizeScriptHash, parseInvokeResult, parseStackItem } from "@shared/utils/neo";
import { NeoButton, NeoCard, Fireworks } from "@shared/components";

const props = defineProps<{
  t: (key: string) => string;
  contractAddress: string | null;
  ensureContractAddress: () => Promise<void>;
}>();

const emit = defineEmits<{
  (e: "update:stats", stats: { totalPlants: number; readyToHarvest: number; totalHarvested: number }): void;
}>();

const APP_ID = "miniapp-garden-of-neo";
const PLANT_FEE = "0.1";
const GROWTH_BLOCKS = 100;
const MAX_PLOTS = 9;

const { address, connect, invokeRead, invokeContract } = useWallet();
const { payGAS, isLoading } = usePayments(APP_ID);
const { list: listEvents } = useEvents();

interface Plant {
  id: number;
  seedType: number;
  icon: string;
  name: string;
  growth: number;
  isMature: boolean;
  harvested: boolean;
}

interface Plot {
  id: number;
  plant: Plant | null;
}

const createEmptyPlots = (): Plot[] => Array.from({ length: MAX_PLOTS }, (_, idx) => ({ id: idx + 1, plant: null }));

const plots = ref<Plot[]>(createEmptyPlots());

const seeds = computed(() => [
  { id: 1, name: props.t("seedFire"), icon: "🔥", price: PLANT_FEE, growTime: GROWTH_BLOCKS },
  { id: 2, name: props.t("seedIce"), icon: "❄️", price: PLANT_FEE, growTime: GROWTH_BLOCKS },
  { id: 3, name: props.t("seedEarth"), icon: "🌱", price: PLANT_FEE, growTime: GROWTH_BLOCKS },
  { id: 4, name: props.t("seedWind"), icon: "🌬️", price: PLANT_FEE, growTime: GROWTH_BLOCKS },
  { id: 5, name: props.t("seedLight"), icon: "✨", price: PLANT_FEE, growTime: GROWTH_BLOCKS },
]);

const localStatus = ref<{ msg: string; type: string } | null>(null);
const totalHarvested = ref(0);
const selectedPlot = ref<Plot | null>(null);
const dataLoading = ref(false);
const isHarvesting = ref(false);

const totalPlants = computed(() => plots.value.filter((p) => p.plant).length);
const readyToHarvest = computed(
  () => plots.value.filter((p) => p.plant && p.plant.isMature && !p.plant.harvested).length,
);
const isBusy = computed(() => isLoading.value || dataLoading.value || isHarvesting.value);

const getGrowthStage = (growth: number): string => {
  if (growth >= 100) return "stage-mature";
  if (growth >= 75) return "stage-blooming";
  if (growth >= 50) return "stage-growing";
  if (growth >= 25) return "stage-sprouting";
  return "stage-seedling";
};

const showStatus = (msg: string, type: string) => {
  localStatus.value = { msg, type };
  setTimeout(() => {
    localStatus.value = null;
  }, 3000);
};

const ownerMatches = (value: unknown) => {
  if (!address.value) return false;
  const val = String(value || "");
  if (val === address.value) return true;
  const normalized = normalizeScriptHash(val);
  const addrHash = addressToScriptHash(address.value);
  return Boolean(normalized && addrHash && normalized === addrHash);
};

const seedByType = (seedType: number) => seeds.value.find((seed) => seed.id === seedType);

const buildPlant = async (plantId: number, seedType: number): Promise<Plant> => {
  const detailsRes = await invokeRead({
    contractHash: props.contractAddress!,
    operation: "getPlantDetails",
    args: [{ type: "Integer", value: plantId }],
  });
  const details = parseInvokeResult(detailsRes);
  const data =
    details && typeof details === "object" && !Array.isArray(details) ? (details as Record<string, any>) : {};
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

const loadGarden = async () => {
  await props.ensureContractAddress();
  const seedEvents = await listEvents({ app_id: APP_ID, event_name: "PlantSeeded", limit: 100 });
  const harvestEvents = await listEvents({ app_id: APP_ID, event_name: "PlantHarvested", limit: 100 });

  const harvestedIds = new Set<number>();
  harvestEvents.events.forEach((evt: any) => {
    const values = Array.isArray(evt?.state) ? evt.state.map(parseStackItem) : [];
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
    .map((evt: any) => {
      const values = Array.isArray(evt?.state) ? evt.state.map(parseStackItem) : [];
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

function emitUpdateStats() {
  emit("update:stats", {
    totalPlants: totalPlants.value,
    readyToHarvest: readyToHarvest.value,
    totalHarvested: totalHarvested.value,
  });
}

const refreshGarden = async () => {
  if (dataLoading.value) return;
  try {
    dataLoading.value = true;
    await loadGarden();
  } catch (e: any) {
    showStatus(e.message || props.t("failedToLoad"), "error");
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

const plantSeed = async (seed: { id: number; name: string; icon: string; price: string }) => {
  const emptyPlot = plots.value.find((p) => !p.plant);
  if (!emptyPlot) {
    showStatus(props.t("noEmptyPlots"), "error");
    return;
  }
  if (isBusy.value) return;
  try {
    if (!address.value) await connect();
    if (!address.value) throw new Error(props.t("connectWallet"));
    await props.ensureContractAddress();

    showStatus(props.t("plantingSeed"), "loading");
    const payment = await payGAS(seed.price, `plant:${seed.id}`);
    const receiptId = payment.receipt_id;
    if (!receiptId) throw new Error(props.t("receiptMissing"));

    await invokeContract({
      scriptHash: props.contractAddress!,
      operation: "plant",
      args: [
        { type: "Hash160", value: address.value },
        { type: "Integer", value: seed.id },
        { type: "String", value: "" },
        { type: "Integer", value: receiptId },
      ],
    });
    showStatus(props.t("plantSuccess"), "success");
    await refreshGarden();
  } catch (e: any) {
    showStatus(e.message || props.t("error"), "error");
  }
};

const harvestPlant = async (plant: Plant, skipRefresh = false) => {
  if (isHarvesting.value) return;
  try {
    if (!address.value) await connect();
    if (!address.value) throw new Error(props.t("connectWallet"));
    await props.ensureContractAddress();

    isHarvesting.value = true;
    await invokeContract({
      scriptHash: props.contractAddress!,
      operation: "harvest",
      args: [
        { type: "Hash160", value: address.value },
        { type: "Integer", value: plant.id },
      ],
    });
    showStatus(props.t("harvestSuccess"), "success");
    if (!skipRefresh) await refreshGarden();
  } catch (e: any) {
    showStatus(e.message || props.t("error"), "error");
  } finally {
    isHarvesting.value = false;
  }
};

const harvestAll = async () => {
  const harvestTargets = plots.value
    .map((plot) => plot.plant)
    .filter((plant): plant is Plant => Boolean(plant && plant.isMature && !plant.harvested));

  if (!harvestTargets.length) {
    showStatus(props.t("noReady"), "error");
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
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.tab-container-glass {
  padding: $space-4;
  display: flex;
  flex-direction: column;
  gap: $space-4;
  background: transparent;
  color: var(--text-primary);
}

.status-text-glass {
  font-weight: $font-weight-bold;
  text-transform: uppercase;
  color: inherit;
  letter-spacing: 0.05em;
  font-size: 14px;
}

.garden-card-glass {
  margin-bottom: $space-6;
}

.garden-grid-glass {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: $space-4;
  padding: $space-2;
}

.plot-glass {
  aspect-ratio: 1;
  background: var(--garden-plot-bg);
  border: 1px solid var(--garden-plot-border);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  transition: all 0.3s ease;
  backdrop-filter: blur(5px);
  box-shadow: var(--garden-plot-shadow);

  &.empty {
    border-style: dashed;
    border-color: var(--garden-plot-empty-border);
    background: var(--garden-plot-empty-bg);
    opacity: 0.7;
    
    &:hover {
      background: var(--garden-plot-empty-hover-bg);
      border-color: var(--text-secondary);
      opacity: 1;
    }
  }

  &:active {
    transform: scale(0.95);
  }

  &.stage-seedling {
    background: var(--garden-stage-seedling-bg);
    border-color: var(--garden-stage-seedling-border);
  }
  &.stage-sprouting {
    background: var(--garden-stage-sprouting-bg);
    border-color: var(--garden-stage-sprouting-border);
  }
  &.stage-growing {
    background: var(--garden-stage-growing-bg);
    border-color: var(--garden-stage-growing-border);
  }
  &.stage-blooming {
    background: var(--garden-stage-blooming-bg);
    border-color: var(--garden-stage-blooming-border);
  }
  &.stage-mature {
    background: var(--garden-stage-mature-bg);
    border-color: var(--garden-stage-mature-border);
    box-shadow: var(--garden-stage-mature-shadow);
  }
}

.plant-icon-glass {
  font-size: 48px;
  filter: drop-shadow(var(--garden-plant-shadow));
  &.ready {
    animation: glass-bounce 1.5s infinite ease-in-out;
  }
}

@keyframes glass-bounce {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-5px); }
}

.ready-sticker-glass {
  position: absolute;
  top: -8px;
  right: -8px;
  background: linear-gradient(135deg, var(--garden-ready-start), var(--garden-ready-end));
  color: var(--garden-ready-text);
  font-size: 10px;
  font-weight: $font-weight-black;
  padding: 4px 8px;
  border-radius: 12px;
  box-shadow: var(--garden-ready-shadow);
  z-index: 10;
}

.empty-icon-glass {
  font-size: 24px;
  opacity: 0.5;
}

.growth-label-glass {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--garden-growth-bg);
  padding: 4px;
  border-bottom-left-radius: 12px;
  border-bottom-right-radius: 12px;
  text-align: center;
}
.growth-text-glass {
  color: var(--text-primary);
  font-size: 10px;
  font-weight: $font-weight-bold;
  font-family: $font-mono;
}

.seeds-list {
  display: flex;
  flex-direction: column;
  gap: $space-6;
}

.seed-item-glass {
  display: flex;
  align-items: center;
  gap: $space-6;
  padding: $space-4;
  background: var(--garden-seed-item-bg);
  border: 1px solid var(--garden-seed-item-border);
  border-radius: 16px;
  cursor: pointer;
  transition: all 0.2s ease;
  backdrop-filter: blur(5px);
  
  &:active {
    background: var(--garden-seed-item-active-bg);
    transform: scale(0.98);
  }
}

.seed-icon-wrapper-glass {
  width: 56px;
  height: 56px;
  background: var(--garden-seed-icon-bg);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--garden-seed-icon-border);
}

.seed-icon {
  font-size: 28px;
}
.seed-info {
  flex: 1;
}
.seed-name-glass {
  font-size: 16px;
  font-weight: $font-weight-bold;
  text-transform: uppercase;
  color: var(--text-primary);
  display: block;
}
.seed-time-glass {
  font-size: 12px;
  font-weight: $font-weight-medium;
  color: var(--text-secondary);
  margin-top: 4px;
  display: inline-block;
  background: var(--garden-seed-time-bg);
  padding: 2px 8px;
  border-radius: 12px;
}

.seed-price-tag-glass {
  background: var(--garden-price-bg);
  border: 1px solid var(--garden-price-border);
  color: var(--garden-price-text);
  padding: 8px 12px;
  border-radius: 12px;
  text-align: right;
  min-width: 80px;
}

.seed-price-glass {
  font-size: 18px;
  font-weight: $font-weight-black;
  line-height: 1;
  display: block;
}
.seed-currency-glass {
  font-size: 10px;
  font-weight: $font-weight-bold;
  opacity: 0.8;
}

.action-btns-glass {
  display: flex;
  gap: $space-4;
}
</style>
