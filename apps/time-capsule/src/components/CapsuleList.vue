<template>
  <div class="capsule-list-container">
    <div v-if="totalCapsules === 0" class="empty-state">
      <span>{{ t("noCapsules", { fallback: "No capsules yet" }) }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  totalCapsules: number;
}>();
</script>

<style lang="scss" scoped>
.empty-state {
  text-align: center;
  padding: 24px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 14px;
}
</style>
