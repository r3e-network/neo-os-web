<template>
  <view class="app-container">
    <view class="header">
      <text class="title">World Piano</text>
      <text class="subtitle">Play together, create music</text>
    </view>
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>
    <view class="card">
      <view class="stats-row">
        <view class="stat">
          <text class="stat-value">{{ onlinePlayers }}</text>
          <text class="stat-label">Online</text>
        </view>
        <view class="stat">
          <text class="stat-value">{{ notesPlayed }}</text>
          <text class="stat-label">Notes</text>
        </view>
        <view class="stat">
          <text class="stat-value">{{ songsCreated }}</text>
          <text class="stat-label">Songs</text>
        </view>
      </view>
    </view>
    <view class="card">
      <text class="card-title">Piano Keyboard</text>
      <view class="keyboard">
        <view
          v-for="note in whiteKeys"
          :key="note.key"
          :class="['key', 'white', activeNote === note.key && 'active']"
          @click="playNote(note)"
        >
          <text class="note-label">{{ note.label }}</text>
        </view>
      </view>
      <view class="black-keys">
        <view
          v-for="note in blackKeys"
          :key="note.key"
          :class="['key', 'black', activeNote === note.key && 'active']"
          :style="{ left: note.position }"
          @click="playNote(note)"
        >
        </view>
      </view>
    </view>
    <view class="card">
      <text class="card-title">Recent Activity</text>
      <view v-for="(activity, idx) in recentActivity" :key="idx" class="activity-item">
        <text class="activity-user">{{ activity.user }}</text>
        <text class="activity-note">played {{ activity.note }}</text>
        <text class="activity-time">{{ activity.time }}s ago</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments } from "@neo/uniapp-sdk";

const APP_ID = "miniapp-world-piano";
const { payGAS } = usePayments(APP_ID);

const onlinePlayers = ref(42);
const notesPlayed = ref(1337);
const songsCreated = ref(89);
const activeNote = ref<string | null>(null);
const status = ref<{ msg: string; type: string } | null>(null);

const whiteKeys = [
  { key: "C", label: "C", freq: 261.63 },
  { key: "D", label: "D", freq: 293.66 },
  { key: "E", label: "E", freq: 329.63 },
  { key: "F", label: "F", freq: 349.23 },
  { key: "G", label: "G", freq: 392.0 },
  { key: "A", label: "A", freq: 440.0 },
  { key: "B", label: "B", freq: 493.88 },
];

const blackKeys = [
  { key: "C#", freq: 277.18, position: "10%" },
  { key: "D#", freq: 311.13, position: "24%" },
  { key: "F#", freq: 369.99, position: "52%" },
  { key: "G#", freq: 415.3, position: "66%" },
  { key: "A#", freq: 466.16, position: "80%" },
];

const recentActivity = ref([
  { user: "Player#1234", note: "C", time: 2 },
  { user: "Player#5678", note: "E", time: 5 },
  { user: "Player#9012", note: "G", time: 8 },
]);

const playNote = (note: { key: string; freq: number }) => {
  activeNote.value = note.key;
  notesPlayed.value++;
  status.value = { msg: `Played ${note.key} (${note.freq.toFixed(2)} Hz)`, type: "success" };

  recentActivity.value.unshift({
    user: "You",
    note: note.key,
    time: 0,
  });
  if (recentActivity.value.length > 5) {
    recentActivity.value.pop();
  }

  setTimeout(() => {
    activeNote.value = null;
  }, 300);
};
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
  position: relative;
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
.keyboard {
  display: flex;
  gap: 2px;
  position: relative;
  height: 120px;
}
.key {
  flex: 1;
  border-radius: 0 0 8px 8px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding-bottom: 12px;
  transition: all 0.1s ease;
  &.white {
    background: linear-gradient(180deg, #fff 0%, #e0e0e0 100%);
    border: 1px solid #999;
    &.active {
      background: linear-gradient(180deg, $color-gaming 0%, darken($color-gaming, 10%) 100%);
      transform: translateY(2px);
    }
  }
  &.black {
    position: absolute;
    width: 12%;
    height: 70px;
    background: linear-gradient(180deg, #333 0%, #000 100%);
    border: 1px solid #000;
    z-index: 2;
    &.active {
      background: linear-gradient(180deg, $color-gaming 0%, darken($color-gaming, 20%) 100%);
    }
  }
}
.note-label {
  color: #333;
  font-size: 0.9em;
  font-weight: bold;
}
.black-keys {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 120px;
}
.activity-item {
  display: flex;
  gap: 8px;
  padding: 10px;
  background: rgba($color-gaming, 0.05);
  border-radius: 8px;
  margin-bottom: 8px;
  align-items: center;
}
.activity-user {
  color: $color-gaming;
  font-weight: bold;
  flex-shrink: 0;
}
.activity-note {
  color: $color-text-secondary;
  flex: 1;
}
.activity-time {
  color: $color-text-tertiary;
  font-size: 0.85em;
  flex-shrink: 0;
}
</style>
