<template>
  <view class="archive-section">

      <view class="filter-chips">
        <text
          v-for="cat in categories"
          :key="cat.id"
          class="filter-chip"
          :class="{ active: selectedCategory === cat.id }"
          @click="selectedCategory = cat.id"
        >
          {{ cat.label }}
        </text>
      </view>


    <view v-if="filteredRecords.length === 0" class="empty-state">
      <text>{{ t("noRecords") }}</text>
    </view>

    <view class="timeline">
      <NeoCard
        v-for="record in filteredRecords"
        :key="record.id"
        :variant="record.active ? 'erobo-neo' : 'erobo'"
        class="mb-4"
        @click="$emit('view', record)"
      >
        <template #header-extra>
          <view class="flex gap-2">
            <view class="cat-badge" v-if="record.category">
              {{ getCategoryLabel(record.category) }}
            </view>
            <view class="status-badge" :class="record.active ? 'active' : 'inactive'">
              <text class="status-text">{{ record.active ? t("statusActive") : t("statusInactive") }}</text>
            </view>
          </view>
        </template>

        <view class="file-body">
          <text class="file-title font-bold block mb-2">{{ t("record") }} #{{ record.id }}</text>
          <view class="file-meta flex justify-between mb-2">
            <text class="file-date text-xs">{{ record.date }}</text>
          </view>
          <text class="file-desc text-sm opacity-80">{{ record.hashShort }}</text>
        </view>

        <template #footer>
          <view class="file-footer-neo flex justify-between items-center w-full">
            <text class="file-id text-xs opacity-60">{{ t("recordId") }}: {{ record.id }}</text>
            <text class="view-label font-bold">{{ t("tapToView") }} →</text>
          </view>
        </template>
      </NeoCard>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { NeoCard } from "@shared/components";
import type { RecordItem } from "./QueryRecordForm.vue";

const props = defineProps<{
  sortedRecords: RecordItem[];
  t: (key: string) => string;
}>();

defineEmits(["view"]);

const selectedCategory = ref(0);

const categories = computed(() => [
  { id: 0, label: props.t("catAll") },
  { id: 1, label: props.t("catGeneral") },
  { id: 2, label: props.t("catPhoto") },
  { id: 3, label: props.t("catLetter") },
  { id: 4, label: props.t("catVideo") },
  { id: 5, label: props.t("catAudio") },
]);

const filteredRecords = computed(() => {
  if (selectedCategory.value === 0) return props.sortedRecords;
  return props.sortedRecords.filter((r) => r.category === selectedCategory.value);
});

const getCategoryLabel = (id?: number) => {
  return categories.value.find((c) => c.id === id)?.label || props.t("unknown");
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.filter-section {
  margin-bottom: 20px;
}

.filter-chips {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 8px;
}

.filter-chip {
  padding: 6px 12px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  
  &.active {
    background: rgba(159, 157, 243, 0.2);
    border-color: #9f9df3;
    color: white;
  }
}

.section-header-neo {
  display: flex;
  align-items: center;
  gap: $space-3;
  padding: $space-2 0;
  margin-bottom: $space-4;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.section-icon { font-size: 20px; text-shadow: 0 0 10px rgba(255, 255, 255, 0.3); }
.section-title { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-primary); }

.file-body { padding: $space-2 0; }
.file-title {
  font-size: 16px; font-weight: 700; text-transform: uppercase; color: var(--text-primary);
  margin-bottom: 8px; letter-spacing: 0.05em;
}
.file-date { font-size: 10px; font-weight: 600; opacity: 0.6; font-family: $font-mono; color: var(--text-primary); }

.status-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 10px;
  text-transform: uppercase;
  font-weight: 700;
  &.active { background: rgba(0, 229, 153, 0.1); color: #00E599; border: 1px solid rgba(0, 229, 153, 0.2); }
  &.inactive { background: rgba(255, 255, 255, 0.1); color: var(--text-secondary); }
}

.cat-badge {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 10px;
  text-transform: uppercase;
  font-weight: 700;
  background: rgba(159, 157, 243, 0.1); 
  color: #9f9df3; 
  border: 1px solid rgba(159, 157, 243, 0.2);
}

.file-footer-neo {
  display: flex; justify-content: space-between; align-items: center; padding-top: $space-3;
  border-top: 1px solid rgba(255, 255, 255, 0.1); margin-top: $space-3;
}
.view-label { font-size: 11px; font-weight: 700; text-transform: uppercase; color: #9f9df3; }
.file-id { color: var(--text-secondary); font-family: $font-mono; }

.empty-state { text-align: center; padding: 32px; opacity: 0.5; font-style: italic; }
</style>
