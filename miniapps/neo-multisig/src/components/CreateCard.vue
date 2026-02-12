<template>
  <view class="create-section">
    <view class="create-btn" role="button" :aria-label="title" tabindex="0" @click="$emit('create')" @keydown.enter="$emit('create')">
      <view class="create-icon">
        <text class="plus-icon">+</text>
      </view>
      <view class="create-content">
        <text class="create-title">{{ title }}</text>
        <text class="create-desc">{{ description }}</text>
      </view>
      <text class="create-arrow">→</text>
    </view>
  </view>
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
