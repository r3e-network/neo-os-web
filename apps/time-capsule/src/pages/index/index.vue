<template>
  <MiniAppPage
    name="time-capsule"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="resetAndReload"
    @tab-change="activeTab = $event"
  >
    <template #content>
      <div class="hero-container">
        <HeroSection variant="erobo-neo" icon="🔒" compact>
          <template #background>
            <div class="capsule-scene" aria-hidden="true">
              <div class="capsule-graphic">
                <div class="capsule-top" />
                <div class="capsule-body">
                  <div class="capsule-band" />
                </div>
                <div class="capsule-glow" />
              </div>
            </div>
          </template>
          <template #stats>
            <div class="hero-stats">
              <div class="hero-stat">
                <span class="hero-stat-value">{{ capsules.length }}</span>
                <span class="hero-stat-label">{{ t("sidebarTotalCapsules") }}</span>
              </div>
              <div class="hero-stat">
                <span class="hero-stat-value">{{ capsules.filter((c) => c.locked).length }}</span>
                <span class="hero-stat-label">{{ t("sidebarLocked") }}</span>
              </div>
              <div class="hero-stat">
                <span class="hero-stat-value">{{ capsules.filter((c) => c.revealed).length }}</span>
                <span class="hero-stat-label">{{ t("sidebarRevealed") }}</span>
              </div>
            </div>
          </template>
        </HeroSection>
      </div>

      <CapsuleList :capsules="capsules" :current-time="currentTime" :t="t" @open="handleOpen" />
    </template>

    <template #operation>
      <NeoCard variant="erobo-neo">
        <span class="helper-text">{{ t("fishDescription") }}</span>
        <NeoButton
          variant="secondary"
          size="md"
          block
          :loading="isBusy"
          :disabled="isBusy"
          class="mt-3"
          @click="handleFish"
        >
          {{ t("fishButton") }}
        </NeoButton>
      </NeoCard>
    </template>

    <template #tab-create>
      <CreateCapsuleForm
        v-model:title="newCapsule.title"
        v-model:content="newCapsule.content"
        v-model:days="newCapsule.days"
        v-model:is-public="newCapsule.isPublic"
        v-model:category="newCapsule.category"
        :is-loading="isBusy"
        :can-create="canCreate"
        :t="t"
        @create="handleCreate"
      />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useWallet } from "@shared/utils/wallet-sdk";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { useTicker } from "@shared/composables/useTicker";
import { messages } from "@/locale/messages";
import { MiniAppPage, HeroSection } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { useCapsuleCreation } from "@/composables/useCapsuleCreation";
import { useCapsuleUnlock } from "@/composables/useCapsuleUnlock";
import CapsuleList, { type Capsule } from "./components/CapsuleList.vue";

const {
  t,
  templateConfig,
  sidebarItems,
  sidebarTitle,
  fallbackMessage,
  status: actionStatus,
  setStatus,
  clearStatus,
  handleBoundaryError,
} = createMiniApp({
  name: "time-capsule",
  messages,
  template: {
    tabs: [
      { key: "capsules", labelKey: "tabCapsules", icon: "🔒", default: true },
      { key: "create", labelKey: "tabCreate", icon: "➕" },
    ],
    docFeatureCount: 3,
  },
  sidebarItems: [
    { labelKey: "sidebarTotalCapsules", value: () => capsules.value.length },
    { labelKey: "sidebarLocked", value: () => capsules.value.filter((c) => c.locked).length },
    { labelKey: "sidebarRevealed", value: () => capsules.value.filter((c) => c.revealed).length },
  ],
  statusTimeoutMs: 4000,
});
const { address } = useWallet() as WalletSDK;

const activeTab = ref("capsules");

const capsules = ref<Capsule[]>([]);
const currentTime = ref(Date.now());
const isLoadingData = ref(false);

const appState = computed(() => ({}));

const { newCapsule, status: createStatus, isBusy: createBusy, canCreate, create } = useCapsuleCreation();
const status = computed(() => actionStatus.value ?? createStatus.value);
const { isBusy: unlockBusy, open, fish, loadCapsules } = useCapsuleUnlock();

const isBusy = computed(() => createBusy.value || unlockBusy.value || isLoadingData.value);

const countdownTicker = useTicker(() => {
  currentTime.value = Date.now();
}, 1000);

onMounted(() => {
  countdownTicker.start();
});

watch(
  address,
  () => {
    loadData();
  },
  { immediate: true },
);

const loadData = async () => {
  if (!address.value) return;
  isLoadingData.value = true;
  try {
    capsules.value = await loadCapsules();
  } catch {
    /* non-critical: capsule data fetch */
  } finally {
    isLoadingData.value = false;
  }
};
const handleOpen = async (cap: Capsule) => {
  await open(cap, (msg, type) => {
    setStatus(msg, type);
    if (type !== "error") {
      loadData();
    }
  });
};
const resetAndReload = async () => {
  if (address.value) loadData();
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/page-common" as *;
@use "./time-capsule-theme.scss" as *;

@include page-background(var(--bg-primary));

.hero-container {
  margin-bottom: 20px;
}

.capsule-scene {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 110px;
}

.capsule-graphic {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

.capsule-top {
  width: 40px;
  height: 20px;
  background: linear-gradient(180deg, rgba(0, 229, 153, 0.3), rgba(0, 229, 153, 0.15));
  border-radius: 20px 20px 0 0;
  border: 1px solid rgba(0, 229, 153, 0.3);
  border-bottom: none;
}

.capsule-body {
  width: 50px;
  height: 40px;
  background: linear-gradient(180deg, rgba(0, 229, 153, 0.15), rgba(0, 229, 153, 0.05));
  border: 1px solid rgba(0, 229, 153, 0.2);
  border-radius: 0 0 6px 6px;
  position: relative;
}

.capsule-band {
  width: 100%;
  height: 4px;
  background: rgba(0, 229, 153, 0.4);
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
}

.capsule-glow {
  position: absolute;
  width: 60px;
  height: 60px;
  background: radial-gradient(circle, rgba(0, 229, 153, 0.15), transparent 70%);
  border-radius: 50%;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  animation: pulse-glow 2s ease-in-out infinite;
}

@keyframes pulse-glow {
  0%,
  100% {
    opacity: 0.5;
    transform: translate(-50%, -50%) scale(1);
  }
  50% {
    opacity: 1;
    transform: translate(-50%, -50%) scale(1.2);
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
  background: rgba(0, 229, 153, 0.08);
  border-radius: 8px;
  border: 1px solid rgba(0, 229, 153, 0.15);
}

.hero-stat-value {
  display: block;
  font-size: 20px;
  font-weight: 800;
  color: var(--text-primary);
}

.hero-stat-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 1px;
  margin-top: 2px;
}

.helper-text {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  color: var(--capsule-cyan, var(--text-secondary));
  opacity: 0.8;
  letter-spacing: 0.05em;
}

/* ── Time Capsule Hero Enhancements: Time Lock ── */
@keyframes clock-tick {
  0%,
  100% {
    transform: rotate(0deg);
  }
  10% {
    transform: rotate(6deg);
  }
  20% {
    transform: rotate(0deg);
  }
}
@keyframes wormhole-spin {
  0% {
    transform: translate(-50%, -50%) rotate(0deg) scale(1);
    opacity: 0.5;
  }
  50% {
    transform: translate(-50%, -50%) rotate(180deg) scale(1.3);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) rotate(360deg) scale(1);
    opacity: 0.5;
  }
}

.hero-container {
  background: radial-gradient(ellipse at 50% 40%, rgba(0, 229, 153, 0.08) 0%, transparent 55%);
}
.capsule-glow {
  animation: wormhole-spin 6s linear infinite;
}
.capsule-band {
  box-shadow: 0 0 8px rgba(0, 229, 153, 0.3);
  background: linear-gradient(90deg, rgba(0, 229, 153, 0.2), rgba(0, 229, 153, 0.5), rgba(0, 229, 153, 0.2));
}
.hero-stats {
  box-shadow: 0 4px 20px rgba(0, 229, 153, 0.1);
  transition:
    box-shadow 0.3s ease,
    transform 0.3s ease;
  &:hover {
    box-shadow: 0 6px 28px rgba(0, 229, 153, 0.25);
    transform: translateY(-2px);
  }
}
.hero-stat {
  box-shadow: inset 0 1px 0 rgba(0, 229, 153, 0.06);
  background: linear-gradient(180deg, rgba(0, 229, 153, 0.05), transparent);
}
.hero-stat-value {
  animation: clock-tick 2s ease-in-out infinite;
}
.capsule-scene {
  background: linear-gradient(180deg, rgba(0, 229, 153, 0.03), transparent);
}
</style>
