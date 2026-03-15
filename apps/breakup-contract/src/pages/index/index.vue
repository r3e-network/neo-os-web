<template>
  <MiniAppPage
    name="breakup-contract"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    @tab-change="activeTab = $event"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="loadContracts"
  >
    <template #content>
      <div class="hero-container">
        <HeroSection variant="danger" icon="💔" compact>
          <template #background>
            <div class="contract-scene" aria-hidden="true">
              <div class="contract-doc">
                <div class="contract-line" v-for="i in 4" :key="i" />
                <div class="contract-signatures">
                  <span class="signature signature--left">✍️</span>
                  <span class="signature signature--right">✍️</span>
                </div>
              </div>
            </div>
          </template>
          <template #stats>
            <div class="hero-stats">
              <div class="hero-stat">
                <span class="hero-stat-value">{{ contracts.filter((c) => c.status === "active").length }}</span>
                <span class="hero-stat-label">{{ t("active") || "Active" }}</span>
              </div>
              <div class="hero-stat">
                <span class="hero-stat-value">{{ contracts.filter((c) => c.status === "pending").length }}</span>
                <span class="hero-stat-label">{{ t("pending") || "Pending" }}</span>
              </div>
              <div class="hero-stat">
                <span class="hero-stat-value">{{ contracts.length }}</span>
                <span class="hero-stat-label">{{ t("total") || "Total" }}</span>
              </div>
            </div>
          </template>
        </HeroSection>
      </div>

      <ContractList :contracts="contracts" :address="address" @sign="signContract" @break="breakContract" />
    </template>

    <template #operation>
      <!-- Create Contract Tab -->
      <CreateContractForm
        v-model:partnerAddress="partnerAddress"
        v-model:stakeAmount="stakeAmount"
        v-model:duration="duration"
        v-model:title="contractTitle"
        v-model:terms="contractTerms"
        :address="address"
        :is-loading="isLoading"
        @create="createContract"
      />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { messages } from "@/locale/messages";
import { MiniAppPage, HeroSection } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import ContractList from "./components/ContractList.vue";
import { useBreakupContract } from "./composables/useBreakupContract";

const { t, templateConfig, sidebarTitle, fallbackMessage, handleBoundaryError } = createMiniApp({
  name: "breakup-contract",
  messages,
  template: {
    tabs: [{ key: "create", labelKey: "tabCreate", icon: "💔", default: true }],
  },
});

const activeTab = ref<string>("create");

const {
  address,
  partnerAddress,
  stakeAmount,
  duration,
  contractTitle,
  contractTerms,
  appState,
  sidebarItems,
  contracts,
  status,
  isLoading,
  loadContracts,
  createContract,
  signContract,
  breakContract,
} = useBreakupContract(t);

onMounted(() => {
  loadContracts();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./breakup-contract-theme.scss" as *;

:global(body) {
  background: var(--heartbreak-bg);
}

.status-msg {
  color: var(--heartbreak-status-text);
  text-transform: uppercase;
  font-weight: 800;
  font-size: 13px;
  letter-spacing: 0.05em;
  text-shadow: var(--heartbreak-status-shadow);
}

.hero-container {
  margin-bottom: 20px;
}

.contract-scene {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 120px;
  padding: 16px;
}

.contract-doc {
  width: 100px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 12px 10px;
}

.contract-line {
  height: 3px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 2px;
  margin-bottom: 6px;
}

.contract-signatures {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  padding-top: 8px;
  border-top: 1px dashed rgba(255, 255, 255, 0.1);
}

.signature {
  font-size: 16px;
  opacity: 0.8;
}

.hero-stats {
  display: flex;
  gap: 16px;
  justify-content: center;
}

.hero-stat {
  text-align: center;
  padding: 8px 16px;
  background: rgba(255, 107, 107, 0.08);
  border-radius: 8px;
  border: 1px solid rgba(255, 107, 107, 0.15);
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

/* ── Breakup Contract Hero Enhancements ── */

.hero-container {
  background: radial-gradient(ellipse at center, rgba(255, 70, 100, 0.12) 0%, transparent 70%);
  transition: box-shadow 0.4s ease;
}

.contract-doc {
  background: linear-gradient(135deg, rgba(255, 70, 100, 0.1) 0%, rgba(255, 150, 180, 0.06) 100%);
  box-shadow:
    0 0 20px rgba(255, 70, 100, 0.15),
    0 0 40px rgba(255, 70, 100, 0.05);
  animation: breakup-card-pulse 4s ease-in-out infinite;
  transition:
    box-shadow 0.3s ease,
    transform 0.3s ease;
}

@keyframes breakup-card-pulse {
  0%,
  100% {
    box-shadow:
      0 0 20px rgba(255, 70, 100, 0.15),
      0 0 40px rgba(255, 70, 100, 0.05);
    transform: scale(1);
  }
  50% {
    box-shadow:
      0 0 30px rgba(255, 70, 100, 0.3),
      0 0 60px rgba(255, 70, 100, 0.1);
    transform: scale(1.03);
  }
}

@keyframes heartbeat-crack {
  0%,
  100% {
    transform: scale(1) rotate(0deg);
    opacity: 0.8;
  }
  25% {
    transform: scale(1.15) rotate(-2deg);
    opacity: 1;
  }
  50% {
    transform: scale(0.95) rotate(1deg);
    opacity: 0.7;
  }
  75% {
    transform: scale(1.08) rotate(-1deg);
    opacity: 0.9;
  }
}

.contract-signatures {
  animation: heartbeat-crack 3s ease-in-out infinite;
}

.signature--left {
  text-shadow: 0 0 10px rgba(255, 70, 100, 0.6);
  transition: text-shadow 0.3s ease;
}

.signature--right {
  text-shadow: 0 0 10px rgba(255, 150, 200, 0.6);
  transition: text-shadow 0.3s ease;
}

.contract-line {
  background: linear-gradient(
    90deg,
    rgba(255, 70, 100, 0.12) 0%,
    rgba(255, 255, 255, 0.08) 50%,
    rgba(255, 70, 100, 0.12) 100%
  );
  transition: background 0.3s ease;
}

.hero-stat {
  background: linear-gradient(135deg, rgba(255, 107, 107, 0.1) 0%, rgba(255, 70, 100, 0.06) 100%);
  box-shadow: 0 0 12px rgba(255, 107, 107, 0.1);
  transition:
    box-shadow 0.3s ease,
    transform 0.2s ease;

  &:hover {
    box-shadow: 0 0 20px rgba(255, 107, 107, 0.25);
    transform: translateY(-1px);
  }
}

.hero-stat-value {
  text-shadow: 0 0 8px rgba(255, 107, 107, 0.3);
}
</style>
