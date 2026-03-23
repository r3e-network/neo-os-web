<template>
  <NeoCard variant="erobo">
    <ItemList :items="developers" item-key="id">
      <template #item="{ item: dev }">
        <button type="button" class="dev-card-glass" :aria-label="dev.name" @click="$emit('select', dev)">
          <div class="dev-card-header">
            <div class="dev-avatar-glass">
              <AppIcon name="user" :size="28" class="avatar-emoji" aria-hidden="true" />
              <div class="avatar-badge-glass">{{ dev.rank }}</div>
            </div>
            <div class="dev-info">
              <span class="dev-name-glass">{{ dev.name }}</span>
              <span class="dev-projects-glass">
                <AppIcon name="puzzle" :size="10" class="project-icon" aria-hidden="true" />
                {{ dev.role }}
              </span>
              <span class="dev-contributions-glass">{{ dev.tipCount }} {{ t("tipsCount") }}</span>
            </div>
          </div>
          <div class="dev-card-footer-glass">
            <div class="tip-stats">
              <span class="tip-label-glass">{{ t("totalTips") }}</span>
              <span class="tip-amount-glass">{{ formatNum(dev.totalTips) }} {{ t("tokenGas") }}</span>
            </div>
            <div class="tip-action">
              <AppIcon name="heart" :size="18" class="tip-icon text-glass" aria-hidden="true" />
            </div>
          </div>
        </button>
      </template>
    </ItemList>
  </NeoCard>
</template>

<script setup lang="ts">
import AppIcon from "@shared/components/AppIcon.vue";
import { NeoCard, ItemList } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";
import type { Developer } from "../composables/useDevTippingStats";

const { t } = createUseI18n(messages)();

interface Props {
  developers: Developer[];
  formatNum: (n: number) => string;
}

defineProps<Props>();

defineEmits<{
  select: [dev: Developer];
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/mixins.scss" as *;

.dev-card-glass {
  background: var(--cafe-panel-weak);
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--cafe-panel-border);
  margin-bottom: 16px;
  cursor: pointer;
  transition: all 0.2s;
  appearance: none;
  border: none;
  text-align: left;
  width: 100%;
  display: block;

  &:active {
    background: var(--cafe-panel-hover);
  }
}

@media (max-width: 480px) {
  .dev-card-glass {
    padding: 12px;
    margin-bottom: 10px;
    border-radius: 10px;
  }

  .dev-avatar-glass {
    width: 44px;
    height: 44px;
    font-size: 22px;
  }

  .avatar-badge-glass {
    font-size: 8px;
    padding: 2px 4px;
  }
}

.dev-card-header {
  display: flex;
  gap: 16px;
  align-items: center;
}

.dev-avatar-glass {
  width: 56px;
  height: 56px;
  background: var(--cafe-avatar-bg);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--cafe-neon);
  font-size: 28px;
  position: relative;
}

.avatar-badge-glass {
  position: absolute;
  bottom: -6px;
  right: -6px;
  background: var(--cafe-neon);
  color: var(--cafe-badge-text);
  font-size: 10px;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 4px;
  box-shadow: var(--cafe-badge-shadow);
}

.dev-info {
  flex: 1;
}

.dev-name-glass {
  @include mono-number(16px);
  font-weight: 800;
  color: var(--cafe-text-strong);
  display: block;
}

.dev-projects-glass {
  font-size: 10px;
  color: var(--cafe-neon);
  border: 1px solid var(--cafe-secondary-border);
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
  margin-top: 4px;
  font-weight: bold;
  text-transform: uppercase;
}

.dev-contributions-glass {
  font-size: 10px;
  color: var(--cafe-muted);
  display: block;
  margin-top: 4px;
}

.dev-card-footer-glass {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--cafe-dash-border);
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.tip-label-glass {
  @include stat-label;
  font-size: 10px;
  color: var(--cafe-muted);
}

.tip-amount-glass {
  @include mono-number(18px);
  color: var(--cafe-neon);
  text-shadow: var(--cafe-neon-glow);
}
</style>
