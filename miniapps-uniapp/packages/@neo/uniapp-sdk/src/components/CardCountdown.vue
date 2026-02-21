<template>
  <view class="card-countdown">
    <view class="countdown-timer">
      <text class="time-value">{{ hours }}</text>
      <text class="time-sep">:</text>
      <text class="time-value">{{ minutes }}</text>
      <text class="time-sep">:</text>
      <text class="time-value">{{ seconds }}</text>
    </view>
    <view class="jackpot">
      <text class="jackpot-label">Jackpot</text>
      <text class="jackpot-value">{{ jackpot }} GAS</text>
    </view>
    <view class="tickets">
      <text>{{ ticketsSold }} tickets sold</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import type { CountdownData } from "../card-types";

const props = defineProps<{ data: CountdownData }>();

const now = ref(Math.floor(Date.now() / 1000));
let timer: number;

const remaining = computed(() => Math.max(0, props.data.endTime - now.value));
const hours = computed(() => String(Math.floor(remaining.value / 3600)).padStart(2, "0"));
const minutes = computed(() => String(Math.floor((remaining.value % 3600) / 60)).padStart(2, "0"));
const seconds = computed(() => String(remaining.value % 60).padStart(2, "0"));
const jackpot = computed(() => props.data.jackpot);
const ticketsSold = computed(() => props.data.ticketsSold);

onMounted(() => {
  timer = setInterval(() => {
    now.value = Math.floor(Date.now() / 1000);
  }, 1000) as unknown as number;
});
onUnmounted(() => clearInterval(timer));
</script>

<style scoped lang="scss">
.card-countdown {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  border-radius: 12px;
  padding: 16px;
  color: #fff;
  text-align: center;
}
.countdown-timer {
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 12px;
}
.time-value {
  font-size: 2em;
  font-weight: bold;
  background: rgba(0, 0, 0, 0.2);
  padding: 4px 8px;
  border-radius: 6px;
}
.time-sep {
  font-size: 1.5em;
  margin: 0 4px;
}
.jackpot {
  margin-bottom: 8px;
}
.jackpot-label {
  font-size: 0.8em;
  opacity: 0.8;
  display: block;
}
.jackpot-value {
  font-size: 1.4em;
  font-weight: bold;
}
.tickets {
  font-size: 0.85em;
  opacity: 0.9;
}
</style>
