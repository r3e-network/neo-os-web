<template>
  <div class="top-navbar" role="navigation" :aria-label="title || 'Top navigation'">
    <div class="nav-left">
      <div
        v-if="showBack"
        class="nav-btn"
        role="button"
        tabindex="0"
        aria-label="Go back"
        @click="$emit('back')"
        @keydown.enter="$emit('back')"
        @keydown.space.prevent="$emit('back')"
      >
        <AppIcon name="arrow-left" :size="20" />
      </div>
    </div>
    <div class="nav-center">
      <span class="nav-title">{{ title }}</span>
    </div>
    <div class="nav-right">
      <slot name="right" />
    </div>
  </div>
</template>

<script setup lang="ts">
import AppIcon from "./AppIcon.vue";

defineProps<{
  title: string;
  showBack?: boolean;
}>();

defineEmits<{
  (e: "back"): void;
}>();
</script>

<style lang="scss">
@use "../styles/tokens.scss" as *;

.top-navbar {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  background: var(--bg-card, rgba(12, 13, 22, 0.8));
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border-color, rgba(159, 157, 243, 0.18));
  flex-shrink: 0;
  box-shadow: 0 4px 20px var(--shadow-color, rgba(0, 0, 0, 0.1));
  z-index: 10;
}

.nav-left,
.nav-right {
  width: 60px;
  display: flex;
  align-items: center;
}

.nav-right {
  justify-content: flex-end;
}

.nav-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  color: var(--text-primary, #ffffff);
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid var(--border-color, rgba(159, 157, 243, 0.18));
  transition: all 0.2s ease;
  cursor: pointer;

  &:hover {
    background: rgba(255, 255, 255, 0.18);
  }

  &:active {
    transform: scale(0.95);
    background: rgba(255, 255, 255, 0.2);
  }

  &:focus-visible {
    outline: 2px solid var(--accent-primary, #3b82f6);
    outline-offset: 2px;
  }
}

.nav-center {
  flex: 1;
  text-align: center;
}

.nav-title {
  font-size: 16px;
  font-weight: 800;
  font-family: $font-family;
  color: var(--text-primary, #ffffff);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

@media (prefers-reduced-motion: reduce) {
  .nav-btn {
    transition: none;

    &:active {
      transform: none;
    }
  }
}
</style>
