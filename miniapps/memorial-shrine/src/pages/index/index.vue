<template>
  <view class="theme-memorial-shrine">
    <MiniAppTemplate :config="templateConfig" :state="appState" :t="t" @tab-change="activeTab = $event">
      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <template #content>
        <view class="cemetery-bg">
          <view class="header">
            <text class="title">{{ t("title") }}</text>
            <text class="tagline">{{ t("tagline") }}</text>
            <text class="subtitle">{{ t("subtitle") }}</text>
          </view>

          <view class="obituary-banner" v-if="recentObituaries.length">
            <text class="banner-title">{{ t("obituaries") }}</text>
            <scroll-view scroll-x class="banner-scroll">
              <view v-for="ob in recentObituaries" :key="ob.id" class="obituary-item" role="button" tabindex="0" :aria-label="ob.name" @click="openMemorial(ob.id)">
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
        </view>
      </template>

      <template #operation>
        <view class="cemetery-bg">
          <CreateMemorialForm @created="onMemorialCreated" />
        </view>
      </template>

      <template #tab-tributes>
        <view class="cemetery-bg">
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
        </view>
      </template>

      <template #tab-create>
        <view class="cemetery-bg">
          <CreateMemorialForm @created="onMemorialCreated" />
        </view>
      </template>
    </MiniAppTemplate>

    <!-- Memorial Detail Modal -->
    <MemorialDetailModal
      v-if="selectedMemorial"
      :memorial="selectedMemorial"
      :offerings="offerings"
      @close="closeMemorial"
      @tribute-paid="onTributePaid"
      @share="shareMemorial"
    />

    <!-- Share Toast -->
    <view v-if="shareStatus" class="share-toast">
      <text>{{ shareStatus }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useI18n } from "@/composables/useI18n";
import { MiniAppTemplate, SidebarPanel } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import TombstoneCard from "./components/TombstoneCard.vue";
import CreateMemorialForm from "./components/CreateMemorialForm.vue";
import MemorialDetailModal from "./components/MemorialDetailModal.vue";
import { useMemorialActions } from "@/composables/useMemorialActions";

const { t } = useI18n();

const {
  memorials,
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

const templateConfig: MiniAppTemplateConfig = {
  contentType: "two-column",
  tabs: [
    { key: "memorials", labelKey: "memorials", icon: "🕯️", default: true },
    { key: "tributes", labelKey: "myTributes", icon: "🙏" },
    { key: "create", labelKey: "create", icon: "➕" },
    { key: "docs", labelKey: "docs", icon: "📖" },
  ],
  features: {
    fireworks: false,
    chainWarning: true,
    statusMessages: false,
    docs: {
      titleKey: "title",
      subtitleKey: "docSubtitle",
      stepKeys: ["step1", "step2", "step3", "step4"],
      featureKeys: [
        { nameKey: "feature1Name", descKey: "feature1Desc" },
        { nameKey: "feature2Name", descKey: "feature2Desc" },
      ],
    },
  },
};

const appState = computed(() => ({
  totalMemorials: memorials.value.length,
  visitedCount: visitedMemorials.value.length,
}));

const sidebarItems = computed(() => [
  { label: t("memorials"), value: memorials.value.length },
  { label: t("myTributes"), value: visitedMemorials.value.length },
  { label: "Obituaries", value: recentObituaries.value.length },
]);

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
@import "./memorial-shrine-theme.scss";

:global(page) {
  background: var(--bg-primary);
}

.tab-content {
  padding: 16px;
  min-height: 100vh;
}

.cemetery-bg {
  background: linear-gradient(180deg, var(--shrine-bg) 0%, var(--shrine-dark) 50%, var(--shrine-medium) 100%);
  position: relative;

  &::before {
    content: "";
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 200px;
    background: radial-gradient(ellipse at 80% 20%, var(--shrine-banner-glow), transparent);
    pointer-events: none;
  }
}

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


// Desktop sidebar
</style>
