<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Algo Battle</text>
      <text class="subtitle">Code gladiator arena</text>
    </view>

    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>

    <view class="card battle-card">
      <view class="battle-header">
        <text class="battle-title">{{ battleState === "idle" ? "Ready to Battle" : "Battle in Progress" }}</text>
        <text class="timer">{{ countdown }}</text>
      </view>
      <view class="fighters">
        <view class="fighter">
          <text class="fighter-name">{{ player1.name }}</text>
          <view class="health-bar">
            <view class="health-fill" :style="{ width: player1.health + '%' }"></view>
          </view>
          <text class="health-text">{{ player1.health }}%</text>
        </view>
        <text class="vs">VS</text>
        <view class="fighter">
          <text class="fighter-name">{{ player2.name }}</text>
          <view class="health-bar">
            <view class="health-fill" :style="{ width: player2.health + '%' }"></view>
          </view>
          <text class="health-text">{{ player2.health }}%</text>
        </view>
      </view>
    </view>

    <view class="card">
      <text class="card-title">Your Algorithm</text>
      <view class="algo-selector">
        <view
          v-for="algo in algorithms"
          :key="algo.id"
          :class="['algo-item', selectedAlgo === algo.id ? 'selected' : '']"
          @click="selectAlgo(algo.id)"
        >
          <text class="algo-name">{{ algo.name }}</text>
          <text class="algo-desc">{{ algo.desc }}</text>
        </view>
      </view>
    </view>

    <view class="card">
      <text class="card-title">Entry Fee</text>
      <view class="fee-row">
        <uni-easyinput v-model="entryFee" type="digit" placeholder="1.0" class="fee-input" />
        <text class="fee-label">GAS</text>
      </view>
      <view class="action-btn" @click="startBattle" :style="{ opacity: isLoading || battleState !== 'idle' ? 0.6 : 1 }">
        <text>{{ battleState === "idle" ? "Start Battle" : "Battle Running..." }}</text>
      </view>
    </view>

    <view class="card">
      <text class="card-title">Battle Log</text>
      <view class="log-list">
        <text v-if="battleLog.length === 0" class="empty">No battles yet</text>
        <view v-for="(log, i) in battleLog" :key="i" class="log-item">
          <text class="log-text">{{ log }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { usePayments } from "@neo/uniapp-sdk";

const APP_ID = "miniapp-algo-battle";

const { payGAS, isLoading } = usePayments(APP_ID);

const entryFee = ref("1.0");
const selectedAlgo = ref("quicksort");
const battleState = ref<"idle" | "fighting">("idle");
const countdown = ref(30);
const status = ref<{ msg: string; type: string } | null>(null);

const player1 = ref({ name: "QuickSort", health: 100 });
const player2 = ref({ name: "MergeSort", health: 100 });

const algorithms = [
  { id: "quicksort", name: "QuickSort", desc: "Fast & aggressive" },
  { id: "mergesort", name: "MergeSort", desc: "Stable & balanced" },
  { id: "heapsort", name: "HeapSort", desc: "Memory efficient" },
  { id: "bubblesort", name: "BubbleSort", desc: "Simple but slow" },
];

const battleLog = ref<string[]>([]);

const selectAlgo = (id: string) => {
  if (battleState.value === "idle") {
    selectedAlgo.value = id;
    const algo = algorithms.find((a) => a.id === id);
    if (algo) {
      player1.value.name = algo.name;
    }
  }
};

const startBattle = async () => {
  if (isLoading.value || battleState.value !== "idle") return;

  try {
    status.value = { msg: "Entering arena...", type: "loading" };
    await payGAS(entryFee.value, `battle:${selectedAlgo.value}:${Date.now()}`);

    battleState.value = "fighting";
    player1.value.health = 100;
    player2.value.health = 100;
    battleLog.value = [];
    countdown.value = 30;

    status.value = { msg: "Battle started!", type: "success" };
    battleLog.value.push(`${player1.value.name} enters the arena!`);
    battleLog.value.push(`${player2.value.name} accepts the challenge!`);
  } catch (e: any) {
    status.value = { msg: e.message || "Error starting battle", type: "error" };
  }
};

let battleTimer: number;
onMounted(() => {
  battleTimer = setInterval(() => {
    if (battleState.value === "fighting") {
      countdown.value--;

      if (Math.random() < 0.3) {
        const damage = Math.floor(Math.random() * 15) + 5;
        if (Math.random() < 0.5) {
          player2.value.health = Math.max(0, player2.value.health - damage);
          battleLog.value.unshift(`${player1.value.name} deals ${damage} damage!`);
        } else {
          player1.value.health = Math.max(0, player1.value.health - damage);
          battleLog.value.unshift(`${player2.value.name} deals ${damage} damage!`);
        }
        battleLog.value = battleLog.value.slice(0, 8);
      }

      if (player1.value.health <= 0 || player2.value.health <= 0 || countdown.value <= 0) {
        const winner = player1.value.health > player2.value.health ? player1.value.name : player2.value.name;
        battleLog.value.unshift(`🏆 ${winner} wins the battle!`);
        status.value = {
          msg: winner === player1.value.name ? "Victory! You won!" : "Defeat! Better luck next time.",
          type: winner === player1.value.name ? "success" : "error",
        };
        battleState.value = "idle";
        countdown.value = 30;
      }
    }
  }, 1000);
});

onUnmounted(() => clearInterval(battleTimer));
</script>

<style lang="scss">
@import "@/shared/styles/theme.scss";

.app-container {
  min-height: 100vh;
  background: linear-gradient(135deg, $color-bg-primary 0%, $color-bg-secondary 100%);
  color: $color-text-primary;
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
  &.error {
    background: rgba($color-error, 0.15);
    color: $color-error;
  }
  &.loading {
    background: rgba($color-gaming, 0.15);
    color: $color-gaming;
  }
}

.card {
  background: $color-bg-card;
  border: 1px solid $color-border;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
}

.battle-card {
  padding: 24px;
}

.battle-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.battle-title {
  color: $color-gaming;
  font-size: 1.1em;
  font-weight: bold;
}

.timer {
  color: $color-text-secondary;
  font-size: 1.2em;
  font-weight: bold;
}

.fighters {
  display: flex;
  align-items: center;
  gap: 16px;
}

.fighter {
  flex: 1;
  text-align: center;
}

.fighter-name {
  color: $color-gaming;
  font-weight: bold;
  font-size: 1.1em;
  display: block;
  margin-bottom: 12px;
}

.health-bar {
  height: 12px;
  background: rgba($color-gaming, 0.2);
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 8px;
}

.health-fill {
  height: 100%;
  background: linear-gradient(90deg, $color-gaming 0%, $color-success 100%);
  transition: width 0.3s ease;
}

.health-text {
  color: $color-text-secondary;
  font-size: 0.9em;
}

.vs {
  color: $color-gaming;
  font-size: 1.5em;
  font-weight: bold;
}

.card-title {
  color: $color-gaming;
  font-size: 1.1em;
  font-weight: bold;
  display: block;
  margin-bottom: 16px;
}

.algo-selector {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.algo-item {
  padding: 12px;
  background: rgba($color-gaming, 0.1);
  border: 1px solid transparent;
  border-radius: 8px;
  &.selected {
    border-color: $color-gaming;
    background: rgba($color-gaming, 0.2);
  }
}

.algo-name {
  color: $color-gaming;
  font-weight: bold;
  display: block;
  margin-bottom: 4px;
}

.algo-desc {
  color: $color-text-secondary;
  font-size: 0.85em;
}

.fee-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.fee-input {
  flex: 1;
}

.fee-label {
  color: $color-text-secondary;
  font-weight: bold;
}

.action-btn {
  background: linear-gradient(135deg, $color-gaming 0%, darken($color-gaming, 10%) 100%);
  color: #fff;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  font-weight: bold;
}

.log-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.empty {
  color: $color-text-secondary;
  text-align: center;
}

.log-item {
  padding: 8px 12px;
  background: rgba($color-gaming, 0.1);
  border-radius: 6px;
}

.log-text {
  color: $color-text-primary;
  font-size: 0.9em;
}
</style>
