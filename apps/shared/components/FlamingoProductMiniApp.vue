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
            <div class="flamingo-scene" aria-hidden="true">
              <div class="flamingo-mark">F</div>
              <div class="flamingo-trail" />
            </div>
          </template>
        </HeroSection>
        <div class="hero-copy">
          <span class="hero-kicker">{{ t("protocolValue") }}</span>
          <h1 class="hero-title">{{ t("title") }}</h1>
          <p class="hero-subtitle">{{ t("heroBlurb") }}</p>
        </div>
      </div>

      <StatsDisplay :items="overviewStats" layout="grid" :columns="3" class="mb-6" />

      <NeoCard variant="erobo" :title="t('summaryTitle')">
        <p class="copy-text">{{ t("summaryText") }}</p>
      </NeoCard>
    </template>

    <template #tab-details>
      <NeoCard variant="erobo" :title="t('tabDetails')">
        <StatsDisplay :items="detailStats" layout="rows" />
      </NeoCard>

      <NeoCard variant="erobo-neo" :title="t('notesTitle')" class="notes-card">
        <p class="copy-text">{{ t("notePrimary") }}</p>
        <p class="copy-text">{{ t("noteSecondary") }}</p>
      </NeoCard>
    </template>

    <template #operation>
      <NeoCard variant="erobo" :title="t('product')">
        <div class="action-stack">
          <NeoButton variant="primary" @click="openExternal(product.officialUrl)">
            {{ t("openOfficial") }}
          </NeoButton>
          <NeoButton variant="secondary" @click="openExternal(product.protocolUrl)">
            {{ t("openProtocolHome") }}
          </NeoButton>
          <NeoButton variant="secondary" @click="openExternal(product.docsUrl)">
            {{ t("openDocs") }}
          </NeoButton>
        </div>
      </NeoCard>
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { HeroSection, MiniAppPage, NeoButton, NeoCard, StatsDisplay } from "@shared/components";
import type { StatsDisplayItem } from "@shared/components";
import type { FlamingoProductDefinition } from "@shared/utils/flamingo-products";

const props = defineProps<{
  pageName: string;
  product: FlamingoProductDefinition;
  templateConfig: object;
  appState: Record<string, unknown>;
  t: (key: string) => string;
  status: unknown;
  sidebarItems: unknown;
  sidebarTitle: string;
  fallbackMessage: string;
  handleBoundaryError: (error: Error) => void;
  resetStatus: () => void;
}>();

const overviewStats = computed<StatsDisplayItem[]>(() => [
  { label: props.t("protocol"), value: props.t("protocolValue"), variant: "accent" },
  { label: props.t("category"), value: props.t("categoryValue"), variant: "success" },
  { label: props.t("integrationMode"), value: props.t("integrationModeValue"), variant: "erobo" },
]);

const detailStats = computed<StatsDisplayItem[]>(() => [
  { label: props.t("product"), value: props.t("title"), variant: "accent" },
  { label: props.t("network"), value: props.t("networkValue"), variant: "default" },
  { label: props.t("officialUrl"), value: props.product.officialUrl, variant: "default" },
  { label: props.t("docsUrl"), value: props.product.docsUrl, variant: "default" },
]);

function openExternal(url: string) {
  if (!url) return;
  if (typeof window !== "undefined" && window.open) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  if (typeof window !== "undefined") {
    window.location.href = url;
  }
}
</script>

<style lang="scss" scoped>
.hero-shell {
  display: grid;
  gap: 18px;
  margin-bottom: 24px;
}

.flamingo-scene {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 96px;
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

.notes-card {
  margin-top: 18px;
}

.action-stack {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
