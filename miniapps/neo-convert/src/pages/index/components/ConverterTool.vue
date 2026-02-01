<template>
  <view class="converter-container">
    <NeoCard>
      <view class="header">
        <text class="title">{{ t('convTitle') }}</text>
      </view>
      
      <view class="input-section">
        <text class="label">{{ t('inputLabel') }}</text>
        <textarea 
          class="key-input" 
          v-model="inputKey" 
          :placeholder="t('inputPlaceholder')"
          @input="detectAndConvert" 
          maxlength="-1"
        />
        <ScrollReveal animation="fade-down" :duration="400" v-if="statusMsg">
          <text class="status" :class="statusType">{{ t(statusMsg as any) || statusMsg }}</text>
        </ScrollReveal>
      </view>

      <view class="results" v-if="result.address">
        <ScrollReveal animation="slide-left" :delay="100">
          <view class="result-group">
            <text class="label">{{ t('address') }}</text>
            <view class="value-row">
              <text class="value">{{ result.address }}</text>
              <view class="copy-btn" @click="copy(result.address)" role="button" :aria-label="t('copyAddress')">
                <text class="icon" aria-hidden="true">📋</text>
              </view>
            </view>
          </view>
        </ScrollReveal>

        <ScrollReveal animation="slide-left" :delay="200" v-if="result.publicKey">
          <view class="result-group">
            <text class="label">{{ t('pubKey') }}</text>
            <view class="value-row">
              <text class="value truncate">{{ result.publicKey }}</text>
              <view class="copy-btn" @click="copy(result.publicKey)" role="button" :aria-label="t('copyPublicKey')">
                <text class="icon" aria-hidden="true">📋</text>
              </view>
            </view>
          </view>
        </ScrollReveal>

        <ScrollReveal animation="slide-left" :delay="300" v-if="result.wif">
           <view class="result-group warning-group">
             <view class="label-row">
               <text class="label">{{ t('wifLabel') }}</text>
               <text class="badge-private">{{ t('privateBadge') }}</text>
             </view>
             <view class="value-row">
               <text class="value blur" :class="{ revealed: showSecrets }">{{ result.wif }}</text>
              <view class="action-btn" @click="showSecrets = !showSecrets" role="button" :aria-label="showSecrets ? t('hideSecrets') : t('showSecrets')">
                  <text class="icon" aria-hidden="true">{{ showSecrets ? '🙈' : '👁️' }}</text>
                </view>
                <view class="copy-btn" @click="copy(result.wif)" role="button" :aria-label="t('copyWif')">
                  <text class="icon" aria-hidden="true">📋</text>
                </view>
             </view>
           </view>
        </ScrollReveal>
        
        <ScrollReveal animation="slide-left" :delay="400" v-if="result.privateKey">
           <view class="result-group warning-group">
             <view class="label-row">
               <text class="label">{{ t('privKeyLabel') }}</text>
               <text class="badge-private">{{ t('privateBadge') }}</text>
             </view>
             <view class="value-row">
               <text class="value blur" :class="{ revealed: showSecrets }">{{ result.privateKey }}</text>
              <view class="action-btn" @click="showSecrets = !showSecrets" role="button" :aria-label="showSecrets ? t('hideSecrets') : t('showSecrets')">
                  <text class="icon" aria-hidden="true">{{ showSecrets ? '🙈' : '👁️' }}</text>
                </view>
                <view class="copy-btn" @click="copy(result.privateKey)" role="button" :aria-label="t('copyPrivateKey')">
                  <text class="icon" aria-hidden="true">📋</text>
                </view>
             </view>
           </view>
        </ScrollReveal>
      </view>

      <ScrollReveal animation="fade-up" :delay="200" v-if="result.opcodes && result.opcodes.length > 0">
         <view class="result-group">
           <text class="label">{{ t('disassembledOpcodes') }}</text>
           <view class="opcodes-container">
             <text v-for="(op, idx) in result.opcodes" :key="idx" class="opcode-tag">{{ op }}</text>
           </view>
         </view>
      </ScrollReveal>
    </NeoCard>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { NeoCard } from "@shared/components";
import ScrollReveal from "@shared/components/ScrollReveal.vue"; // Added Import
import { 
  validateWif, 
  validatePrivateKey, 
  validatePublicKey, 
  validateHexScript,
  convertPrivateKeyToWif,
  convertPublicKeyToAddress,
  disassembleScript,
  getPublicKey,
  getPrivateKeyFromWIF
} from "@/services/neo";
import { useI18n } from "@/composables/useI18n";

const { t } = useI18n();
const inputKey = ref("");
const statusMsg = ref("");
const statusType = ref("");
const showSecrets = ref(false);

const result = ref({
  address: "",
  publicKey: "",
  wif: "",
  privateKey: "",
  opcodes: [] as string[]
});

const copy = (text: string) => {
  // @ts-ignore
  uni.setClipboardData({
    data: text,
    success: () => uni.showToast({ title: t("copied"), icon: "none" })
  });
};

const clearResult = () => {
  result.value = { address: "", publicKey: "", wif: "", privateKey: "", opcodes: [] };
  statusMsg.value = "";
  statusType.value = "";
  showSecrets.value = false;
};

const detectAndConvert = () => {
  const val = inputKey.value.trim();
  if (!val) {
    clearResult();
    return;
  }

  try {
    // 1. Try WIF
    if (validateWif(val)) {
      statusMsg.value = "detectedWif";
      statusType.value = "success";
      const priv = getPrivateKeyFromWIF(val)!;
      const pub = getPublicKey(priv);
      const addr = convertPublicKeyToAddress(pub);
      result.value = {
        address: addr,
        publicKey: pub,
        wif: val,
        privateKey: priv,
        opcodes: []
      };
      return;
    }

    // 2. Try Public Key (66 hex)
    if (validatePublicKey(val)) {
      statusMsg.value = "detectedPubKey";
      statusType.value = "success";
      const address = convertPublicKeyToAddress(val);
      result.value = {
        address: address,
        publicKey: val,
        wif: "",
        privateKey: "",
        opcodes: []
      };
      return;
    }

    // 3. Try Private Key (64 hex)
    if (validatePrivateKey(val)) {
      statusMsg.value = "detectedPrivKey";
      statusType.value = "success";
      const pub = getPublicKey(val);
      const addr = convertPublicKeyToAddress(pub);
      const wif = convertPrivateKeyToWif(val);
      result.value = {
        address: addr,
        publicKey: pub,
        wif: wif,
        privateKey: val,
        opcodes: []
      };
      return;
    }

    // 4. Try Hex Script
    if (validateHexScript(val)) {
      statusMsg.value = "detectedScript";
      statusType.value = "success";
      const ops = disassembleScript(val);
      result.value = {
        address: "",
        publicKey: "",
        wif: "",
        privateKey: "",
        opcodes: ops
      };
      return;
    }

    statusMsg.value = "unknownFormat";
    statusType.value = "error";
    result.value = { address: "", publicKey: "", wif: "", privateKey: "", opcodes: [] };

  } catch (e) {
    statusMsg.value = "invalidFormat";
    statusType.value = "error";
  }
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.converter-container {
  padding: 16px;
}

.title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 24px;
  display: block;
}

.input-section {
  margin-bottom: 24px;
}

.label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  color: var(--convert-label);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
}

.label-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.badge-private {
  font-size: 9px;
  background: var(--convert-danger-chip-bg);
  color: var(--convert-danger-text);
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.key-input {
  width: 100%;
  height: 90px;
  background: var(--convert-input-bg);
  border: 1px solid var(--convert-input-border);
  border-radius: 12px;
  padding: 14px;
  color: var(--text-primary, #fff);
  font-family: 'Space Mono', monospace; // Fallback
  font-size: 13px;
  line-height: 1.5;
  box-sizing: border-box;
  transition: all 0.2s ease;
  
  &:focus {
    background: var(--convert-panel-hover);
    border-color: var(--convert-input-focus-border);
    box-shadow: 0 0 0 2px var(--convert-input-focus-shadow);
  }
}

.status {
  display: block;
  font-size: 12px;
  margin-top: 10px;
  font-weight: 500;
  
  &.success { color: var(--convert-success); }
  &.error { color: var(--convert-error); }
}

.result-group {
  margin-bottom: 20px;
  
  &.warning-group {
    background: var(--convert-danger-bg);
    padding: 12px;
    border-radius: 12px;
    border: 1px dashed var(--convert-danger-border);
    
    .value-row {
      background: var(--convert-danger-surface);
      border: 1px solid var(--convert-danger-border);
    }
  }
}

.value-row {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--convert-panel-bg);
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--convert-panel-border);
  transition: all 0.2s;
  
  &:hover {
    background: var(--convert-panel-hover);
    border-color: var(--convert-panel-hover-border);
  }
}

.value {
  flex: 1;
  font-family: monospace;
  font-size: 13px;
  word-break: break-all;
  color: var(--text-primary, #fff);
  line-height: 1.4;
  
  &.truncate {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  
  &.blur {
    filter: blur(5px);
    transition: filter 0.3s;
    user-select: none;
    &.revealed { filter: none; user-select: text; }
  }
}

.opcodes-container {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  background: var(--convert-panel-strong);
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--convert-panel-border);
  min-height: 48px;
}

.opcode-tag {
  background: var(--convert-opcode-bg);
  color: var(--convert-opcode-text);
  padding: 4px 8px;
  border-radius: 6px;
  font-family: monospace;
  font-size: 11px;
  border: 1px solid var(--convert-opcode-border);
}

.copy-btn, .action-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  cursor: pointer;
  background: var(--convert-copy-bg);
  transition: all 0.2s;
  
  &:active {
    transform: scale(0.95);
    background: var(--convert-copy-bg-active);
  }
  
  .icon {
    font-size: 14px;
    line-height: 1;
  }
}
</style>
