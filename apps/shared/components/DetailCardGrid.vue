<template>
  <div class="detail-grid" :class="columnsClass" role="list" :aria-label="t('detailsLabel')">
    <div v-for="item in items" :key="item.label" class="detail-card" role="listitem" :aria-label="`${item.label}: ${item.value}`">
      <span class="detail-label">{{ item.label }}</span>
      <span class="detail-value">{{ item.value }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { createUseI18n } from "@shared/composables";
import { messages } from "@shared/locale/messages";

const { t } = createUseI18n(messages)();

const props = withDefaults(defineProps<{
  items: Array<{ label: string; value: string | number }>;
  columns?: 2 | 3;
}>(), {
  columns: 2,
});

const columnsClass = computed(() => `detail-grid--cols-${props.columns}`);
</script>

<style scoped lang="scss">
@use "@shared/styles/console-common" as console;

.detail-grid {
  @include console.detail-grid;

  &--cols-3 {
    @include console.detail-grid(3, 900px);
  }
}

.detail-card {
  @include console.detail-card;
}

.detail-label {
  @include console.label;
  letter-spacing: 0.12em;
}

.detail-value {
  @include console.value;
  margin-top: 8px;
}
</style>
