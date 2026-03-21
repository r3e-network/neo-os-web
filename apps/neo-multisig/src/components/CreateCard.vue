<template>
  <div class="create-section">
    <button type="button" class="create-btn" :aria-label="title" @click="$emit('create')">
      <div class="create-icon">
        <span class="plus-icon">+</span>
      </div>
      <div class="create-content">
        <span class="create-title">{{ title }}</span>
        <span class="create-desc">{{ description }}</span>
      </div>
      <span class="create-arrow" aria-hidden="true">→</span>
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
}>();

defineEmits<{
  create: [];
}>();
</script>

<style lang="scss" scoped>
.create-section {
  margin-bottom: 20px;
}

.create-btn {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--multi-action-gradient);
  border-radius: 16px;
  padding: 18px 20px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: var(--multi-action-shadow);
  border: none;
  appearance: none;
  width: 100%;
  text-align: left;

  &:active {
    transform: scale(0.98);
    box-shadow: var(--multi-action-shadow-press);
  }
}

.create-icon {
  width: 44px;
  height: 44px;
  background: var(--multi-icon-bg);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.plus-icon {
  font-size: 24px;
  font-weight: 700;
  color: var(--multi-text);
}

.create-content {
  flex: 1;
}

.create-title {
  display: block;
  font-size: 16px;
  font-weight: 700;
  color: var(--multi-text);
  margin-bottom: 4px;
}

.create-desc {
  display: block;
  font-size: 12px;
  color: var(--multi-text-muted);
}

.create-arrow {
  font-size: 20px;
  color: var(--multi-text-muted);
}
</style>
