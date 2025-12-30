<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Scream to Earn</text>
      <text class="subtitle">Louder = More rewards</text>
    </view>
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>
    <view class="card">
      <view class="stats-row">
        <view class="stat">
          <text class="stat-value">{{ totalEarned }}</text>
          <text class="stat-label">GAS Earned</text>
        </view>
        <view class="stat">
          <text class="stat-value">{{ screamCount }}</text>
          <text class="stat-label">Screams</text>
        </view>
        <view class="stat">
          <text class="stat-value">{{ maxDecibel }}</text>
          <text class="stat-label">Max dB</text>
        </view>
      </view>
    </view>
    <view class="card">
      <text class="card-title">Voice Meter</text>
      <view class="meter-display">
        <view class="meter-bar">
          <view class="meter-fill" :style="{ width: `${currentLevel}%` }"></view>
        </view>
        <text class="decibel-text">{{ currentDecibel }} dB</text>
      </view>
      <view class="scream-icon">{{ isRecording ? "🔊" : "🎤" }}</view>
      <view class="scream-btn" @click="toggleRecording">
        <text>{{ isRecording ? "Stop Screaming" : "Start Screaming" }}</text>
      </view>
    </view>
    <view v-if="lastReward" class="reward-card">
      <text class="reward-text">Earned {{ lastReward }} GAS!</text>
      <text class="reward-hint">Keep screaming for more</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onUnmounted } from "vue";
import { usePayments } from "@neo/uniapp-sdk";

const APP_ID = "miniapp-scream-to-earn";
const { payGAS } = usePayments(APP_ID);

const totalEarned = ref(0);
const screamCount = ref(0);
const maxDecibel = ref(0);
const currentDecibel = ref(0);
const currentLevel = ref(0);
const isRecording = ref(false);
const lastReward = ref<number | null>(null);
const status = ref<{ msg: string; type: string } | null>(null);
let recordingInterval: number | null = null;

const simulateAudioLevel = () => {
  const randomDb = Math.floor(Math.random() * 40) + 60;
  currentDecibel.value = randomDb;
  currentLevel.value = Math.min(((randomDb - 60) / 40) * 100, 100);

  if (randomDb > maxDecibel.value) {
    maxDecibel.value = randomDb;
  }

  if (randomDb > 85) {
    const reward = parseFloat(((randomDb - 85) * 0.01).toFixed(2));
    totalEarned.value = parseFloat((totalEarned.value + reward).toFixed(2));
    lastReward.value = reward;
    status.value = { msg: `${randomDb} dB! Earned ${reward} GAS`, type: "success" };
  }
};

const toggleRecording = () => {
  if (isRecording.value) {
    if (recordingInterval) {
      clearInterval(recordingInterval);
      recordingInterval = null;
    }
    isRecording.value = false;
    currentDecibel.value = 0;
    currentLevel.value = 0;
    screamCount.value++;
  } else {
    isRecording.value = true;
    lastReward.value = null;
    recordingInterval = setInterval(simulateAudioLevel, 200) as unknown as number;
  }
};

onUnmounted(() => {
  if (recordingInterval) {
    clearInterval(recordingInterval);
  }
});
</script>

<style lang="scss">
@import "@/shared/styles/theme.scss";
.app-container {
  min-height: 100vh;
  background: linear-gradient(135deg, $color-bg-primary 0%, $color-bg-secondary 100%);
  color: #fff;
  padding: 20px;
}
.header {
  text-align: center;
  margin-bottom: 24px;
}
.title {
  font-size: 1.8em;
  font-weight: bold;
  color: $color-gaming;
}
.subtitle {
  color: $color-text-secondary;
  font-size: 0.9em;
  margin-top: 8px;
}
.status-msg {
  text-align: center;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
  &.success {
    background: rgba($color-success, 0.15);
    color: $color-success;
  }
}
.card {
  background: $color-bg-card;
  border: 1px solid $color-border;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
}
.card-title {
  color: $color-gaming;
  font-size: 1.1em;
  font-weight: bold;
  display: block;
  margin-bottom: 16px;
}
.stats-row {
  display: flex;
  gap: 12px;
}
.stat {
  flex: 1;
  text-align: center;
  background: rgba($color-gaming, 0.1);
  border-radius: 8px;
  padding: 12px;
}
.stat-value {
  color: $color-gaming;
  font-size: 1.3em;
  font-weight: bold;
  display: block;
}
.stat-label {
  color: $color-text-secondary;
  font-size: 0.8em;
}
.meter-display {
  margin-bottom: 20px;
}
.meter-bar {
  height: 40px;
  background: rgba(#000, 0.3);
  border-radius: 20px;
  overflow: hidden;
  margin-bottom: 12px;
}
.meter-fill {
  height: 100%;
  background: linear-gradient(90deg, $color-gaming 0%, lighten($color-gaming, 15%) 100%);
  transition: width 0.2s ease;
}
.decibel-text {
  text-align: center;
  font-size: 1.5em;
  font-weight: bold;
  color: $color-gaming;
  display: block;
}
.scream-icon {
  text-align: center;
  font-size: 4em;
  margin: 20px 0;
}
.scream-btn {
  background: linear-gradient(135deg, $color-gaming 0%, darken($color-gaming, 10%) 100%);
  color: #fff;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  font-weight: bold;
}
.reward-card {
  background: rgba($color-gaming, 0.15);
  border-radius: 16px;
  padding: 24px;
  text-align: center;
}
.reward-text {
  font-size: 1.5em;
  font-weight: bold;
  color: $color-gaming;
  display: block;
  margin-bottom: 8px;
}
.reward-hint {
  color: $color-text-secondary;
  font-size: 0.9em;
}
</style>
