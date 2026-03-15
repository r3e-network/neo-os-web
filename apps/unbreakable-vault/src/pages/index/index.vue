<template>
  <MiniAppPage
    name="unbreakable-vault"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="breaker.status.value"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="resetAndReload"
  >
    <template #content>
      <div class="hero-container">
        <HeroSection variant="erobo-neo" compact>
          <template #background>
            <div class="vault-scene" aria-hidden="true">
              <div class="vault-door">
                <div class="vault-handle" />
                <div class="vault-lock">🔒</div>
              </div>
            </div>
          </template>
          <template #stats>
            <div class="hero-stats">
              <div class="hero-stat">
                <span class="hero-stat-value">{{ creator.myVaults.value.length }}</span>
                <span class="hero-stat-label">{{ t("create") }}</span>
              </div>
              <div class="hero-stat">
                <span class="hero-stat-value">{{ breaker.recentVaults.value.length }}</span>
                <span class="hero-stat-label">{{ t("break") }}</span>
              </div>
            </div>
          </template>
        </HeroSection>
      </div>

      <VaultList
        :title="t('myVaults')"
        :empty-text="t('noRecentVaults')"
        :vaults="creator.myVaults.value"
        @select="breaker.selectVault"
      />

      <NeoCard v-if="creator.createdVaultId.value" variant="erobo" class="vault-created">
        <span class="vault-created-label">{{ t("vaultCreated") }}</span>
        <span class="vault-created-id">#{{ creator.createdVaultId.value }}</span>
      </NeoCard>
    </template>

    <template #operation>
      <VaultCreate
        v-model:bounty="bounty"
        v-model:title="vaultTitle"
        v-model:description="vaultDescription"
        v-model:difficulty="vaultDifficulty"
        v-model:secret="secret"
        v-model:secretConfirm="secretConfirm"
        :secret-hash="secretHash"
        :loading="creator.isCreating.value"
        :min-bounty="MIN_BOUNTY"
        @create="createVault"
      />
    </template>

    <template #tab-break>
      <NeoCard variant="erobo-neo">
        <div class="form-group">
          <div class="input-group">
            <span class="input-label">{{ t("vaultIdLabel") }}</span>
            <NeoInput v-model="breaker.vaultIdInput.value" type="number" :placeholder="t('vaultIdPlaceholder')" />
          </div>

          <NeoButton variant="secondary" block :loading="breaker.isLoading.value" @click="breaker.loadVault">
            {{ t("loadVault") }}
          </NeoButton>

          <div class="input-group">
            <span class="input-label">{{ t("secretAttemptLabel") }}</span>
            <NeoInput v-model="breaker.attemptSecret.value" :placeholder="t('secretAttemptPlaceholder')" />
          </div>

          <span class="helper-text">{{ t("attemptFeeNote").replace("{fee}", breaker.attemptFeeDisplay.value) }}</span>

          <NeoButton
            variant="primary"
            size="lg"
            block
            :loading="breaker.isLoading.value"
            :disabled="!breaker.canAttempt.value || breaker.isLoading.value"
            @click="breaker.attemptBreak"
          >
            {{ breaker.isLoading.value ? t("attempting") : t("attemptBreak") }}
          </NeoButton>
        </div>
      </NeoCard>

      <VaultDetails v-if="breaker.vaultDetails.value" :details="breaker.vaultDetails.value" />

      <VaultList
        :title="t('recentVaults')"
        :empty-text="t('noRecentVaults')"
        :vaults="breaker.recentVaults.value"
        @select="breaker.selectVault"
      />
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { messages } from "@/locale/messages";
import { sha256Hex } from "@shared/utils/hash";
import { MiniAppPage, NeoCard, HeroSection } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { useVaultBreaker } from "@/composables/useVaultBreaker";
import { useVaultCreator } from "@/composables/useVaultCreator";
import VaultList from "./components/VaultList.vue";

const APP_ID = "miniapp-unbreakablevault";
const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, handleBoundaryError } = createMiniApp({
  name: "unbreakable-vault",
  messages,
  template: {
    tabs: [
      { key: "create", labelKey: "create", icon: "🔒", default: true },
      { key: "break", labelKey: "break", icon: "🔑" },
    ],
  },
  sidebarItems: [
    { labelKey: "create", value: () => creator.myVaults.value.length },
    { labelKey: "break", value: () => breaker.recentVaults.value.length },
    { labelKey: "sidebarDifficulty", value: () => vaultDifficulty.value },
    { labelKey: "sidebarAttemptFee", value: () => `${breaker.attemptFeeDisplay.value} GAS` },
  ],
});

const breaker = useVaultBreaker(APP_ID, t);
const creator = useVaultCreator(APP_ID, t, breaker.setStatus);

const appState = computed(() => ({}));

const bounty = ref("");
const vaultTitle = ref("");
const vaultDescription = ref("");
const vaultDifficulty = ref(1);
const secret = ref("");
const secretConfirm = ref("");
const secretHash = ref("");

const createVault = async () => {
  await creator.createVault(
    {
      bounty: bounty.value,
      title: vaultTitle.value,
      description: vaultDescription.value,
      difficulty: vaultDifficulty.value,
      secret: secret.value,
      secretHash: secretHash.value,
    },
    () => {
      bounty.value = "";
      vaultTitle.value = "";
      vaultDescription.value = "";
      vaultDifficulty.value = 1;
      secret.value = "";
      secretConfirm.value = "";
    },
    breaker.loadRecentVaults,
  );
};

watch(secret, async (value) => {
  secretHash.value = value ? await sha256Hex(value) : "";
});

onMounted(() => {
  breaker.loadRecentVaults();
  creator.loadMyVaults();
});

const resetAndReload = async () => {
  breaker.loadRecentVaults();
  creator.loadMyVaults();
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "./unbreakable-vault-theme.scss" as *;

:global(body) {
  background: var(--bg-primary);
  font-family: var(--vault-font);
}

.hero-container {
  margin-bottom: 20px;
}

.vault-scene {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 90px;
}

.vault-door {
  width: 70px;
  height: 70px;
  border-radius: 8px;
  background: linear-gradient(135deg, rgba(0, 229, 153, 0.1), rgba(0, 229, 153, 0.05));
  border: 2px solid rgba(0, 229, 153, 0.2);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
}

.vault-handle {
  width: 30px;
  height: 30px;
  border: 3px solid rgba(0, 229, 153, 0.3);
  border-radius: 50%;
  position: absolute;
  top: 10px;
  right: 10px;
}

.vault-lock {
  font-size: 20px;
  margin-top: 8px;
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

/* ── Unbreakable Vault Hero Enhancements ── */
@keyframes vault-lock-rotate {
  0%,
  70% {
    transform: rotate(0deg);
  }
  75% {
    transform: rotate(-15deg);
  }
  80% {
    transform: rotate(10deg);
  }
  85% {
    transform: rotate(-8deg);
  }
  90% {
    transform: rotate(5deg);
  }
  95% {
    transform: rotate(-2deg);
  }
  100% {
    transform: rotate(0deg);
  }
}

@keyframes vault-laser-grid {
  0% {
    background-position: 0 0;
    opacity: 0.3;
  }
  50% {
    background-position: 10px 10px;
    opacity: 0.6;
  }
  100% {
    background-position: 0 0;
    opacity: 0.3;
  }
}

@keyframes vault-steel-gradient {
  0% {
    background-position: 0% 50%;
  }
  50% {
    background-position: 100% 50%;
  }
  100% {
    background-position: 0% 50%;
  }
}

@keyframes vault-door-glow {
  0%,
  100% {
    box-shadow:
      0 0 16px rgba(0, 229, 153, 0.1),
      inset 0 0 12px rgba(0, 229, 153, 0.05);
  }
  50% {
    box-shadow:
      0 0 32px rgba(0, 229, 153, 0.25),
      inset 0 0 20px rgba(0, 229, 153, 0.1);
  }
}

.hero-container {
  background: linear-gradient(135deg, rgba(107, 114, 128, 0.1), rgba(75, 85, 99, 0.06), rgba(192, 192, 192, 0.04));
  background-size: 200% 200%;
  animation: vault-steel-gradient 8s ease-in-out infinite;
  box-shadow:
    0 0 30px rgba(107, 114, 128, 0.1),
    inset 0 1px 0 rgba(192, 192, 192, 0.08);
  border: 1px solid rgba(107, 114, 128, 0.12);
  border-radius: 16px;
  padding: 20px;
  position: relative;
  overflow: hidden;

  &::before {
    content: "";
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgba(0, 229, 153, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(0, 229, 153, 0.03) 1px, transparent 1px);
    background-size: 20px 20px;
    animation: vault-laser-grid 6s linear infinite;
    pointer-events: none;
    z-index: 0;
  }
}

.vault-door {
  animation: vault-door-glow 4s ease-in-out infinite;
  position: relative;
  z-index: 1;
}

.vault-handle {
  animation: vault-lock-rotate 6s ease-in-out infinite;
  transform-origin: center;
  box-shadow: 0 0 8px rgba(0, 229, 153, 0.2);
}

.hero-stat {
  box-shadow: 0 0 16px rgba(107, 114, 128, 0.1);
  background: linear-gradient(135deg, rgba(107, 114, 128, 0.1), rgba(192, 192, 192, 0.04));
  position: relative;
  z-index: 1;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.input-label {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--vault-text-muted);
  margin-left: 4px;
  letter-spacing: 0.05em;
}

.helper-text {
  font-size: 12px;
  color: var(--vault-text-subtle);
  margin-left: 8px;
  margin-top: 4px;
}

.vault-created {
  text-align: center;
}

.vault-created-label {
  font-size: 12px;
  text-transform: uppercase;
  color: var(--vault-text-muted);
}

.vault-created-id {
  font-size: 32px;
  font-weight: 800;
  color: var(--vault-text-strong);
  margin-top: 8px;
}
</style>
