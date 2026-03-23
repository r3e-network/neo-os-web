<template>
  <button type="button" class="tombstone-card" :aria-label="memorial.name + ' (' + memorial.birthYear + t('yearSeparator') + memorial.deathYear + ')'" @click="$emit('click')">
    <div class="tombstone-top">
      <div class="photo-frame" v-if="memorial.photoHash">
        <img :src="memorial.photoHash" mode="aspectFill" :alt="memorial.name?.trim() || t('memorialPhoto')" />
      </div>
      <div class="icon-frame" v-else>
        <span class="candle-icon" :class="{ burning: memorial.hasRecentTribute }">
          <AppIcon name="candle" :size="24" aria-hidden="true" />
        </span>
      </div>
    </div>
    <div class="tombstone-body">
      <span class="name">{{ memorial.name }}</span>
      <span class="years">{{ memorial.birthYear }}{{ t("yearRangeSeparator") }}{{ memorial.deathYear }}</span>
      <span class="candle" :class="{ burning: memorial.hasRecentTribute }">
        <AppIcon name="candle" :size="20" aria-hidden="true" />
      </span>
    </div>
  </button>
</template>

<script setup lang="ts">
import type { Memorial } from "@/types";
import { AppIcon } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

const { t } = createUseI18n(messages)();

defineProps<{
  memorial: Memorial;
}>();

defineEmits<{
  click: [];
}>();
</script>

<style lang="scss" scoped>

.tombstone-card {
  width: 140px;
  cursor: pointer;
  transition: transform 0.3s;
  appearance: none;
  background: transparent;
  border: none;
  padding: 0;
  text-align: left;

  &:active {
    transform: translateY(-4px);
  }
}

.tombstone-top {
  display: flex;
  justify-content: center;
  margin-bottom: 8px;
}

.photo-frame {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: 2px solid var(--shrine-gold);
  overflow: hidden;
  
  image {
    width: 100%;
    height: 100%;
  }
}

.icon-frame {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: 2px solid var(--shrine-gold-border-soft);
  display: flex;
  align-items: center;
  justify-content: center;
  background: radial-gradient(circle, var(--shrine-gold-soft), transparent);
}

.candle-icon {
  font-size: 24px;
  opacity: 0.6;
  
  &.burning {
    animation: glow 2s ease-in-out infinite;
  }
}

.tombstone-body {
  background: var(--shrine-card);
  border-radius: 40px 40px 4px 4px;
  padding: 16px 12px 20px;
  text-align: center;
  border: 1px solid var(--shrine-card-border);
  box-shadow: var(--shrine-card-shadow);
}

.name {
  display: block;
  font-size: 16px;
  font-weight: 600;
  color: var(--shrine-gold-light);
  margin-bottom: 4px;
}

.years {
  display: block;
  font-size: 11px;
  color: var(--shrine-muted);
  margin-bottom: 8px;
}

.candle {
  font-size: 20px;
  opacity: 0.6;
  
  &.burning {
    animation: glow 2s ease-in-out infinite;
  }
}

@keyframes glow {
  0%, 100% {
    filter: drop-shadow(0 0 4px var(--shrine-incense));
    opacity: 0.8;
  }
  50% {
    filter: drop-shadow(0 0 12px var(--shrine-incense));
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .candle-icon.burning,
  .candle.burning {
    animation: none;
  }
}
</style>
