<template>
  <view class="give-karma-section">
    <view class="content-card">
      <text class="card-title">{{ t("giveKarma") }}</text>
      <text class="card-subtitle">{{ t("appreciateSomeone") }}</text>
      
      <view class="form-group">
        <label>{{ t("recipientAddress") }}</label>
        <input 
          v-model="localAddress" 
          class="form-input" 
          :placeholder="t('enterAddress')"
        />
      </view>
      
      <view class="form-row">
        <view class="form-group half">
          <label>{{ t("amount") }}</label>
          <input
            v-model.number="localAmount"
            type="number"
            class="form-input"
            :placeholder="t('amount')"
            min="1"
            max="100"
          />
        </view>
        <view class="form-group half">
          <label>&nbsp;</label>
          <view class="amount-presets">
            <button 
              v-for="amt in [10, 25, 50, 100]" 
              :key="amt"
              class="preset-btn"
              :class="{ active: localAmount === amt }"
              @click="localAmount = amt"
            >
              {{ amt }}
            </button>
          </view>
        </view>
      </view>
      
      <view class="form-group">
        <label>{{ t("reason") }} ({{ t("optional") }})</label>
        <textarea 
          v-model="localReason" 
          class="form-textarea" 
          :placeholder="t('enterReason')"
          maxlength="200"
        />
      </view>
      
      <button 
        class="action-button primary"
        :disabled="isGiving || !isValid"
        @click="emitGive"
      >
        <text v-if="isGiving">{{ t("sending") }}...</text>
        <text v-else>{{ t("giveKarmaBtn") }} (0.1 GAS)</text>
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useI18n } from "@/composables/useI18n";

const props = defineProps<{
  isGiving: boolean;
}>();

const emit = defineEmits<{
  (e: "give", data: { address: string; amount: number; reason: string }): void;
}>();

const { t } = useI18n();
const localAddress = ref("");
const localAmount = ref(10);
const localReason = ref("");

const isValid = computed(() => {
  return localAddress.value.trim().length > 0 && localAmount.value >= 1 && localAmount.value <= 100;
});

const emitGive = () => {
  if (!isValid.value) return;
  emit("give", {
    address: localAddress.value,
    amount: localAmount.value,
    reason: localReason.value,
  });
};

defineExpose({
  reset: () => {
    localAddress.value = "";
    localAmount.value = 10;
    localReason.value = "";
  },
});
</script>

<style lang="scss" scoped>
.give-karma-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.content-card {
  background: var(--karma-card-bg);
  border: 1px solid var(--karma-border);
  border-radius: 16px;
  padding: 20px;
  backdrop-filter: blur(10px);
}

.card-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--karma-text);
  display: block;
  margin-bottom: 8px;
}

.card-subtitle {
  font-size: 14px;
  color: var(--karma-text-secondary);
  margin-bottom: 16px;
  display: block;
}

.form-group {
  margin-bottom: 16px;
  
  label {
    font-size: 13px;
    color: var(--karma-text-secondary);
    margin-bottom: 6px;
    display: block;
  }
  
  &.half {
    flex: 1;
  }
}

.form-row {
  display: flex;
  gap: 12px;
}

.form-input,
.form-textarea {
  width: 100%;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--karma-border);
  border-radius: 10px;
  color: var(--karma-text);
  font-size: 15px;
  transition: all 0.2s;
  
  &:focus {
    outline: none;
    border-color: var(--karma-primary);
    background: rgba(255, 255, 255, 0.08);
  }
  
  &::placeholder {
    color: var(--karma-text-muted);
  }
}

.form-textarea {
  min-height: 100px;
  resize: vertical;
}

.amount-presets {
  display: flex;
  gap: 8px;
}

.preset-btn {
  flex: 1;
  padding: 10px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--karma-border);
  border-radius: 8px;
  color: var(--karma-text-secondary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: rgba(255, 255, 255, 0.1);
  }
  
  &.active {
    background: var(--karma-primary);
    border-color: var(--karma-primary);
    color: white;
  }
}

.action-button {
  width: 100%;
  padding: 14px 24px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  
  &.primary {
    background: linear-gradient(135deg, var(--karma-primary), var(--karma-secondary));
    color: white;
    
    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(245, 158, 11, 0.3);
    }
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
