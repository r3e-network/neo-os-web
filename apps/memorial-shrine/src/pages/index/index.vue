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
      <div class="hero-container">
        <HeroSection variant="accent" compact>
          <template #background>
            <div class="candle-scene" aria-hidden="true">
              <div class="candle">
                <div class="flame">
                  <div class="flame-inner" />
                </div>
                <div class="candle-body" />
              </div>
            </div>
          </template>
          <template #stats>
            <div class="hero-stats">
              <div class="hero-stat">
                <span class="hero-stat-icon">🕯️</span>
                <span class="hero-stat-value">{{ memorials.length }}</span>
                <span class="hero-stat-label">{{ t("memorials") }}</span>
              </div>
              <div class="hero-stat">
                <span class="hero-stat-icon">🙏</span>
                <span class="hero-stat-value">{{ visitedMemorials.length }}</span>
                <span class="hero-stat-label">{{ t("myTributes") }}</span>
              </div>
            </div>
          </template>
        </HeroSection>
      </div>

      <div class="header" aria-hidden="true">
        <span class="title">{{ t("title") }}</span>
        <span class="tagline">{{ t("tagline") }}</span>
        <span class="subtitle">{{ t("subtitle") }}</span>
      </div>

      <div class="obituary-banner" v-if="recentObituaries.length">
        <span class="banner-title">{{ t("obituaries") }}</span>
        <scroll-view scroll-x class="banner-scroll">
          <div
            v-for="ob in recentObituaries"
            :key="ob.id"
            class="obituary-item"
            role="button"
            tabindex="0"
            :aria-label="ob.name"
            @click="openMemorial(ob.id)"
          >
            <span class="name">{{ ob.name }}</span>
            <span class="text">{{ ob.text }}</span>
          </div>
        </scroll-view>
      </div>

      <div class="memorials-grid">
        <TombstoneCard
          v-for="memorial in memorials"
          :key="memorial.id"
          :memorial="memorial"
          @click="openMemorial(memorial.id)"
        />
      </div>
    </template>

    <template #operation>
      <CreateMemorialForm @created="onMemorialCreated" />
    </template>

    <template #tab-tributes>
      <div class="section-header">
        <span class="section-title">{{ t("myTributes") }}</span>
        <span class="section-desc">{{ t("myTributesDesc") }}</span>
      </div>
      <div class="memorials-grid" v-if="visitedMemorials.length">
        <TombstoneCard
          v-for="memorial in visitedMemorials"
          :key="memorial.id"
          :memorial="memorial"
          @click="openMemorial(memorial.id)"
        />
      </div>
      <div v-else class="empty-state">
        <span>{{ t("noTributes") }}</span>
      </div>
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
import { MiniAppPage, HeroSection } from "@shared/components";
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
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/page-common" as *;
@use "./memorial-shrine-theme.scss" as *;

@include page-background(var(--bg-primary));

.hero-container {
  margin-bottom: 20px;
}

.candle-scene {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  height: 100px;
  padding-bottom: 10px;
}

.candle {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.flame {
  width: 12px;
  height: 20px;
  background: radial-gradient(ellipse at bottom, #ffd700, #ff6b35, transparent);
  border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
  animation: flicker 1.5s ease-in-out infinite alternate;
  filter: blur(1px);
}

.flame-inner {
  width: 4px;
  height: 8px;
  background: #fff8dc;
  border-radius: 50%;
  margin: 6px auto 0;
  opacity: 0.9;
}

.candle-body {
  width: 16px;
  height: 40px;
  background: linear-gradient(180deg, #f5e6d3, #ddd0c0);
  border-radius: 2px;
  margin-top: -2px;
}

@keyframes flicker {
  0% {
    transform: scale(1) rotate(-2deg);
    opacity: 0.9;
  }
  50% {
    transform: scale(1.05) rotate(1deg);
    opacity: 1;
  }
  100% {
    transform: scale(0.95) rotate(-1deg);
    opacity: 0.85;
  }
}

.hero-stats {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.hero-stat {
  text-align: center;
  padding: 8px 16px;
  background: rgba(218, 165, 32, 0.08);
  border-radius: 8px;
  border: 1px solid rgba(218, 165, 32, 0.15);
}

.hero-stat-icon {
  display: block;
  font-size: 20px;
  margin-bottom: 4px;
}

.hero-stat-value {
  display: block;
  font-size: 20px;
  font-weight: 800;
  color: var(--shrine-gold, var(--text-primary));
}

.hero-stat-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--shrine-muted, var(--text-secondary));
  letter-spacing: 1px;
  margin-top: 2px;
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

/* ── Memorial Shrine Hero Enhancements: Candlelight Warmth ── */
@keyframes flame-flicker {
  0%,
  100% {
    transform: scaleY(1) rotate(-1deg);
    filter: brightness(1);
  }
  25% {
    transform: scaleY(1.08) rotate(1deg);
    filter: brightness(1.15);
  }
  50% {
    transform: scaleY(0.95) rotate(-0.5deg);
    filter: brightness(0.95);
  }
  75% {
    transform: scaleY(1.04) rotate(0.8deg);
    filter: brightness(1.1);
  }
}
@keyframes ember-glow {
  0%,
  100% {
    box-shadow: 0 0 12px rgba(218, 165, 32, 0.2);
  }
  50% {
    box-shadow:
      0 0 28px rgba(218, 165, 32, 0.45),
      0 0 56px rgba(218, 165, 32, 0.12);
  }
}

.hero-container {
  background: radial-gradient(ellipse at 50% 80%, rgba(218, 165, 32, 0.1) 0%, transparent 60%);
}
.candle-scene {
  background: linear-gradient(180deg, transparent, rgba(218, 165, 32, 0.04));
}
.flame {
  animation: flame-flicker 2s ease-in-out infinite alternate;
}
.hero-stats {
  box-shadow: 0 0 20px rgba(218, 165, 32, 0.12);
  transition:
    box-shadow 0.3s ease,
    transform 0.3s ease;
  &:hover {
    box-shadow: 0 0 30px rgba(218, 165, 32, 0.3);
    transform: translateY(-1px);
  }
}
.hero-stat {
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06);
  background: linear-gradient(180deg, rgba(218, 165, 32, 0.06), transparent);
}
.candle-body {
  box-shadow: 0 4px 16px rgba(255, 107, 53, 0.15);
}
</style>
