<template>
  <view class="tab-content">
    <DomainSearch
      :t="t"
      v-model:search-query="searchQuery"
      :search-result="searchResult"
      :loading="loading"
      @search="checkAvailability"
      @register="handleRegister"
    />
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { parseInvokeResult } from "@shared/utils/neo";
import { requireNeoChain } from "@shared/utils/chain";
import { domainToTokenId, ensureNeoWalletAndChain, handleNeoInvocation } from "@/utils/neoHelpers";
import DomainSearch from "./DomainSearch.vue";
import type { SearchResult } from "@/types";

const props = defineProps<{
  t: (key: string) => string;
  nnsContract: string;
}>();

const emit = defineEmits<{
  (e: "status", msg: string, type: "success" | "error"): void;
  (e: "refresh"): void;
}>();

const { address, chainType, invokeRead, invokeContract } = useWallet() as WalletSDK;

const searchQuery = ref("");
const searchResult = ref<SearchResult | null>(null);
const loading = ref(false);
const searchDebounce = ref<ReturnType<typeof setTimeout> | null>(null);

async function checkAvailability() {
  if (!searchQuery.value || searchQuery.value.length < 1) {
    searchResult.value = null;
    return;
  }

  if (searchDebounce.value) {
    clearTimeout(searchDebounce.value);
  }

  searchDebounce.value = setTimeout(async () => {
    if (!requireNeoChain(chainType, props.t)) return;
    loading.value = true;
    try {
      const name = searchQuery.value.toLowerCase();
      const result = await handleNeoInvocation(
        async () => {
          const availableResult = await invokeRead({
            scriptHash: props.nnsContract,
            operation: "isAvailable",
            args: [{ type: "String", value: name + ".neo" }],
          });
          const isAvailable = Boolean(parseInvokeResult(availableResult));

          const priceResult = await invokeRead({
            scriptHash: props.nnsContract,
            operation: "getPrice",
            args: [{ type: "Integer", value: name.length }],
          });
          const priceRaw = Number(parseInvokeResult(priceResult) || 0);
          const price = priceRaw / 1e8;

          if (isAvailable) {
            return { available: true as const, price };
          }

          try {
            const ownerResult = await invokeRead({
              scriptHash: props.nnsContract,
              operation: "ownerOf",
              args: [{ type: "ByteArray", value: domainToTokenId(name) }],
            });
            const owner = String(parseInvokeResult(ownerResult) || "");
            return { available: false as const, owner };
          } catch {
            return { available: false as const, owner: props.t("unknownOwner") };
          }
        },
        props.t,
        "availabilityFailed",
        (message, type = "error") => emit("status", message, type),
      );

      if (!result) {
        searchResult.value = null;
        return;
      }

      searchResult.value = result;
    } finally {
      loading.value = false;
    }
  }, 500);
}

async function handleRegister() {
  if (!searchResult.value?.available || searchResult.value.price === undefined || loading.value) return;
  if (!ensureNeoWalletAndChain(chainType, address.value, props.t, (message, type = "error") => emit("status", message, type))) {
    return;
  }

  loading.value = true;
  try {
    const name = searchQuery.value.toLowerCase();
    const registerResult = await handleNeoInvocation(
      async () =>
        invokeContract({
          scriptHash: props.nnsContract,
          operation: "register",
          args: [
            { type: "String", value: name + ".neo" },
            { type: "Hash160", value: address.value },
          ],
        }),
      props.t,
      "registrationFailed",
      (message, type = "error") => emit("status", message, type),
    );
    if (registerResult === null) return;

    emit("status", name + ".neo " + props.t("registered"), "success");
    searchQuery.value = "";
    searchResult.value = null;
    emit("refresh");
  } finally {
    loading.value = false;
  }
}
</script>

<style lang="scss" scoped>
.tab-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
  flex: 1;
}
</style>
