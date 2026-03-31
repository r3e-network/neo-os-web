<template>
  <div class="capsule-play-area">
    <CapsuleHero
      :t="t"
      :total-capsules="totalCapsules"
      :locked-count="lockedCount"
      :revealed-count="revealedCount"
    />

    <CapsuleList :t="t" :total-capsules="totalCapsules" />
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import CapsuleHero from "./components/CapsuleHero.vue";
import CapsuleList from "./components/CapsuleList.vue";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

const totalCapsules = computed(() => Number(props.state.totalCapsules?.value ?? 0));
const lockedCount = computed(() => Number(props.state.lockedCount?.value ?? 0));
const revealedCount = computed(() => Number(props.state.revealedCount?.value ?? 0));

const actions = inject(MINIAPP_ACTIONS_KEY, new Map());
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.capsule-play-area {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 20px 12px;
  min-height: 300px;
}
</style>
