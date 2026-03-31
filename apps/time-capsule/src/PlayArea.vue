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
@import url('https://fonts.googleapis.com/css2?family=Special+Elite&display=swap');

.capsule-play-area {
  display: flex;
  flex-direction: column;
  gap: 24px;
  padding: 24px 16px;
  min-height: 300px;
  font-family: 'Special Elite', 'Courier New', monospace;
  background:
    url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2392400E' fill-opacity='0.03'%3E%3Ccircle cx='30' cy='30' r='1.5'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E"),
    linear-gradient(180deg, #FDF6E3 0%, #F5E6D3 40%, #EDD8BF 100%);
  color: #44403C;
  border-radius: 12px;
  border: 2px solid #D4A853;
  position: relative;
  box-shadow: inset 0 0 40px rgba(146, 64, 14, 0.06), 0 4px 24px rgba(0, 0, 0, 0.1);
}

.capsule-play-area::before {
  content: "";
  position: absolute;
  inset: 4px;
  border: 1px dashed rgba(212, 168, 83, 0.3);
  border-radius: 8px;
  pointer-events: none;
}

.capsule-play-area::after {
  content: "";
  position: absolute;
  top: 12px;
  right: 12px;
  width: 40px;
  height: 40px;
  background:
    radial-gradient(circle, transparent 30%, rgba(146, 64, 14, 0.06) 31%, rgba(146, 64, 14, 0.06) 50%, transparent 51%),
    radial-gradient(circle, rgba(212, 168, 83, 0.15) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
}
</style>
