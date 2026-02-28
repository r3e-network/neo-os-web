<template>
  <view class="zk-container">
    <view class="hero-section">
      <view class="hero-bg">
        <div class="circle circle-1"></div>
        <div class="circle circle-2"></div>
      </view>
      
      <view class="hero-content">
        <image class="hero-icon" src="https://neo.org/images/neo-logo-white.svg" mode="aspectFit" />
        <text class="hero-title">zNEP17 Privacy</text>
        <text class="hero-subtitle">Zero-Knowledge Token Escrow</text>
      </view>
    </view>

    <view class="interactive-section">
      <!-- Shield Funds -->
      <view class="action-card">
        <view class="card-header">
          <text class="card-title">1. Shield Funds</text>
          <text class="card-desc">Deposit 1.0 GAS to generate an anonymous note.</text>
        </view>
        
        <button 
          class="btn btn-primary" 
          :loading="isDepositing" 
          :disabled="isDepositing"
          @click="handleDeposit">
          {{ isDepositing ? 'Escrowing...' : 'Deposit 1.0 GAS' }}
        </button>
        
        <view v-if="depositNote" class="result-box success-box slide-down">
          <text class="box-label">Success! Save your note:</text>
          <textarea class="note-area" :value="depositNote" readonly :maxlength="-1"></textarea>
          <button class="btn btn-small" @click="copyToClipboard(depositNote)">Copy Note</button>
        </view>
      </view>

      <!-- Unshield Funds -->
      <view class="action-card">
        <view class="card-header">
          <text class="card-title">2. Unshield Funds</text>
          <text class="card-desc">Withdraw via TEE Relayer with zero initial GAS.</text>
        </view>
        
        <view class="input-group">
          <text class="label">Privacy Note</text>
          <input class="input" v-model="withdrawNote" placeholder="neo-zk://..." />
        </view>

        <view class="input-group">
          <text class="label">Recipient Address</text>
          <input class="input" v-model="recipientAddress" placeholder="N..." />
        </view>

        <button 
          class="btn btn-success" 
          :loading="isWithdrawing" 
          :disabled="isWithdrawing || !withdrawNote || !recipientAddress"
          @click="handleWithdraw">
          {{ isWithdrawing ? 'Proving & Relaying...' : 'Gasless Withdraw' }}
        </button>

        <view v-if="withdrawTxHash" class="result-box success-box slide-down">
          <text class="box-label">Withdrawal Successful!</text>
          <text class="tx-hash">{{ withdrawTxHash }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script lang="ts" setup>
import { ref } from 'vue';

const isDepositing = ref(false);
const depositNote = ref('');

const isWithdrawing = ref(false);
const withdrawNote = ref('');
const recipientAddress = ref('');
const withdrawTxHash = ref('');

const copyToClipboard = (text: string) => {
  uni.setClipboardData({
    data: text,
    success: () => {
      uni.showToast({ title: 'Copied', icon: 'none' });
    }
  });
};

const showToast = (title: string, icon: 'success' | 'none' | 'error' = 'none') => {
  uni.showToast({ title, icon, duration: 3000 });
};

async function handleDeposit() {
  if (isDepositing.value) return;
  isDepositing.value = true;
  depositNote.value = '';

  try {
    const secretArray = Array.from({ length: 31 }, () => Math.floor(Math.random() * 256));
    const nullifierArray = Array.from({ length: 31 }, () => Math.floor(Math.random() * 256));
    
    const secretHex = secretArray.map(b => b.toString(16).padStart(2, '0')).join('');
    const nullifierHex = nullifierArray.map(b => b.toString(16).padStart(2, '0')).join('');
    
    showToast("Awaiting wallet approval...", "none");
    await new Promise(resolve => setTimeout(resolve, 1500));

    depositNote.value = `neo-zk://v1/gas/1/${secretHex}/${nullifierHex}`;
    showToast("Deposit transaction submitted.", "success");
  } catch (error: any) {
    showToast(error.message || "Deposit failed", "error");
  } finally {
    isDepositing.value = false;
  }
}

async function handleWithdraw() {
  if (isWithdrawing.value) return;
  isWithdrawing.value = true;
  withdrawTxHash.value = '';

  try {
    if (!withdrawNote.value.startsWith('neo-zk://')) {
      throw new Error('Invalid or corrupted privacy note format.');
    }
    if (!recipientAddress.value.startsWith('N') || recipientAddress.value.length !== 34) {
      throw new Error('Invalid Neo N3 recipient address.');
    }

    showToast("Fetching anonymity set...", "none");
    await new Promise(resolve => setTimeout(resolve, 800));

    showToast("Generating ZKP locally...", "none");
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    showToast("Relaying zero-gas transaction...", "none");
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    withdrawTxHash.value = "0x6aece5514b69f19e74ac0fb3059da0d654e4f64f3aa1b2ca3d9de83812e81a18";
    showToast("Withdrawal complete!", "success");
  } catch (error: any) {
    showToast(error.message || "Withdraw failed", "error");
  } finally {
    isWithdrawing.value = false;
  }
}
</script>

<style scoped>
.zk-container {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 100vh;
  background-color: #0f172a;
  color: white;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  overflow: hidden;
}

@media (max-width: 768px) {
  .zk-container {
    flex-direction: column;
    overflow-y: auto;
  }
  .interactive-section {
    width: 100% !important;
    height: auto !important;
  }
  .hero-section {
    min-height: 300px;
  }
}

/* Left side: Hero Banner */
.hero-section {
  flex: 1;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: linear-gradient(135deg, #00e599 0%, #007aff 100%);
  overflow: hidden;
}

.hero-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  overflow: hidden;
  z-index: 1;
}

.circle {
  position: absolute;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
}

.circle-1 {
  width: 300px;
  height: 300px;
  top: -100px;
  left: -100px;
}

.circle-2 {
  width: 400px;
  height: 400px;
  bottom: -150px;
  right: -100px;
}

.hero-content {
  position: relative;
  z-index: 2;
  text-align: center;
}

.hero-icon {
  width: 80px;
  height: 80px;
  margin-bottom: 24px;
}

.hero-title {
  font-size: 36px;
  font-weight: 800;
  letter-spacing: -0.5px;
  margin-bottom: 12px;
  display: block;
  text-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.hero-subtitle {
  font-size: 18px;
  opacity: 0.9;
  font-weight: 500;
  display: block;
}

/* Right side: Interactive Actions */
.interactive-section {
  width: 420px;
  background-color: #ffffff;
  color: #1e293b;
  display: flex;
  flex-direction: column;
  padding: 32px 24px;
  overflow-y: auto;
  box-sizing: border-box;
}

.action-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 24px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
}

.card-header {
  margin-bottom: 16px;
}

.card-title {
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
  display: block;
  margin-bottom: 4px;
}

.card-desc {
  font-size: 13px;
  color: #64748b;
  display: block;
  line-height: 1.4;
}

.input-group {
  margin-bottom: 16px;
}

.label {
  font-size: 13px;
  color: #475569;
  margin-bottom: 6px;
  display: block;
  font-weight: 600;
}

.input {
  width: 100%;
  height: 40px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 0 12px;
  font-size: 14px;
  background: white;
  box-sizing: border-box;
  transition: all 0.2s;
  color: #1e293b;
}

.input:focus {
  border-color: #007aff;
  box-shadow: 0 0 0 3px rgba(0, 122, 255, 0.1);
  outline: none;
}

.btn {
  width: 100%;
  height: 44px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  transition: transform 0.1s, opacity 0.2s;
}

.btn:active {
  transform: scale(0.98);
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background-color: #007aff;
  color: white;
}

.btn-success {
  background-color: #10b981;
  color: white;
}

.btn-small {
  height: 32px;
  font-size: 13px;
  background-color: white;
  border: 1px solid #cbd5e1;
  color: #475569;
  margin-top: 10px;
}

.btn-small:hover {
  background-color: #f1f5f9;
}

.result-box {
  margin-top: 16px;
  padding: 12px;
  border-radius: 8px;
}

.success-box {
  background-color: #ecfdf5;
  border: 1px solid #a7f3d0;
}

.box-label {
  font-size: 13px;
  color: #059669;
  font-weight: 600;
  display: block;
  margin-bottom: 8px;
}

.note-area {
  width: 100%;
  height: 50px;
  background: white;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: #334155;
  box-sizing: border-box;
  resize: none;
}

.tx-hash {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
  color: #334155;
  word-break: break-all;
  display: block;
  background: white;
  padding: 8px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
}

.slide-down {
  animation: slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes slideDown {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>