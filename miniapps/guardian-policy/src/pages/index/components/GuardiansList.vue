<template>
  <NeoCard class="guardians-card" variant="erobo">
    <ItemList :items="guardians" item-key="id">
      <template #item="{ item: guardian }">
        <view class="guardian-item-glass">
          <view class="guardian-avatar-wrapper">
            <view class="guardian-avatar">{{ guardian.avatar }}</view>
            <view class="avatar-ring" :class="{ active: guardian.active }"></view>
          </view>

          <view class="guardian-details">
            <text class="guardian-name">{{ guardian.name }}</text>
            <text class="guardian-role">{{ guardian.role }}</text>
          </view>

          <view class="guardian-status">
            <view class="status-indicator" :class="{ active: guardian.active }">
              <view class="status-pulse" v-if="guardian.active"></view>
              <view class="status-dot"></view>
            </view>
          </view>
        </view>
      </template>
    </ItemList>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, ItemList } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

export interface Guardian {
  id: string;
  name: string;
  role: string;
  avatar: string;
  active: boolean;
}

defineProps<{
  guardians: Guardian[];
}>();

const { t } = createUseI18n(messages)();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.guardians-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.guardian-item-glass {
  @include card-base(12px, 16px);
  display: flex;
  align-items: center;
  gap: 16px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;

  &:hover {
    background: rgba(255, 255, 255, 0.06);
    transform: translateX(4px);
    border-color: var(--text-muted);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
  }
}

.guardian-avatar-wrapper {
  position: relative;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.guardian-avatar {
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  z-index: 2;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.avatar-ring {
  position: absolute;
  inset: 0;
  border: 1px dashed rgba(255, 255, 255, 0.2);
  border-radius: 50%;
  transition: all 0.3s;

  &.active {
    border-color: var(--ops-success);
    animation: spin-slow 10s linear infinite;
  }
}

.guardian-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.guardian-name {
  font-weight: 700;
  font-size: 14px;
  color: var(--text-primary);
  letter-spacing: 0.02em;
}

.guardian-role {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 0.05em;
  background: rgba(255, 255, 255, 0.05);
  align-self: flex-start;
  padding: 2px 6px;
  border-radius: 4px;
}

.guardian-status {
  display: flex;
  align-items: center;
}

.status-indicator {
  position: relative;
  width: 12px;
  height: 12px;
  display: flex;
  align-items: center;
  justify-content: center;

  &.active .status-dot {
    background: var(--ops-success);
    box-shadow: 0 0 10px rgba(0, 229, 153, 0.5);
  }
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  z-index: 2;
  transition: all 0.3s;
}

.status-pulse {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  background: rgba(0, 229, 153, 0.2);
  animation: pulse 2s infinite;
}

@keyframes spin-slow {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

@keyframes pulse {
  0% {
    transform: scale(1);
    opacity: 0.5;
  }
  100% {
    transform: scale(2);
    opacity: 0;
  }
}
</style>
