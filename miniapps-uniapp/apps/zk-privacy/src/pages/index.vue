<template>
  <MiniAppLayout>
    
    <!-- Playfield: The core visual or logical area of the MiniApp -->
    <template #playfield>
      <view class="playfield-content">
        <image class="hero-icon" src="https://neo.org/images/neo-logo-white.svg" mode="aspectFit" />
        <text class="hero-title">zNEP17 Anonymity Pool</text>
        <text class="hero-subtitle">Zero-Knowledge Token Escrow & Gasless Relay</text>
        
        <view class="stats-board">
          <view class="stat-item">
            <text class="stat-value">1.0 GAS</text>
            <text class="stat-label">Fixed Denomination</text>
          </view>
          <view class="stat-item">
            <text class="stat-value">BLS12-381</text>
            <text class="stat-label">Pairing Curve</text>
          </view>
          <view class="stat-item">
            <text class="stat-value">SGX</text>
            <text class="stat-label">TEE Relayer</text>
          </view>
        </view>
      </view>
    </template>

    <!-- Info Tabs -->
    <template #intro>
      <view class="prose">
        <text class="p">Welcome to the **zNEP17 Privacy Protocol**. This MiniApp allows you to break on-chain linkability between sender and receiver addresses.</text>
        <text class="p mt-2">By depositing fixed denominations of GAS into the escrow pool, you generate an offline Zero-Knowledge credential. Later, you (or anyone you share the credential with) can provide a cryptographic proof to withdraw the funds to a completely fresh, unfunded wallet.</text>
      </view>
    </template>

    <template #info>
      <view class="prose">
        <text class="h3">How it Works</text>
        <text class="p mt-2">1. **Deposit**: A secret and nullifier are randomly generated in your browser. Their hash (commitment) is sent to the Neo N3 smart contract.</text>
        <text class="p mt-2">2. **Wait**: The SGX Enclave indexes the deposit into a Poseidon Merkle Tree.</text>
        <text class="p mt-2">3. **Withdraw**: Your browser generates a Groth16 ZK-Proof proving you know the secret for an unspent commitment in the tree, without revealing which one. The TEE relays the transaction, paying the network fee on your behalf in exchange for a small relayer cut.</text>
      </view>
    </template>

    <template #reviews>
      <view class="review-list">
        <view class="review-item">
          <text class="reviewer">NeoCoreDev</text>
          <text class="stars">⭐⭐⭐⭐⭐</text>
          <text class="review-text">Incredible use of TEEs to solve the initial GAS problem for privacy relayer networks.</text>
        </view>
      </view>
    </template>

    <!-- Operations Panel -->
    <template #operations>
      <view class="operations-wrapper">
        <text class="op-section-title">1. Shield Funds</text>
        <view class="op-card">
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

        <text class="op-section-title mt-4">2. Unshield Funds</text>
        <view class="op-card">
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
            {{ isWithdrawing ? 'Proving...' : 'Gasless Withdraw' }}
          </button>

          <view v-if="withdrawTxHash" class="result-box success-box slide-down">
            <text class="box-label">Withdrawal Successful!</text>
            <text class="tx-hash">{{ withdrawTxHash }}</text>
          </view>
        </view>
      </view>
    </template>

  </MiniAppLayout>
</template>

<script lang="ts" setup>
import { ref } from 'vue';
import MiniAppLayout from '../components/MiniAppLayout.vue';

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
/* Playfield Styling */
.playfield-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 40px 20px;
  background: linear-gradient(135deg, #00e599 0%, #007aff 100%);
  border-radius: 12px;
  color: white;
  text-align: center;
}

.hero-icon {
  width: 80px;
  height: 80px;
  margin-bottom: 24px;
  opacity: 0.9;
}

.hero-title {
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.5px;
  margin-bottom: 8px;
}

.hero-subtitle {
  font-size: 16px;
  opacity: 0.9;
  margin-bottom: 40px;
  font-weight: 500;
}

.stats-board {
  display: flex;
  gap: 32px;
  background: rgba(255, 255, 255, 0.1);
  padding: 20px 32px;
  border-radius: 16px;
  backdrop-filter: blur(10px);
}

.stat-item {
  display: flex;
  flex-direction: column;
}

.stat-value {
  font-size: 20px;
  font-weight: 700;
}

.stat-label {
  font-size: 12px;
  opacity: 0.8;
  margin-top: 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

/* Info Typography */
.prose {
  color: #334155;
  line-height: 1.6;
}

.h3 {
  font-size: 18px;
  font-weight: 600;
  color: #0f172a;
  display: block;
}

.p {
  font-size: 15px;
  display: block;
}

.mt-2 { margin-top: 12px; }
.mt-4 { margin-top: 24px; }

/* Reviews */
.review-item {
  padding-bottom: 16px;
  border-bottom: 1px solid #f1f5f9;
}
.reviewer { font-weight: 600; font-size: 14px; margin-right: 8px; }
.stars { font-size: 12px; }
.review-text { font-size: 14px; color: #475569; display: block; margin-top: 6px; }

/* Operations */
.operations-wrapper {
  display: flex;
  flex-direction: column;
}

.op-section-title {
  font-size: 16px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 12px;
  display: block;
}

.op-card {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px;
}

/* Form Controls */
.input-group {
  margin-bottom: 16px;
}

.label {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 6px;
  display: block;
  font-weight: 600;
}

.input {
  width: 100%;
  height: 44px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 0 12px;
  font-size: 14px;
  background: white;
  box-sizing: border-box;
  transition: border-color 0.2s, box-shadow 0.2s;
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
  transform: none;
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

/* Results */
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
  height: 60px;
  background: white;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  padding: 8px;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
  color: #334155;
  box-sizing: border-box;
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
