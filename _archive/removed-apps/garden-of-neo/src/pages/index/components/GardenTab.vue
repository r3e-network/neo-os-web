<template>
  <div class="tab-container-glass">
    <NeoCard
      v-if="localStatus"
      :variant="localStatus.type === 'error' ? 'danger' : 'erobo-neo'"
      class="mb-4 text-center"
    >
      <span class="status-text-glass">{{ localStatus.msg }}</span>
    </NeoCard>

    <GardenGrid :plots="plots" :ready-label="t('ready')" :empty-label="t('noEmptyPlots')" @select="selectPlot" />

    <SeedList :seeds="seeds" :hours-label="t('hoursToGrow')" @plant="plantSeed" />

    <NeoCard variant="erobo-bitcoin" class="mb-4">
      <div class="action-btns-glass flex gap-3">
        <NeoButton variant="primary" size="md" block :loading="isBusy" @click="refreshGarden">
          🔄 {{ isBusy ? t("refreshing") : t("refreshStatus") }}
        </NeoButton>
        <NeoButton variant="secondary" size="md" block :disabled="isBusy" @click="harvestAll">
          🌾 {{ isHarvesting ? t("harvesting") : t("harvestReady") }}
        </NeoButton>
      </div>
    </NeoCard>
    <Fireworks :active="localStatus?.type === 'success'" :duration="3000" />
  </div>
</template>

<script setup lang="ts">
import { NeoButton, NeoCard, Fireworks } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";
import GardenGrid from "./GardenGrid.vue";
import SeedList from "./SeedList.vue";
import { useGarden } from "../composables/useGarden";

const props = defineProps<{
  contractAddress: string | null;
  ensureContractAddress: () => Promise<void>;
}>();

const { t } = createUseI18n(messages)();

const emit = defineEmits<{
  (e: "update:stats", stats: { totalPlants: number; readyToHarvest: number; totalHarvested: number }): void;
}>();

const {
  plots,
  seeds,
  localStatus,
  isBusy,
  isHarvesting,
  refreshGarden,
  selectPlot,
  plantSeed,
  harvestAll,
  setStatsEmitter,
} = useGarden(t, () => props.contractAddress, props.ensureContractAddress);

setStatsEmitter((stats) => emit("update:stats", stats));
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.tab-container-glass {
  padding: $spacing-4;
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
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

.action-btns-glass {
  display: flex;
  gap: $spacing-4;
}
</style>
