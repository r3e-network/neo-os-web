<template>
  <view class="page-container">
    <FlashloanDocs :t="t" :contract-address="contractAddress" :network-label="networkLabel" />
  </view>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import type { WalletSDK } from "@neo/types";
import FlashloanDocs from "../index/components/FlashloanDocs.vue";

const { t } = createUseI18n(messages)();
const { chainId, appChainId, getContractAddress } = useWallet() as WalletSDK;
const contractAddress = ref<string | null>(null);

const networkLabel = computed(() => {
  const id = String(appChainId?.value || chainId?.value || "");
  if (id.includes("mainnet")) return t("neoN3Mainnet");
  if (id.includes("testnet")) return t("neoN3Testnet");
  return t("neoN3Network");
});

onMounted(async () => {
  try {
    contractAddress.value = await getContractAddress();
  } catch (e: unknown) {
    contractAddress.value = null;
  }
});
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background: var(--bg-body);
}
</style>
