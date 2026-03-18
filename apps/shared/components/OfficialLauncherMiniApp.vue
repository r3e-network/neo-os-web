<template>
  <MiniAppPage
    :name="pageName"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="resetStatus"
  >
    <template #content>
      <div class="hero-shell">
        <HeroSection variant="accent" compact>
          <template #background>
            <div v-if="heroMode === 'bridge'" class="bridge-scene" aria-hidden="true">
              <div class="bridge-orb">{{ bridgeLeftLabel || "N3" }}</div>
              <div class="bridge-link" />
              <div class="bridge-orb">{{ bridgeRightLabel || "X" }}</div>
            </div>
            <div v-else class="flamingo-scene" aria-hidden="true">
              <div class="flamingo-mark">{{ heroMark || "F" }}</div>
              <div class="flamingo-trail" />
            </div>
          </template>
        </HeroSection>
        <div class="hero-copy">
          <span class="hero-kicker">{{ heroKicker }}</span>
          <h1 class="hero-title">{{ heroTitle }}</h1>
          <p class="hero-subtitle">{{ heroBlurb }}</p>
        </div>
      </div>

      <StatsDisplay :items="overviewStats" layout="grid" :columns="3" class="mb-6" />

      <NeoCard
        v-for="(card, idx) in mainCards"
        :key="`main-${idx}-${card.title}`"
        :variant="card.variant || 'erobo'"
        :title="card.title"
        :class="card.className"
      >
        <StatsDisplay v-if="card.stats?.length" :items="card.stats" layout="rows" />
        <template v-if="card.paragraphs?.length">
          <p v-for="(paragraph, pIdx) in card.paragraphs" :key="`p-${pIdx}`" class="copy-text">{{ paragraph }}</p>
        </template>
      </NeoCard>
    </template>

    <template #tab-details>
      <NeoCard
        v-for="(card, idx) in detailCards"
        :key="`detail-${idx}-${card.title}`"
        :variant="card.variant || 'erobo'"
        :title="card.title"
        :class="card.className"
      >
        <StatsDisplay v-if="card.stats?.length" :items="card.stats" layout="rows" />
        <template v-if="card.paragraphs?.length">
          <p v-for="(paragraph, pIdx) in card.paragraphs" :key="`dp-${pIdx}`" class="copy-text">{{ paragraph }}</p>
        </template>
      </NeoCard>
    </template>

    <template #operation>
      <NeoCard variant="erobo" :title="operationTitle">
        <div v-if="operationToggle?.options?.length" class="toggle-row">
          <NeoButton
            v-for="option in operationToggle.options"
            :key="option.key"
            size="sm"
            :variant="operationToggle.selectedKey === option.key ? 'primary' : 'secondary'"
            @click="option.onSelect()"
          >
            {{ option.label }}
          </NeoButton>
        </div>
        <div class="action-stack">
          <NeoButton
            v-for="action in operationActions"
            :key="`${action.label}-${action.variant || 'secondary'}`"
            :variant="action.variant || 'secondary'"
            @click="action.onClick()"
          >
            {{ action.label }}
          </NeoButton>
        </div>
      </NeoCard>
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { HeroSection, MiniAppPage, NeoButton, NeoCard, StatsDisplay } from "@shared/components";
import type { StatsDisplayItem, CardVariant } from "@shared/components";

type LauncherCard = {
  title: string;
  variant?: CardVariant;
  stats?: StatsDisplayItem[];
  paragraphs?: string[];
  className?: string;
};

type LauncherAction = {
  label: string;
  variant?: "primary" | "secondary";
  onClick: () => void;
};

type LauncherToggle = {
  selectedKey: string;
  options: Array<{
    key: string;
    label: string;
    onSelect: () => void;
  }>;
};

defineProps<{
  pageName: string;
  templateConfig: object;
  appState: Record<string, unknown>;
  t: (key: string) => string;
  status: unknown;
  sidebarItems: unknown;
  sidebarTitle: string;
  fallbackMessage: string;
  handleBoundaryError: (error: Error) => void;
  resetStatus: () => void;
  heroMode?: "flamingo" | "bridge";
  heroMark?: string;
  bridgeLeftLabel?: string;
  bridgeRightLabel?: string;
  heroKicker: string;
  heroTitle: string;
  heroBlurb: string;
  overviewStats: StatsDisplayItem[];
  mainCards: LauncherCard[];
  detailCards: LauncherCard[];
  operationTitle: string;
  operationActions: LauncherAction[];
  operationToggle?: LauncherToggle | null;
}>();
</script>

<style lang="scss" scoped>
.hero-shell {
  display: grid;
  gap: 18px;
  margin-bottom: 24px;
}

.hero-copy {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.hero-kicker {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #fb7185;
}

.hero-title {
  font-size: 30px;
  line-height: 1.05;
}

.hero-subtitle,
.copy-text {
  font-size: 14px;
  line-height: 1.7;
  color: rgba(255, 255, 255, 0.68);
}

.copy-text + .copy-text {
  margin-top: 10px;
}

.flamingo-scene,
.bridge-scene {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 96px;
}

.flamingo-scene {
  gap: 12px;
}

.bridge-scene {
  gap: 14px;
}

.flamingo-mark {
  width: 68px;
  height: 68px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 900;
  color: #0f172a;
  background: linear-gradient(180deg, #f97316 0%, #fb7185 100%);
  box-shadow: 0 16px 46px rgba(249, 115, 22, 0.24);
}

.flamingo-trail {
  width: 96px;
  height: 3px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(249, 115, 22, 0.15), rgba(251, 113, 133, 0.95), rgba(249, 115, 22, 0.15));
}

.bridge-orb {
  width: 66px;
  height: 66px;
  border-radius: 999px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 20px;
  letter-spacing: 0.08em;
  border: 1px solid var(--bridge-border, rgba(79, 209, 255, 0.16));
  background: linear-gradient(180deg, rgba(79, 209, 255, 0.18), rgba(79, 209, 255, 0.05));
  box-shadow: 0 14px 42px rgba(0, 0, 0, 0.24);
}

.bridge-link {
  width: 90px;
  height: 3px;
  border-radius: 999px;
  background: linear-gradient(90deg, rgba(79, 209, 255, 0.22), rgba(79, 209, 255, 0.9), rgba(79, 209, 255, 0.22));
}

.toggle-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  margin-bottom: 14px;
}

.action-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
