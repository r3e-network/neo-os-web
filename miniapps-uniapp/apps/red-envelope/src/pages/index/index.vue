<template>
  <view class="app-container">
    <view class="background-decorations">
      <view class="decor circle-1"></view>
      <view class="decor circle-2"></view>
    </view>
    
    <view class="header">
      <view class="header-icon-wrap">
        <text class="header-icon">🧧</text>
      </view>
      <text class="title">Crypto Envelopes</text>
      <text class="subtitle">Share the luck on Neo N3</text>
    </view>
    
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>
    
    <view class="card interactive-card">
      <text class="card-title">Create Envelope</text>
      <view class="input-group">
        <uni-easyinput v-model="amount" type="number" placeholder="Total GAS" :styles="inputStyles" class="premium-input" />
      </view>
      <view class="input-group">
        <uni-easyinput v-model="count" type="number" placeholder="Number of packets" :styles="inputStyles" class="premium-input" />
      </view>
      <view class="action-btn neo-btn" @click="create" :class="{ 'is-loading': isLoading }">
        <text class="btn-text">{{ isLoading ? "Creating..." : "Send Red Envelope" }}</text>
      </view>
    </view>
    
    <view class="card list-card">
      <text class="card-title">Available Envelopes</text>
      <view class="envelope-list">
        <view v-for="env in envelopes" :key="env.id" class="envelope-item" @click="claim(env)">
          <view class="envelope-icon-box">
             <text class="envelope-icon">🧧</text>
          </view>
          <view class="envelope-info">
            <text class="envelope-from">From {{ env.from }}</text>
            <view class="envelope-stats">
              <text class="envelope-amount">{{ env.amount }} GAS</text>
              <view class="progress-pill">
                <view class="progress-fill" :style="{ width: `${(env.remaining / env.total) * 100}%` }"></view>
              </view>
              <text class="envelope-remaining">{{ env.remaining }}/{{ env.total }} left</text>
            </view>
          </view>
          <view class="claim-action">
            <text>Claim</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments } from "@neo/uniapp-sdk";

const APP_ID = "miniapp-redenvelope";
const { payGAS, isLoading } = usePayments(APP_ID);

const amount = ref("");
const count = ref("");
const status = ref<{ msg: string; type: string } | null>(null);
const envelopes = ref([
  { id: "1", from: "NX8...abc", remaining: 3, total: 5, amount: 10 },
  { id: "2", from: "NY2...def", remaining: 1, total: 3, amount: 5 },
]);

const inputStyles = {
  color: '#ffffff',
  disableColor: 'transparent',
  borderColor: 'rgba(255, 255, 255, 0.1)',
};

const create = async () => {
  if (isLoading.value) return;
  try {
    await payGAS(amount.value, `redenvelope:${count.value}`);
    status.value = { msg: "Envelope sent successfully!", type: "success" };
    amount.value = "";
    count.value = "";
    setTimeout(() => { status.value = null; }, 3000);
  } catch (e: any) {
    status.value = { msg: e.message || "Error creating envelope", type: "error" };
    setTimeout(() => { status.value = null; }, 3000);
  }
};

const claim = async (env: any) => {
  if (env.remaining <= 0) return;
  status.value = { msg: `Successfully claimed from ${env.from}!`, type: "success" };
  env.remaining--;
  setTimeout(() => { status.value = null; }, 3000);
};
</script>

<style lang="scss">
@import "@/shared/styles/theme.scss";

* {
  box-sizing: border-box;
}

.app-container {
  min-height: 100vh;
  background-color: #0d0e15;
  color: #ffffff;
  padding: 30px 20px;
  position: relative;
  overflow: hidden;
  font-family: system-ui, -apple-system, sans-serif;
}

.background-decorations {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 0;
  pointer-events: none;
  overflow: hidden;
  
  .decor {
    position: absolute;
    border-radius: 50%;
    filter: blur(80px);
  }
  
  .circle-1 {
    top: -10%;
    left: -10%;
    width: 300px;
    height: 300px;
    background: rgba(239, 68, 68, 0.2);
  }
  
  .circle-2 {
    bottom: -10%;
    right: -10%;
    width: 350px;
    height: 350px;
    background: rgba(245, 158, 11, 0.15);
  }
}

.header {
  text-align: center;
  margin-bottom: 30px;
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.header-icon-wrap {
  width: 80px;
  height: 80px;
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(245, 158, 11, 0.2) 100%);
  border-radius: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 20px;
  border: 1px solid rgba(239, 68, 68, 0.3);
  box-shadow: 0 10px 30px rgba(239, 68, 68, 0.2);
  transform: rotate(-10deg);
}

.header-icon {
  font-size: 3em;
  transform: rotate(10deg);
}

.title {
  font-size: 2em;
  font-weight: 900;
  background: linear-gradient(135deg, #fca5a5 0%, #ef4444 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: -0.5px;
}

.subtitle {
  color: #94a3b8;
  font-size: 1em;
  margin-top: 8px;
  font-weight: 500;
}

.status-msg {
  text-align: center;
  padding: 14px;
  border-radius: 12px;
  margin-bottom: 20px;
  font-weight: 600;
  font-size: 0.9em;
  position: relative;
  z-index: 10;
  backdrop-filter: blur(10px);
  
  &.success {
    background: rgba(16, 185, 129, 0.1);
    color: #34d399;
    border: 1px solid rgba(16, 185, 129, 0.2);
  }
  &.error {
    background: rgba(239, 68, 68, 0.1);
    color: #f87171;
    border: 1px solid rgba(239, 68, 68, 0.2);
  }
}

.card {
  background: rgba(255, 255, 255, 0.03);
  backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 24px;
  padding: 24px;
  margin-bottom: 20px;
  position: relative;
  z-index: 10;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
}

.interactive-card {
  transition: transform 0.3s ease;
}

.card-title {
  color: #f8fafc;
  font-size: 1.2em;
  font-weight: 800;
  display: block;
  margin-bottom: 20px;
}

.input-group {
  margin-bottom: 16px;
  
  :deep(.uni-easyinput__content) {
    background-color: rgba(255, 255, 255, 0.05) !important;
    border: 1px solid rgba(255, 255, 255, 0.1) !important;
    border-radius: 16px;
    padding: 6px;
    transition: all 0.3s ease;
    
    &:focus-within {
       background-color: rgba(255, 255, 255, 0.08) !important;
       border-color: rgba(239, 68, 68, 0.5) !important;
       box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2) !important;
    }
  }
  
  :deep(.uni-easyinput__content-input) {
     color: white !important;
     font-size: 16px;
     font-weight: 600;
  }
}

.action-btn {
  background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%);
  padding: 18px;
  border-radius: 16px;
  text-align: center;
  margin-top: 24px;
  box-shadow: 0 10px 20px rgba(239, 68, 68, 0.3);
  transition: all 0.2s ease;
  cursor: pointer;
  
  .btn-text {
    color: #ffffff;
    font-weight: 800;
    font-size: 1.1em;
    letter-spacing: 0.5px;
  }
  
  &:active {
    transform: scale(0.98);
    box-shadow: 0 5px 10px rgba(239, 68, 68, 0.2);
  }
  
  &.is-loading {
    opacity: 0.7;
    pointer-events: none;
  }
}

.envelope-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.envelope-item {
  display: flex;
  align-items: center;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 16px;
  transition: all 0.2s ease;
  
  &:active {
    transform: scale(0.98);
    background: rgba(255, 255, 255, 0.08);
  }
}

.envelope-icon-box {
  width: 48px;
  height: 48px;
  background: rgba(239, 68, 68, 0.15);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 16px;
}

.envelope-icon {
  font-size: 1.6em;
}

.envelope-info {
  flex: 1;
}

.envelope-from {
  display: block;
  font-weight: 700;
  font-size: 1.05em;
  color: #f8fafc;
  margin-bottom: 6px;
}

.envelope-stats {
  display: flex;
  align-items: center;
  gap: 10px;
}

.envelope-amount {
  font-size: 0.85em;
  color: #ef4444;
  font-weight: 700;
}

.progress-pill {
  flex: 1;
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #f59e0b, #ef4444);
  border-radius: 3px;
}

.envelope-remaining {
  color: #94a3b8;
  font-size: 0.75em;
  font-weight: 600;
}

.claim-action {
  margin-left: 12px;
  padding: 8px 14px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 10px;
  
  text {
    color: #ef4444;
    font-size: 0.85em;
    font-weight: 700;
  }
}
</style>
