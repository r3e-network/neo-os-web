<template>
  <view class="tombstone-card" @click="$emit('click')">
    <view class="tombstone-top">
      <view class="photo-frame" v-if="memorial.photoHash">
        <image :src="memorial.photoHash" mode="aspectFill" :alt="memorial.name || t('memorialPhoto')" />
      </view>
      <view class="icon-frame" v-else>
        <text class="candle-icon" :class="{ burning: memorial.hasRecentTribute }">🕯️</text>
      </view>
    </view>
    <view class="tombstone-body">
      <text class="name">{{ memorial.name }}</text>
      <text class="years">{{ memorial.birthYear }} - {{ memorial.deathYear }}</text>
      <text class="candle" :class="{ burning: memorial.hasRecentTribute }">🕯️</text>
    </view>
  </view>
</template>

<script setup lang="ts">
interface Memorial {
  id: number;
  name: string;
  photoHash: string;
  birthYear: number;
  deathYear: number;
  hasRecentTribute: boolean;
}

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
</style>
