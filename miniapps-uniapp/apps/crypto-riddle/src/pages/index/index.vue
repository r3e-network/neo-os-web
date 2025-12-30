<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Crypto Riddle</text>
      <text class="subtitle">Solve puzzles, earn rewards</text>
    </view>
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>
    <view class="card">
      <view class="stats-row">
        <view class="stat">
          <text class="stat-value">{{ solvedCount }}</text>
          <text class="stat-label">Solved</text>
        </view>
        <view class="stat">
          <text class="stat-value">{{ totalRewards }}</text>
          <text class="stat-label">GAS Earned</text>
        </view>
        <view class="stat">
          <text class="stat-value">{{ currentStreak }}</text>
          <text class="stat-label">Streak</text>
        </view>
      </view>
    </view>
    <view class="card">
      <view class="riddle-header">
        <text class="card-title">Riddle #{{ currentRiddle.id }}</text>
        <view class="difficulty-badge" :class="currentRiddle.difficulty">
          <text>{{ currentRiddle.difficulty }}</text>
        </view>
      </view>
      <view class="riddle-content">
        <text class="riddle-text">{{ currentRiddle.question }}</text>
      </view>
      <view class="hint-section">
        <text class="hint-label">Hint:</text>
        <text class="hint-text">{{ currentRiddle.hint }}</text>
      </view>
      <view class="reward-info">
        <text>Reward: {{ currentRiddle.reward }} GAS</text>
      </view>
    </view>
    <view class="card">
      <text class="card-title">Your Answer</text>
      <uni-easyinput v-model="userAnswer" placeholder="Enter your answer..." :disabled="isSubmitting" />
      <view class="submit-btn" @click="submitAnswer">
        <text>{{ isSubmitting ? "Checking..." : "Submit Answer" }}</text>
      </view>
    </view>
    <view v-if="showResult" class="result-card" :class="lastResult.correct ? 'correct' : 'wrong'">
      <text class="result-icon">{{ lastResult.correct ? "✅" : "❌" }}</text>
      <text class="result-text">{{ lastResult.message }}</text>
      <view v-if="!lastResult.correct" class="correct-answer">
        <text>Correct answer: {{ lastResult.correctAnswer }}</text>
      </view>
      <view class="next-btn" @click="nextRiddle">
        <text>Next Riddle</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments } from "@neo/uniapp-sdk";

const APP_ID = "miniapp-crypto-riddle";
const { payGAS } = usePayments(APP_ID);

const solvedCount = ref(0);
const totalRewards = ref(0);
const currentStreak = ref(0);
const userAnswer = ref("");
const isSubmitting = ref(false);
const showResult = ref(false);
const status = ref<{ msg: string; type: string } | null>(null);

const riddles = [
  {
    id: 1,
    question: "I am the first, yet I am everywhere. Without me, nothing can be verified. What am I?",
    answer: "hash",
    hint: "Think about blockchain fundamentals",
    difficulty: "easy",
    reward: 1.0,
  },
  {
    id: 2,
    question: "I have keys but no locks. I have space but no room. You can enter, but can't go outside. What am I?",
    answer: "keyboard",
    hint: "Used for typing crypto addresses",
    difficulty: "easy",
    reward: 1.0,
  },
  {
    id: 3,
    question: "What has 256 bits, starts with many zeros, and miners race to find me?",
    answer: "nonce",
    hint: "Proof of Work concept",
    difficulty: "medium",
    reward: 2.0,
  },
];

const currentRiddleIndex = ref(0);
const currentRiddle = ref(riddles[0]);

const lastResult = ref({
  correct: false,
  message: "",
  correctAnswer: "",
});

const submitAnswer = async () => {
  if (isSubmitting.value || !userAnswer.value.trim()) {
    status.value = { msg: "Please enter an answer", type: "error" };
    return;
  }

  isSubmitting.value = true;
  const answer = userAnswer.value.trim().toLowerCase();
  const correct = answer === currentRiddle.value.answer.toLowerCase();

  await new Promise((resolve) => setTimeout(resolve, 800));

  if (correct) {
    solvedCount.value++;
    totalRewards.value = parseFloat((totalRewards.value + currentRiddle.value.reward).toFixed(2));
    currentStreak.value++;
    lastResult.value = {
      correct: true,
      message: `Correct! You earned ${currentRiddle.value.reward} GAS`,
      correctAnswer: "",
    };
    status.value = { msg: "Brilliant! Keep going!", type: "success" };
  } else {
    currentStreak.value = 0;
    lastResult.value = {
      correct: false,
      message: "Not quite right. Try again!",
      correctAnswer: currentRiddle.value.answer,
    };
    status.value = { msg: "Wrong answer. Study the hint!", type: "error" };
  }

  showResult.value = true;
  isSubmitting.value = false;
};

const nextRiddle = () => {
  currentRiddleIndex.value = (currentRiddleIndex.value + 1) % riddles.length;
  currentRiddle.value = riddles[currentRiddleIndex.value];
  userAnswer.value = "";
  showResult.value = false;
  status.value = null;
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
  &.error {
    background: rgba($color-error, 0.15);
    color: $color-error;
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
  margin-bottom: 12px;
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
.riddle-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.difficulty-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 0.85em;
  font-weight: bold;
  &.easy {
    background: rgba($color-success, 0.2);
    color: $color-success;
  }
  &.medium {
    background: rgba(#f59e0b, 0.2);
    color: #f59e0b;
  }
  &.hard {
    background: rgba($color-error, 0.2);
    color: $color-error;
  }
}
.riddle-content {
  background: rgba($color-gaming, 0.05);
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 16px;
}
.riddle-text {
  font-size: 1.1em;
  line-height: 1.6;
  color: #fff;
}
.hint-section {
  background: rgba(#f59e0b, 0.1);
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 12px;
}
.hint-label {
  color: #f59e0b;
  font-weight: bold;
  margin-right: 8px;
}
.hint-text {
  color: $color-text-secondary;
}
.reward-info {
  text-align: center;
  color: $color-gaming;
  font-weight: bold;
  padding: 8px;
}
.submit-btn {
  background: linear-gradient(135deg, $color-gaming 0%, darken($color-gaming, 10%) 100%);
  color: #fff;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  font-weight: bold;
  margin-top: 16px;
}
.result-card {
  border-radius: 16px;
  padding: 24px;
  text-align: center;
  &.correct {
    background: rgba($color-success, 0.15);
    border: 2px solid $color-success;
  }
  &.wrong {
    background: rgba($color-error, 0.15);
    border: 2px solid $color-error;
  }
}
.result-icon {
  font-size: 3em;
  display: block;
  margin-bottom: 12px;
}
.result-text {
  font-size: 1.2em;
  font-weight: bold;
  display: block;
  margin-bottom: 12px;
}
.correct-answer {
  background: rgba(#000, 0.3);
  padding: 12px;
  border-radius: 8px;
  margin: 12px 0;
  color: $color-text-secondary;
}
.next-btn {
  background: $color-gaming;
  color: #fff;
  padding: 12px 24px;
  border-radius: 8px;
  display: inline-block;
  margin-top: 12px;
  font-weight: bold;
}
</style>
