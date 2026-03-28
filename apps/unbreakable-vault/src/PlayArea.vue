<template>
  <div class="vault-play-area">
    <VaultHero
      :t="t"
      :my-vault-count="myVaultCount"
      :recent-vault-count="recentVaultCount"
    />

    <!-- Vault List -->
    <div class="vault-list-container">
      <div v-if="myVaultCount === 0" class="empty-state">
        <span>{{ t("noRecentVaults") }}</span>
      </div>
    </div>

    <VaultConfirmation :t="t" :created-vault-id="createdVaultId" />
  </div>
</template>

<script setup lang="ts">
/**
 * PlayArea.vue — The ONLY custom component for Unbreakable Vault
 *
 * Renders the vault hero section with create/break counts, the vault
 * list display, and the created vault confirmation card.
 *
 * Everything else (sidebar, stats tab, docs tab, shell chrome) is
 * rendered by the platform based on manifest.ts configuration.
 */
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import VaultHero from "./components/VaultHero.vue";
import VaultConfirmation from "./components/VaultConfirmation.vue";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

const myVaultCount = computed(() => Number(props.state.myVaultCount?.value ?? 0));
const recentVaultCount = computed(() => Number(props.state.recentVaultCount?.value ?? 0));
const createdVaultId = computed(() => (props.state.createdVaultId?.value as string | number | null) ?? null);

const actions = inject(MINIAPP_ACTIONS_KEY, new Map());
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.vault-play-area {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px 12px;
  min-height: 300px;
}

.empty-state {
  text-align: center;
  padding: 24px;
  color: rgba(255, 255, 255, 0.4);
  font-size: 14px;
}
</style>
