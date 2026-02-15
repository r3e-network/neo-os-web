<template>
  <MiniAppPage
    name="memorial-shrine"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    @tab-change="activeTab = $event"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="resetAndReload"
  >
    <template #content>
      <view class="header" aria-hidden="true">
        <text class="title">{{ t("title") }}</text>
        <text class="tagline">{{ t("tagline") }}</text>
        <text class="subtitle">{{ t("subtitle") }}</text>
      </view>

      <view class="obituary-banner" v-if="recentObituaries.length">
        <text class="banner-title">{{ t("obituaries") }}</text>
        <scroll-view scroll-x class="banner-scroll">
          <view
            v-for="ob in recentObituaries"
            :key="ob.id"
            class="obituary-item"
            role="button"
            tabindex="0"
            :aria-label="ob.name"
            @click="openMemorial(ob.id)"
          >
            <text class="name">{{ ob.name }}</text>
            <text class="text">{{ ob.text }}</text>
          </view>
        </scroll-view>
      </view>

      <view class="memorials-grid">
        <TombstoneCard
          v-for="memorial in memorials"
          :key="memorial.id"
          :memorial="memorial"
          @click="openMemorial(memorial.id)"
        />
      </view>
    </template>

    <template #operation>
      <CreateMemorialForm @created="onMemorialCreated" />
    </template>

    <template #tab-tributes>
      <view class="section-header">
        <text class="section-title">{{ t("myTributes") }}</text>
        <text class="section-desc">{{ t("myTributesDesc") }}</text>
      </view>
      <view class="memorials-grid" v-if="visitedMemorials.length">
        <TombstoneCard
          v-for="memorial in visitedMemorials"
          :key="memorial.id"
          :memorial="memorial"
          @click="openMemorial(memorial.id)"
        />
      </view>
      <view v-else class="empty-state">
        <text>{{ t("noTributes") }}</text>
      </view>
    </template>
  </MiniAppPage>

  <!-- Memorial Detail Modal -->
  <MemorialDetailModal
    v-if="selectedMemorial"
    :memorial="selectedMemorial"
    :offerings="offerings"
    @close="closeMemorial"
    @tribute-paid="onTributePaid"
    @share="shareMemorial"
  />
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { messages } from "@/locale/messages";
import { MiniAppPage } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import TombstoneCard from "./components/TombstoneCard.vue";
import { useMemorialActions } from "@/composables/useMemorialActions";

const {
  t,
  templateConfig,
  sidebarItems,
  sidebarTitle,
  fallbackMessage,
  status,
  setStatus,
  clearStatus,
  handleBoundaryError,
} = createMiniApp({
  name: "memorial-shrine",
  messages,
  template: {
    tabs: [
      { key: "memorials", labelKey: "memorials", icon: "🕯️", default: true },
      { key: "tributes", labelKey: "myTributes", icon: "🙏" },
    ],
  },
  sidebarItems: [
    { labelKey: "memorials", value: () => memorials.value.length },
    { labelKey: "myTributes", value: () => visitedMemorials.value.length },
    { labelKey: "sidebarObituaries", value: () => recentObituaries.value.length },
  ],
});

const {
  visitedMemorials,
  recentObituaries,
  selectedMemorial,
  shareStatus,
  loadVisitedMemorials,
  openMemorial,
  closeMemorial,
  shareMemorial,
  checkUrlForMemorial,
  onMemorialCreated: handleMemorialCreated,
  onTributePaid,
  cleanupTimers,
} = useMemorialActions();

const resetAndReload = async () => {
  await checkUrlForMemorial();
  await loadVisitedMemorials();
};

const appState = computed(() => ({
  totalMemorials: memorials.value.length,
  visitedCount: visitedMemorials.value.length,
}));

const activeTab = ref("memorials");

const offerings = [
  { type: 1, nameKey: "incense", icon: "🕯️", cost: 0.01 },
  { type: 2, nameKey: "candle", icon: "🕯", cost: 0.02 },
  { type: 3, nameKey: "flower", icon: "🌸", cost: 0.03 },
  { type: 4, nameKey: "fruit", icon: "🍇", cost: 0.05 },
  { type: 5, nameKey: "wine", icon: "🍶", cost: 0.1 },
  { type: 6, nameKey: "feast", icon: "🍱", cost: 0.5 },
];

const onMemorialCreated = async (data: Record<string, unknown>) => {
  await handleMemorialCreated(data);
  activeTab.value = "memorials";
};

onUnmounted(() => {
  cleanupTimers();
});

onMounted(async () => {
  await checkUrlForMemorial();
  await loadVisitedMemorials();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/page-common" as *;
@import "./memorial-shrine-theme.scss";

@include page-background(var(--bg-primary));

.header {
  text-align: center;
  padding: 32px 16px;

  .title {
    display: block;
    font-size: 28px;
    font-weight: 700;
    color: var(--shrine-gold);
    text-shadow: 0 0 30px var(--shrine-title-glow);
    margin-bottom: 8px;
  }

  .tagline {
    display: block;
    font-size: 16px;
    color: var(--shrine-gold-light);
    letter-spacing: 6px;
    margin-bottom: 8px;
  }

  .subtitle {
    display: block;
    font-size: 13px;
    color: var(--shrine-muted);
  }
}

.obituary-banner {
  background: linear-gradient(90deg, var(--shrine-dark), var(--shrine-medium), var(--shrine-dark));
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 20px;
  border: 1px solid var(--shrine-banner-border);

  .banner-title {
    display: block;
    font-size: 13px;
    color: var(--shrine-gold);
    margin-bottom: 8px;
  }

  .banner-scroll {
    white-space: nowrap;
  }

  .obituary-item {
    display: inline-block;
    margin-right: 32px;
    font-size: 12px;
    color: var(--shrine-muted);

    .name {
      color: var(--shrine-text);
      margin-right: 8px;
    }
  }
}

.memorials-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  justify-content: center;
}

.section-header {
  text-align: center;
  margin-bottom: 24px;

  .section-title {
    display: block;
    font-size: 20px;
    color: var(--shrine-gold);
    margin-bottom: 8px;
  }

  .section-desc {
    display: block;
    font-size: 13px;
    color: var(--shrine-muted);
  }
}

.empty-state {
  text-align: center;
  padding: 48px 16px;
  color: var(--shrine-muted);
}
</style>
