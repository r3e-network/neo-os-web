<script setup lang="ts">
/**
 * App - TrustAnchor Root Component
 *
 * Initializes chain validation and renders main page.
 * Automatically switches to Neo N3 network if needed.
 *
 * @example
 * ```vue
 * <App />
 * ```
 */

import { onMounted } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useAppInit } from "@shared/composables/useAppInit";

useAppInit();

const { chainType, switchToAppChain } = useWallet() as WalletSDK;

onMounted(() => {
  if (chainType.value && chainType.value !== "neo-n3" && chainType.value !== "neo-n3-testnet") {
    switchToAppChain("neo-n3-testnet");
  }
});
</script>

<template>
  <view class="app-container">
    <IndexPage />
  </view>
</template>

<style lang="scss">
@import "@shared/styles/tokens.scss";

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body,
#app,
.app-container {
  width: 100%;
  height: 100%;
  background: var(--erobo-ink);
  color: white;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
}

button {
  border: none;
  outline: none;
}
</style>
