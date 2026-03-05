<template>
  <!-- Empty state with create action -->
  <scroll-view v-if="isEmpty" scroll-y class="empty-state">
    <text class="empty-text">{{ t("empty.banks") }}</text>
    <button class="create-btn" @click="$emit('create')">{{ t("create.create_btn") }}</button>
  </scroll-view>

  <!-- FAB for creating new bank -->
  <view
    v-if="!isEmpty"
    class="fab"
    @click="$emit('create')"
    role="button"
    :aria-label="t('create.create_btn')"
  >
    <text class="fab-icon" aria-hidden="true">+</text>
  </view>
</template>

<script setup lang="ts">
defineProps<{
  isEmpty: boolean;
  t: (key: string, params?: Record<string, string | number>) => string;
}>();

defineEmits<{
  create: [];
}>();
</script>

<style scoped lang="scss">
@use "@shared/styles/tokens.scss" as *;

.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.empty-text {
  font-size: 16px;
  opacity: 0.5;
  margin-bottom: 20px;
}

.create-btn {
  background: linear-gradient(90deg, var(--piggy-accent-start), var(--piggy-accent-end));
  color: var(--piggy-accent-text);
  border: none;
  border-radius: 20px;
  padding: 10px 30px;
  font-weight: bold;
}

.fab {
  position: fixed;
  bottom: 80px;
  right: 20px;
  width: 56px;
  height: 56px;
  border-radius: 28px;
  background: linear-gradient(135deg, var(--piggy-accent-start), var(--piggy-accent-end));
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--piggy-fab-shadow);
  z-index: 100;

  &:active {
    transform: scale(0.9);
  }
}

.fab-icon {
  font-size: 28px;
  color: var(--piggy-accent-text);
  font-weight: bold;
}

@media (max-width: 767px) {
  .fab {
    right: 12px;
    bottom: 70px;
  }
}
</style>
