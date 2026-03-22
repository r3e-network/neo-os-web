<template>
  <div class="page-container">
    <FlashloanDocs :t="t" :contract-address="contractAddress" :network-label="networkLabel" />
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useWallet } from "@shared/utils/wallet-sdk";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import FlashloanDocs from "../index/components/FlashloanDocs.vue";

const { t } = createUseI18n(messages)();
const { chainId, appChainId, getContractAddress } = useWallet() as WalletSDK;
const contractAddress = ref<string | null>(null);
const isMounted = ref(true);

const networkLabel = computed(() => {
  const id = String(appChainId?.value || chainId?.value || "");
  if (id.includes("mainnet")) return t("neoN3Mainnet");
  if (id.includes("testnet")) return t("neoN3Testnet");
  return t("neoN3Network");
});

onMounted(async () => {
  if (!isMounted.value) return;
  try {
    contractAddress.value = await getContractAddress();
  } catch (e: unknown) {
    // Contract address fetch failed — docs page works without it; contractAddress
    // being null is handled by FlashloanDocs component showing "not available"
    console.warn("[flashloan-docs] contract address fetch failed:", e instanceof Error ? e.message : String(e));
    contractAddress.value = null;
  }
});

onUnmounted(() => {
  isMounted.value = false;
});
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background: var(--bg-body);
}
</style>
