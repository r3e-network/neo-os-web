<template>
  <MiniAppPage
    name="neo-pay"
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
        <!-- Payment Timeline Visualization -->
        <div class="hero-timeline">
          <div class="timeline-track">
            <div class="timeline-line" />
            <div class="timeline-flow" />
            <!-- Active stream indicators -->
            <div
              v-for="(s, idx) in allStreams.slice(0, 5)"
              :key="s.id || idx"
              :class="['timeline-node', { active: s.status === 'active' }]"
              :style="{ left: `${15 + idx * 17}%` }"
            >
              <div class="node-dot" />
              <div v-if="s.status === 'active'" class="node-pulse" />
            </div>
          </div>

          <!-- Flow particles -->
          <div class="flow-particles">
            <span v-for="i in 4" :key="i" class="particle" :style="{ animationDelay: `${i * 0.8}s` }" />
          </div>
        </div>

        <!-- Stats Row -->
        <div class="hero-stream-stats">
          <div class="stream-stat">
            <AppIcon name="upload" :size="20" class="stream-stat-icon" aria-hidden="true" />
            <div class="stream-stat-info">
              <span class="stream-stat-value">{{ createdStreams.length }}</span>
              <span class="stream-stat-label">{{ t("myCreated") }}</span>
            </div>
          </div>
          <div class="stream-stat-divider" />
          <div class="stream-stat">
            <AppIcon name="download" :size="20" class="stream-stat-icon" aria-hidden="true" />
            <div class="stream-stat-info">
              <span class="stream-stat-value">{{ beneficiaryStreams.length }}</span>
              <span class="stream-stat-label">{{ t("beneficiaryVaults") }}</span>
            </div>
          </div>
        </div>

        <!-- Active Status -->
        <div class="hero-active-badge" :class="{ live: activeCount > 0 }">
          <div class="active-dot" />
          <span>{{ activeCount }} {{ t("statusActive") }} {{ activeCount === 1 ? t("streamSingular") : t("streamPlural") }}</span>
        </div>
      </div>

      <div class="vaults-header">
        <span class="section-title">{{ t("vaultsTab") }}</span>
        <NeoButton size="sm" variant="secondary" :loading="isRefreshing" @click="refreshStreams">
          {{ t("refresh") }}
        </NeoButton>
      </div>

      <div v-if="!address" class="empty-state">
        <NeoCard variant="erobo" class="p-6 text-center">
          <span class="mb-3 block text-sm">{{ t("walletNotConnected") }}</span>
          <NeoButton size="sm" variant="primary" @click="connectWallet">
            {{ t("connectWallet") }}
          </NeoButton>
        </NeoCard>
      </div>

      <div v-else class="streams-container">
        <StreamList :streams="createdStreams" :label="t('myCreated')" :empty-text="t('emptyVaults')" type="created">
          <template #actions="{ stream: s }">
            <NeoButton
              size="sm"
              variant="secondary"
              :loading="cancellingId === s.id"
              :disabled="s.status !== 'active'"
              @click="cancelStream(s)"
            >
              {{ cancellingId === s.id ? t("cancelling") : t("cancel") }}
            </NeoButton>
          </template>
        </StreamList>

        <StreamList
          :streams="beneficiaryStreams"
          :label="t('beneficiaryVaults')"
          :empty-text="t('emptyVaults')"
          type="beneficiary"
        >
          <template #actions="{ stream: s }">
            <NeoButton
              size="sm"
              variant="primary"
              :loading="claimingId === s.id"
              :disabled="s.status !== 'active' || s.claimable === 0n"
              @click="claimStream(s)"
            >
              {{ claimingId === s.id ? t("claiming") : t("claim") }}
            </NeoButton>
          </template>
        </StreamList>
      </div>
    </template>

    <template #operation>
      <StreamCreateForm :loading="isLoading" @create="handleCreateVault" />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from "vue";
import { messages } from "@/locale/messages";
import { MiniAppPage, NeoCard, NeoButton } from "@shared/components";
import AppIcon from "@shared/components/AppIcon.vue";
import { createMiniApp } from "@shared/utils/createMiniApp";
import StreamList from "@/components/StreamList.vue";
import StreamCreateForm from "@/components/StreamCreateForm.vue";
import { useNeoPay } from "./composables/useNeoPay";

const { t, templateConfig, sidebarTitle, fallbackMessage, handleBoundaryError } = createMiniApp({
  name: "neo-pay",
  messages,
  template: {
    tabs: [{ key: "create", labelKey: "createTab", icon: "➕", default: true }],
    docFeatureCount: 3,
  },
});

const activeTab = ref("create");

const allStreams = computed(() => [...createdStreams.value, ...beneficiaryStreams.value]);
const activeCount = computed(() => allStreams.value.filter((s) => s.status === "active").length);

const {
  address,
  createdStreams,
  beneficiaryStreams,
  isLoading,
  isRefreshing,
  claimingId,
  cancellingId,
  status,
  appState,
  sidebarItems,
  refreshStreams,
  connectWallet,
  handleCreateVault,
  claimStream,
  cancelStream,
} = useNeoPay(t);

const resetAndReload = async () => {
  if (address.value) await refreshStreams();
};

onMounted(() => {
  if (address.value) {
    refreshStreams();
  }
});

const stopActiveTabWatch = watch(activeTab, (next) => {
  if (next === "vaults" && address.value) {
    refreshStreams();
  }
});

onUnmounted(() => stopActiveTabWatch());
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/page-common" as *;
@use "./neo-pay-theme.scss" as *;

@include page-background(
  linear-gradient(135deg, var(--stream-bg-start) 0%, var(--stream-bg-end) 100%),
  (
    color: var(--stream-text),
  )
);

.hero-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
  padding: 24px 16px;
  gap: 24px;
}

/* ── Timeline Visualization ── */
.hero-timeline {
  width: 100%;
  position: relative;
  padding: 20px 0;
}

.timeline-track {
  position: relative;
  height: 40px;
  display: flex;
  align-items: center;
}

.timeline-line {
  position: absolute;
  left: 5%;
  right: 5%;
  height: 2px;
  background: rgba(255, 255, 255, 0.08);
  top: 50%;
  transform: translateY(-50%);
}

.timeline-flow {
  position: absolute;
  left: 5%;
  height: 2px;
  top: 50%;
  transform: translateY(-50%);
  background: linear-gradient(90deg, rgba(99, 102, 241, 0.6), rgba(139, 92, 246, 0.4), transparent);
  width: 60%;
  animation: flow-extend 3s ease-in-out infinite;
}

.timeline-node {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 2;
}

.node-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  border: 2px solid rgba(255, 255, 255, 0.1);
  transition: all 0.3s ease;

  .active & {
    background: var(--stream-accent-glow);
    border-color: rgba(129, 140, 248, 0.5);
    box-shadow: 0 0 8px rgba(129, 140, 248, 0.5);
  }
}

.node-pulse {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(129, 140, 248, 0.2);
  transform: translate(-50%, -50%);
  animation: node-ping 2s ease-out infinite;
}

/* ── Flow Particles ── */
.flow-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.particle {
  position: absolute;
  top: 50%;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: rgba(139, 92, 246, 0.6);
  box-shadow: 0 0 6px rgba(139, 92, 246, 0.4);
  animation: particle-flow 4s linear infinite;
}

/* ── Stats Row ── */
.hero-stream-stats {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 16px 28px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}

.stream-stat {
  display: flex;
  align-items: center;
  gap: 10px;
}

.stream-stat-icon {
  font-size: 20px;
}

.stream-stat-info {
  display: flex;
  flex-direction: column;
}

.stream-stat-value {
  font-size: 20px;
  font-weight: 900;
  font-family: $font-mono;
  color: var(--text-primary, #fff);
}

.stream-stat-label {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: rgba(255, 255, 255, 0.4);
}

.stream-stat-divider {
  width: 1px;
  height: 32px;
  background: rgba(255, 255, 255, 0.1);
}

/* ── Active Badge ── */
.hero-active-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 16px;
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 11px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.06em;

  &.live {
    border-color: rgba(52, 211, 153, 0.3);
    color: var(--stream-success-light);
  }
}

.active-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);

  .live & {
    background: var(--stream-success-light);
    box-shadow: 0 0 6px rgba(52, 211, 153, 0.5);
    animation: dot-blink 2s ease-in-out infinite;
  }
}

.vaults-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16px;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
}

.streams-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-state {
  margin-top: 10px;
}

@keyframes flow-extend {
  0% {
    width: 10%;
    opacity: 0.3;
  }
  50% {
    width: 70%;
    opacity: 1;
  }
  100% {
    width: 10%;
    opacity: 0.3;
  }
}

@keyframes node-ping {
  0% {
    transform: translate(-50%, -50%) scale(1);
    opacity: 0.6;
  }
  100% {
    transform: translate(-50%, -50%) scale(2.5);
    opacity: 0;
  }
}

@keyframes particle-flow {
  0% {
    left: 5%;
    opacity: 0;
  }
  10% {
    opacity: 1;
  }
  90% {
    opacity: 1;
  }
  100% {
    left: 90%;
    opacity: 0;
  }
}

@keyframes dot-blink {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.3;
  }
}

@media (prefers-reduced-motion: reduce) {
  .timeline-flow,
  .node-pulse,
  .particle,
  .live .active-dot {
    animation: none;
  }
}

@media (max-width: 480px) {
  .hero-stream-stats {
    gap: 14px;
    padding: 12px 20px;
  }
  .stream-stat-value {
    font-size: 16px;
  }
}

</style>
