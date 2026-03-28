<template>
  <div class="sign-play-area">
    <SignHero :t="t" />

    <SignResultCards
      :t="t"
      :signature="signature"
      :tx-hash="txHash"
      @copy="handleCopy"
    />

    <SignOperationPanel
      :t="t"
      :message="message"
      :address="address"
      :is-signing="isSigning"
      :is-broadcasting="isBroadcasting"
      @update:message="message = $event"
      @sign="handleSign"
      @broadcast="handleBroadcast"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, inject } from "vue";
import type { Ref } from "vue";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import SignHero from "./components/SignHero.vue";
import SignResultCards from "./components/SignResultCards.vue";
import SignOperationPanel from "./components/SignOperationPanel.vue";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

const message = ref("");

const address = computed(() => String(props.state.address?.value ?? ""));
const signature = computed(() => String(props.state.signature?.value ?? ""));
const txHash = computed(() => String(props.state.txHash?.value ?? ""));
const isSigning = computed(() => Boolean(props.state.isSigning?.value ?? false));
const isBroadcasting = computed(() => Boolean(props.state.isBroadcasting?.value ?? false));

const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const handleSign = async () => {
  const handler = actions.get("signMessage");
  if (handler) await handler(message.value);
};

const handleBroadcast = async () => {
  const handler = actions.get("broadcastMessage");
  if (handler) await handler(message.value);
};

const handleCopy = async (text: string) => {
  const handler = actions.get("copyToClipboard");
  if (handler) await handler(text);
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.sign-play-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 20px 12px;
  min-height: 300px;
}
</style>
