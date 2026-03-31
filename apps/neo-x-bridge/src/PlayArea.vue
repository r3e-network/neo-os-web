<template>
  <div class="bridge-play-area">
    <NetworkToggle
      :t="t"
      :selected-network="selectedNetwork"
      @select="selectNetwork"
    />

    <NetworkInfoCard
      :t="t"
      :network-name="networkName"
      :chain-id="chainId"
      :bridge-url="bridgeUrl"
    />

    <BridgeNotesCard :t="t" />

    <BridgeActions
      :t="t"
      @open-bridge="handleOpenBridge"
      @add-wallet="handleAddWallet"
      @open-explorer="handleOpenExplorer"
      @open-docs="handleOpenDocs"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import NetworkToggle from "./components/NetworkToggle.vue";
import NetworkInfoCard from "./components/NetworkInfoCard.vue";
import BridgeNotesCard from "./components/BridgeNotesCard.vue";
import BridgeActions from "./components/BridgeActions.vue";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

const selectedNetwork = computed(() => String(props.state.selectedNetwork?.value ?? "mainnet"));
const networkName = computed(() => String(props.state.networkName?.value ?? ""));
const bridgeUrl = computed(() => String(props.state.bridgeUrl?.value ?? ""));
const chainId = computed(() => String(props.state.chainId?.value ?? ""));

const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const selectNetwork = (key: string) => {
  const handler = actions.get("selectNetwork");
  if (handler) handler(key);
};

const handleOpenBridge = () => {
  const handler = actions.get("openBridge");
  if (handler) handler();
};

const handleAddWallet = () => {
  const handler = actions.get("addWallet");
  if (handler) handler();
};

const handleOpenExplorer = () => {
  const handler = actions.get("openExplorer");
  if (handler) handler();
};

const handleOpenDocs = () => {
  const handler = actions.get("openDocs");
  if (handler) handler();
};
</script>

<style lang="scss" scoped>
.bridge-play-area {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 20px 12px;
  min-height: 300px;
}

@media (max-width: 480px) {
  .bridge-play-area {
    padding: 12px 8px;
  }
}
</style>
